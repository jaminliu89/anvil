#!/usr/bin/env python3
"""Anvil sidecar — DSH 守卫桥.

包 deepseek_harness，把对话/体检/预估暴露为 HTTP。
所有请求经守卫（reasoning 分离 / tool_calls 抢救 / usage 归一化），再打到推理端点。

端点:
  GET  /health            存活
  POST /chat              非流式对话（守卫全开）
  POST /stream            流式对话（SSE）
  GET  /doctor            环境体检
  POST /estimate          发送前预估

启动:
  python3 bridge.py --port 18443 --target http://localhost:18080/v1
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from deepseek_harness import DeepSeekHarness, estimate_cache_hit, __version__ as dsh_version
except ImportError:
    print("FATAL: deepseek_harness not installed", file=sys.stderr)
    sys.exit(1)


def make_harness(target: str, api_key: str) -> DeepSeekHarness:
    return DeepSeekHarness(api_key=api_key, base_url=target)


class Handler(BaseHTTPRequestHandler):
    harness: "DeepSeekHarness | None" = None  # injected
    salvage_log: list[dict] = []
    model_id: str = ""

    def log_message(self, format, *args):  # type: ignore[no-untyped-def]
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
                # chunk: OpenAI 流式增量
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
        # 1. harness 库
        checks.append({"name": "守卫库", "ok": True, "detail": f"deepseek-harness {dsh_version}"})
        # 2. 端点可达
        try:
            import urllib.request
            base = str(getattr(getattr(self.harness, "_oai", None), "base_url", "")).rstrip("/")
            # base_url 可能已含 /v1
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
        # 3. 1-token 试调
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

    # 自动发现模型 id
    if not Handler.model_id:
        try:
            import urllib.request
            with urllib.request.urlopen(f"{args.target}/models", timeout=5) as r:
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
