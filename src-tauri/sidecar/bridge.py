#!/usr/bin/env python3
"""Anvil sidecar — DSH 守卫桥 + Unsloth CLI 网关。

包 deepseek_harness，把对话/体检/预估暴露为 HTTP。
所有请求经守卫（reasoning 分离 / tool_calls 抢救 / usage 归一化），再打到推理端点。

DSH 端点:
  GET  /health                存活
  POST /chat                  非流式对话（守卫全开）
  POST /stream                流式对话（SSE）
  GET  /doctor                环境体检
  POST /estimate              发送前预估
  GET  /salvage-log           抢救日志

Unsloth 网关:
  GET  /unsloth/status        Unsloth 运行状态
  GET  /unsloth/checkpoints   已训练的检查点列表
  POST /unsloth/start/<agent> 启动编码 Agent 桥接
  POST /unsloth/train         启动训练
  GET  /unsloth/train-status  训练进度
  POST /unsloth/train-stop    停止训练

启动:
  python3 bridge.py --port 18443 --target http://localhost:18080/v1
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import urlopen, Request

try:
    from deepseek_harness import DeepSeekHarness, estimate_cache_hit, __version__ as dsh_version
except ImportError:
    print("FATAL: deepseek_harness not installed", file=sys.stderr)
    sys.exit(1)

UNSLOTH_CLI = os.path.expanduser("~/.unsloth/studio/unsloth_studio/bin/unsloth")
UNSLOTH_HEALTH = "http://127.0.0.1:8888/api/health"

# 训练状态（全局）
TRAIN_STATE: dict = {"running": False, "pid": None, "model": "", "started_at": 0, "log": [], "step": 0, "loss": 0.0}


def make_harness(target: str, api_key: str) -> DeepSeekHarness:
    return DeepSeekHarness(api_key=api_key, base_url=target)


class Handler(BaseHTTPRequestHandler):
    harness: DeepSeekHarness | None = None  # injected
    salvage_log: list[dict] = []
    model_id: str = ""

    def log_message(self, format, *args):
        pass

    def _json(self, code: int, obj) -> None:
        body = json.dumps(obj, ensure_ascii=False, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0:
            return {}
        return json.loads(self.rfile.read(n))

    # ---- GET ----
    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True, "dsh": dsh_version, "ts": time.time()})
            return
        if self.path == "/doctor":
            self._doctor()
            return
        if self.path == "/salvage-log":
            self._json(200, {"log": Handler.salvage_log[-50:]})
            return
        if self.path == "/unsloth/status":
            self._unsloth_status()
            return
        if self.path.startswith("/unsloth/checkpoints"):
            self._unsloth_checkpoints()
            return
        if self.path == "/unsloth/train-status":
            self._unsloth_train_status()
            return
        self._json(404, {"error": "not found"})

    # ---- POST ----
    def do_POST(self):
        try:
            if self.path == "/chat":
                self._chat()
            elif self.path == "/stream":
                self._stream()
            elif self.path == "/estimate":
                self._estimate()
            elif self.path.startswith("/unsloth/start/"):
                self._unsloth_start()
            elif self.path == "/unsloth/train":
                self._unsloth_train()
            elif self.path == "/unsloth/train-stop":
                self._unsloth_train_stop()
            else:
                self._json(404, {"error": "not found"})
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"error": str(e)})

    # ---- 守卫化对话 ----
    def _chat(self):
        req = self._read_body()
        messages = req.get("messages") or []
        if not messages:
            self._json(400, {"error": "messages required"})
            return
        kwargs = {}
        for k in ("max_tokens", "temperature", "top_p"):
            if k in req:
                kwargs[k] = req[k]

        t0 = time.time()
        result = self.harness.chat(
            model=req.get("model") or Handler.model_id,
            messages=messages,
            **kwargs,
        )
        elapsed = round(time.time() - t0, 2)

        if result.get("salvage"):
            Handler.salvage_log.append({
                "ts": time.time(),
                "pattern": result["salvage"].get("pattern"),
            })

        self._json(200, {
            "message": result["message"],
            "usage": result["usage"],
            "finish_reason": result["finish_reason"],
            "salvaged": bool(result.get("salvage")),
            "elapsed_s": elapsed,
        })

    # ---- 流式（SSE）----
    def _stream(self):
        req = self._read_body()
        messages = req.get("messages") or []
        kwargs = {}
        for k in ("max_tokens", "temperature", "top_p"):
            if k in req:
                kwargs[k] = req[k]

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        def emit(evt: str, data: dict):
            self.wfile.write(f"event: {evt}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n".encode())
            self.wfile.flush()

        try:
            for chunk in self.harness.stream_chat(
                model=req.get("model") or Handler.model_id,
                messages=messages,
                **kwargs,
            ):
                msg = chunk.get("message") or {}
                piece = msg.get("content") or ""
                think = msg.get("reasoning_content") or ""
                if think:
                    emit("thinking", {"text": think})
                if piece:
                    emit("delta", {"text": piece})
            emit("done", {"ok": True})
        except Exception as e:
            emit("error", {"error": str(e)})

    # ---- 体检 ----
    def _doctor(self):
        checks = []
        checks.append({"name": "守卫库", "ok": True, "detail": f"deepseek-harness {dsh_version}"})
        try:
            import urllib.request
            base = str(getattr(getattr(self.harness, "_oai", None), "base_url", "")).rstrip("/")
            probe_urls = [f"{base}/models"]
            if not base.endswith("/v1"):
                probe_urls.append(f"{base}/v1/models")
            last_err = ""
            ok = False
            for u in probe_urls:
                try:
                    with urllib.request.urlopen(u, timeout=5) as r:
                        if r.status == 200:
                            ok = True
                            base = u.rsplit("/models", 1)[0]
                            break
                except Exception as e:
                    last_err = str(e)
            checks.append({"name": "大脑在线", "ok": ok, "detail": base if ok else last_err})
        except Exception as e:
            checks.append({"name": "大脑在线", "ok": False, "detail": str(e)})
        try:
            t0 = time.time()
            r = self.harness.chat(
                model=Handler.model_id,
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=1,
            )
            ms = round((time.time() - t0) * 1000)
            checks.append({"name": "试调", "ok": True, "detail": f"{ms}ms"})
        except Exception as e:
            checks.append({"name": "试调", "ok": False, "detail": str(e)})
        all_ok = all(c["ok"] for c in checks)
        self._json(200, {"ok": all_ok, "checks": checks})

    # ---- 预估 ----
    def _estimate(self):
        req = self._read_body()
        prev = req.get("prev") or []
        est = estimate_cache_hit(prev, req.get("messages") or [])
        self._json(200, est if isinstance(est, dict) else {"estimate": est})

    # ---- Unsloth 状态 ----
    def _unsloth_status(self):
        alive = False
        body = {"status": "offline"}
        try:
            with urlopen(UNSLOTH_HEALTH, timeout=3) as r:
                if r.status == 200:
                    alive = True
                    body = json.loads(r.read())
        except Exception:
            pass
        self._json(200, {
            "alive": alive,
            "detail": body if isinstance(body, dict) else body,
        })

    # ---- Unsloth 检查点 ----
    def _unsloth_checkpoints(self):
        if not os.path.isfile(UNSLOTH_CLI):
            self._json(200, {"ok": True, "checkpoints": [], "note": "unsloth CLI not found"})
            return
        try:
            r = subprocess.run(
                [UNSLOTH_CLI, "list-checkpoints", "--json"],
                capture_output=True, text=True, timeout=30,
            )
            data = json.loads(r.stdout) if r.stdout.strip() else []
            self._json(200, {"ok": True, "checkpoints": data})
        except subprocess.TimeoutExpired:
            self._json(200, {"ok": True, "checkpoints": [], "note": "timeout"})
        except Exception as e:
            self._json(200, {"ok": False, "checkpoints": [], "error": str(e)})

    # ---- Unsloth 启动 Agent 桥接 ----
    def _unsloth_start(self):
        agent = self.path.split("/unsloth/start/")[-1].split("/")[0]
        valid = {"claude", "codex", "hermes", "pi", "openclaw", "opencode"}
        if agent not in valid:
            self._json(400, {"error": f"unknown agent '{agent}', valid: {', '.join(sorted(valid))}"})
            return
        if not os.path.isfile(UNSLOTH_CLI):
            self._json(500, {"error": "unsloth CLI not found"})
            return
        try:
            subprocess.Popen(
                [UNSLOTH_CLI, "start", agent],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self._json(200, {"ok": True, "agent": agent, "message": f"{agent} bridge starting"})
        except Exception as e:
            self._json(500, {"error": str(e)})

    # ---- Unsloth 训练 ----
    def _unsloth_train(self):
        if TRAIN_STATE["running"]:
            self._json(409, {"error": "训练已在运行中"})
            return
        if not os.path.isfile(UNSLOTH_CLI):
            self._json(500, {"error": "unsloth CLI not found"})
            return

        req = self._read_body()
        model = req.get("model", "")
        dataset = req.get("dataset", "")
        local_dataset = req.get("local_dataset", "")
        epochs = req.get("epochs", 1)
        lr = req.get("learning_rate", 2e-4)
        lora_r = req.get("lora_r", 16)
        output_dir = req.get("output_dir", os.path.expanduser("~/.unsloth/outputs"))
        max_seq_length = req.get("max_seq_length", 4096)
        batch_size = req.get("batch_size", 2)

        if not model:
            self._json(400, {"error": "model required"})
            return
        if not dataset and not local_dataset:
            self._json(400, {"error": "dataset or local_dataset required"})
            return

        cmd = [UNSLOTH_CLI, "train", "--model", model]
        if dataset:
            cmd += ["--dataset", dataset]
        if local_dataset:
            cmd += ["--local-dataset", local_dataset]
        cmd += [
            "--num-epochs", str(epochs),
            "--learning-rate", str(lr),
            "--lora-r", str(lora_r),
            "--max-seq-length", str(max_seq_length),
            "--batch-size", str(batch_size),
            "--output-dir", output_dir,
        ]

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            TRAIN_STATE["running"] = True
            TRAIN_STATE["pid"] = proc.pid
            TRAIN_STATE["model"] = model
            TRAIN_STATE["started_at"] = time.time()
            TRAIN_STATE["log"] = []
            TRAIN_STATE["step"] = 0
            TRAIN_STATE["loss"] = 0.0

            # 后台线程读日志
            def _reader():
                for line in iter(proc.stdout.readline, ""):
                    TRAIN_STATE["log"].append(line.rstrip())
                    # 解析 step/loss
                    if "step=" in line or "Step" in line or "loss=" in line.lower() or "loss:" in line.lower():
                        try:
                            # 尝试从常见格式提取
                            parts = line.split()
                            for p in parts:
                                if p.startswith("step="):
                                    TRAIN_STATE["step"] = int(p.split("=")[1])
                                elif p.startswith("Step=") or p.startswith("Step:"):
                                    TRAIN_STATE["step"] = int(p.split("=")[1].split("/")[0])
                                elif "loss=" in p.lower():
                                    val = p.split("=")[1].strip(",")
                                    TRAIN_STATE["loss"] = float(val)
                                elif "loss:" in p.lower() or p.startswith("loss:"):
                                    val = p.split(":")[1].strip(" ,")
                                    TRAIN_STATE["loss"] = float(val)
                        except (ValueError, IndexError):
                            pass
                    # 最多保留 500 行
                    if len(TRAIN_STATE["log"]) > 500:
                        TRAIN_STATE["log"] = TRAIN_STATE["log"][-500:]
                proc.wait()
                TRAIN_STATE["running"] = False

            t = threading.Thread(target=_reader, daemon=True)
            t.start()

            self._json(200, {"ok": True, "pid": proc.pid, "model": model, "epochs": epochs})
        except Exception as e:
            self._json(500, {"error": str(e)})

    # ---- 训练状态 ----
    def _unsloth_train_status(self):
        elapsed = round(time.time() - TRAIN_STATE["started_at"], 1) if TRAIN_STATE["running"] else 0
        self._json(200, {
            "running": TRAIN_STATE["running"],
            "pid": TRAIN_STATE["pid"],
            "model": TRAIN_STATE["model"],
            "step": TRAIN_STATE["step"],
            "loss": TRAIN_STATE["loss"],
            "elapsed_s": elapsed,
            "log": TRAIN_STATE["log"][-30:],
        })

    # ---- 停止训练 ----
    def _unsloth_train_stop(self):
        if not TRAIN_STATE["running"] or not TRAIN_STATE["pid"]:
            self._json(200, {"ok": True, "message": "没有正在运行的训练"})
            return
        try:
            os.kill(TRAIN_STATE["pid"], signal.SIGTERM)
            TRAIN_STATE["running"] = False
            TRAIN_STATE["log"].append("[stopped by user]")
            self._json(200, {"ok": True, "message": "训练已停止"})
        except ProcessLookupError:
            TRAIN_STATE["running"] = False
            self._json(200, {"ok": True, "message": "进程已结束"})
        except Exception as e:
            self._json(500, {"error": str(e)})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=18443)
    ap.add_argument("--target", default=os.getenv("ANVIL_TARGET", "http://localhost:18080/v1"))
    ap.add_argument("--api-key", default=os.getenv("ANVIL_API_KEY", "not-needed"))
    ap.add_argument("--model", default=os.getenv("ANVIL_MODEL", ""))
    args = ap.parse_args()

    h = make_harness(args.target, args.api_key)
    Handler.harness = h
    Handler.model_id = args.model

    if not Handler.model_id:
        try:
            with urlopen(f"{args.target.rstrip('/')}/models", timeout=5) as r:
                data = json.load(r)
            models = [m.get("id") for m in data.get("data", []) if m.get("id")]
            Handler.model_id = models[0] if models else ""
        except Exception as e:
            print(f"model autodiscover failed: {e}", file=sys.stderr)

    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"[anvil-sidecar] dsh={dsh_version} target={args.target} model={Handler.model_id} port={args.port}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()