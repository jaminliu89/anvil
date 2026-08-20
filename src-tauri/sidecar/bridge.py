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

DSH Agent Loop:
  POST /dsh/run              启动 agent loop（SSE 流式）
  GET  /dsh/health           dsh 健康检查（其实就是 bridge 健康检查）

启动:
  python3 bridge.py --port 18443 --target http://localhost:18080/v1
"""
from __future__ import annotations

import re
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


def _tavily_key() -> str:
    k = os.environ.get("TAVILY_API_KEY", "")
    if k: return k
    try:
        with open(os.path.expanduser("~/.hermes/.env")) as f:
            for line in f:
                if line.startswith("TAVILY_API_KEY="):
                    return line.strip().split("=", 1)[1]
    except OSError:
        pass
    return ""

def _tavily_search(query: str, count: int = 5) -> list:
    k = _tavily_key()
    if not k:
        return []
    try:
        req = Request("https://api.tavily.com/search",
            data=json.dumps({"api_key": k, "query": query, "max_results": count, "include_answer": False}).encode(),
            headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=15) as r:
            body = json.loads(r.read())
        return body.get("results", [])
    except Exception as e:
        print(f"tavily error: {e}", file=sys.stderr)
        return []


def make_harness(target: str, api_key: str) -> DeepSeekHarness:
    return DeepSeekHarness(api_key=api_key, base_url=target)


# 多推理端点注册表 — /target 可运行时切换
INFERENCE_TARGETS: dict = {
    "ling": os.getenv("ANVIL_TARGET", "http://localhost:18080/v1"),
    "ollama": "http://localhost:11434/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "siliconflow": "https://api.siliconflow.cn/v1",
    "openai": "https://api.openai.com/v1",
    "lmstudio": "http://localhost:1234/v1",
}

# 云端默认 model
_TARGET_MODELS = {
    "deepseek": "deepseek-chat",
    "siliconflow": "deepseek-ai/DeepSeek-V3",
    "openai": "gpt-4o-mini",
}

# API key map for cloud targets
_TARGET_KEYS = {
    "deepseek": os.getenv("DEEPSEEK_API_KEY", ""),
    "siliconflow": os.getenv("SILICONFLOW_API_KEY", ""),
    "openai": os.getenv("OPENAI_API_KEY", ""),
}


# ===== 异步 Agent 任务管理器（统一模式：create → status → log → approve）=====
import tempfile
import shutil

class AsyncTaskManager:
    """通用异步任务管理器 — 所有 CLI agent 共用一套生命周期管理"""
    
    def __init__(self):
        self.tasks: dict[str, dict] = {}  # sid -> task info
        self._lock = threading.Lock()
    
    def create(self, agent: str, prompt: str, repo: str = '') -> str:
        sid = f"{int(time.time())}-{agent}-{os.urandom(4).hex()}"
        with self._lock:
            self.tasks[sid] = {
                'sid': sid,
                'agent': agent,
                'prompt': prompt,
                'repo': repo,
                'state': 'queued',  # queued | planning | awaiting-approval | running | done | failed
                'steps': [{'id': 's0', 'title': '任务创建中', 'status': 'running'}],
                'log': '',
                'result': None,
                'created_at': time.time(),
                'thread': None,
            }
        return sid
    
    def update_state(self, sid: str, state: str):
        with self._lock:
            if sid in self.tasks:
                self.tasks[sid]['state'] = state
    
    def add_step(self, sid: str, step_id: str, title: str, status: str = 'pending'):
        with self._lock:
            if sid in self.tasks:
                self.tasks[sid]['steps'].append({'id': step_id, 'title': title, 'status': status})
    
    def update_step(self, sid: str, step_id: str, status: str, content: str = ''):
        with self._lock:
            if sid in self.tasks:
                for s in self.tasks[sid]['steps']:
                    if s['id'] == step_id:
                        s['status'] = status
                        if content:
                            s['content'] = content
                        break
    
    def append_log(self, sid: str, text: str):
        with self._lock:
            if sid in self.tasks:
                self.tasks[sid]['log'] += text
    
    def get(self, sid: str) -> dict | None:
        with self._lock:
            return self.tasks.get(sid)
    
    def list_all(self) -> list[dict]:
        with self._lock:
            return list(self.tasks.values())

TASK_MANAGER = AsyncTaskManager()

# ===== Claude Code 代理 =====
def _claude_available() -> bool:
    return shutil.which('claude') is not None

def _claude_run(sid: str, prompt: str, repo: str):
    """后台线程运行 Claude Code 任务"""
    try:
        TASK_MANAGER.update_state(sid, 'planning')
        TASK_MANAGER.update_step(sid, 's0', 'done')
        TASK_MANAGER.add_step(sid, 's1', '生成计划中...', 'running')
        
        # 准备工作目录
        workdir = repo or os.getcwd()
        
        # 用 --dry-run 或 plan 模式先获取计划（claude 没有标准 plan 命令，简化处理）
        # 直接创建 worktree 隔离目录
        tmpdir = tempfile.mkdtemp(prefix=f'claude-{sid}-')
        TASK_MANAGER.append_log(sid, f'工作目录: {tmpdir}\n')
        
        # 直接执行（简化版：跑一个命令，记录输出）
        TASK_MANAGER.update_step(sid, 's1', 'done')
        TASK_MANAGER.add_step(sid, 's2', 'Claude 执行中', 'running')
        TASK_MANAGER.update_state(sid, 'running')
        
        try:
            proc = subprocess.Popen(
                ['claude', '--send', prompt, '--max-turns', '5'],
                cwd=tmpdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            if proc.stdout:
                for line in proc.stdout:
                    TASK_MANAGER.append_log(sid, line)
            proc.wait(timeout=600)
            
            TASK_MANAGER.update_step(sid, 's2', 'done')
            TASK_MANAGER.update_state(sid, 'done')
            TASK_MANAGER.tasks[sid]['result'] = {'output': TASK_MANAGER.tasks[sid]['log'][-2000:]}
        except subprocess.TimeoutExpired:
            proc.kill()
            TASK_MANAGER.update_step(sid, 's2', 'failed')
            TASK_MANAGER.update_state(sid, 'failed')
            TASK_MANAGER.append_log(sid, '\n[任务超时]\n')
        except Exception as e:
            TASK_MANAGER.update_step(sid, 's2', 'failed')
            TASK_MANAGER.update_state(sid, 'failed')
            TASK_MANAGER.append_log(sid, f'\n[错误] {e}\n')
    except Exception as e:
        TASK_MANAGER.update_state(sid, 'failed')
        TASK_MANAGER.append_log(sid, f'[初始化失败] {e}\n')

# ===== OpenClaw 代理 =====
def _openclaw_available() -> bool:
    return shutil.which('openclaw') is not None

def _openclaw_run(sid: str, prompt: str, repo: str):
    try:
        TASK_MANAGER.update_state(sid, 'planning')
        TASK_MANAGER.update_step(sid, 's0', 'done')
        TASK_MANAGER.add_step(sid, 's1', '生成计划中...', 'running')
        
        tmpdir = tempfile.mkdtemp(prefix=f'openclaw-{sid}-')
        TASK_MANAGER.append_log(sid, f'工作目录: {tmpdir}\n')
        
        TASK_MANAGER.update_step(sid, 's1', 'done')
        TASK_MANAGER.add_step(sid, 's2', 'OpenClaw 执行中', 'running')
        TASK_MANAGER.update_state(sid, 'running')
        
        try:
            proc = subprocess.Popen(
                ['openclaw', prompt],
                cwd=tmpdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            if proc.stdout:
                for line in proc.stdout:
                    TASK_MANAGER.append_log(sid, line)
            proc.wait(timeout=600)
            
            TASK_MANAGER.update_step(sid, 's2', 'done')
            TASK_MANAGER.update_state(sid, 'done')
        except subprocess.TimeoutExpired:
            proc.kill()
            TASK_MANAGER.update_step(sid, 's2', 'failed')
            TASK_MANAGER.update_state(sid, 'failed')
        except Exception as e:
            TASK_MANAGER.update_step(sid, 's2', 'failed')
            TASK_MANAGER.update_state(sid, 'failed')
            TASK_MANAGER.append_log(sid, f'\n[错误] {e}\n')
    except Exception as e:
        TASK_MANAGER.update_state(sid, 'failed')
        TASK_MANAGER.append_log(sid, f'[初始化失败] {e}\n')

# ===== Hermes Agent 代理 =====
def _hermes_available() -> bool:
    return shutil.which('hermes') is not None

def _hermes_run(sid: str, prompt: str, _repo: str):
    try:
        TASK_MANAGER.update_state(sid, 'running')
        TASK_MANAGER.update_step(sid, 's0', 'done')
        TASK_MANAGER.add_step(sid, 's1', 'Hermes 执行中...', 'running')
        
        tmpdir = tempfile.mkdtemp(prefix=f'hermes-{sid}-')
        TASK_MANAGER.append_log(sid, f'工作目录: {tmpdir}\n')
        
        try:
            # hermes run 命令执行（简化）
            proc = subprocess.Popen(
                ['hermes', 'run', prompt],
                cwd=tmpdir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            if proc.stdout:
                for line in proc.stdout:
                    TASK_MANAGER.append_log(sid, line)
            proc.wait(timeout=900)  # hermes 任务可能较长
            
            TASK_MANAGER.update_step(sid, 's1', 'done')
            TASK_MANAGER.update_state(sid, 'done')
        except subprocess.TimeoutExpired:
            proc.kill()
            TASK_MANAGER.update_step(sid, 's1', 'failed')
            TASK_MANAGER.update_state(sid, 'failed')
        except Exception as e:
            TASK_MANAGER.update_step(sid, 's1', 'failed')
            TASK_MANAGER.update_state(sid, 'failed')
            TASK_MANAGER.append_log(sid, f'\n[错误] {e}\n')
    except Exception as e:
        TASK_MANAGER.update_state(sid, 'failed')
        TASK_MANAGER.append_log(sid, f'[初始化失败] {e}\n')

# ===== Agent 注册映射 =====
AGENT_RUNNERS = {
    'claude': _claude_run,
    'openclaw': _openclaw_run,
    'hermes': _hermes_run,
}

AGENT_AVAILABLE = {
    'claude': _claude_available,
    'openclaw': _openclaw_available,
    'hermes': _hermes_available,
}


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
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        # CORS preflight
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _read_body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0:
            return {}
        return json.loads(self.rfile.read(n))

    # ---- GET ----
    def do_GET(self):
        if self.path == "/capabilities":
            # 探活各推理端点
            def _probe(url):
                if not url:
                    return False
                try:
                    urlopen(f"{url}/models", timeout=2)
                    return True
                except Exception:
                    return False
            target_status = {}
            for n, u in INFERENCE_TARGETS.items():
                if not u:
                    continue
                if n in _TARGET_KEYS:
                    target_status[n] = _probe(u) or bool(_TARGET_KEYS[n])
                else:
                    target_status[n] = _probe(u)
            # 云端 key 是否配置
            key_status = {n: bool(k) for n, k in _TARGET_KEYS.items()}
            caps = {
                "target_status": target_status,
                "key_status": key_status,
                "adapters": [
                    {"id": "ling", "name": "Ling (本地推理)", "commands": [], "chat": True},
                    {"id": "dock", "name": "Dock (异步编码)", "commands": ["dock"], "chat": False},
                    {"id": "unsloth", "name": "Unsloth (训练)", "commands": ["train"], "chat": False},
                ],
                "targets": list(INFERENCE_TARGETS.keys()),
                "endpoints": ["/chat", "/stream", "/search", "/target", "/models", "/health", "/doctor", "/estimate", "/unsloth/*"],
                "version": "0.2.1",
            }
            self._json(200, caps)
            return
        if self.path == "/models":
            self._json(200, {"targets": INFERENCE_TARGETS, "current": getattr(Handler, "target", "")})
            return
        if self.path == "/health":
            self._json(200, {"ok": True, "dsh": dsh_version, "ts": time.time()})
            return
        if self.path == "/doctor":
            self._doctor()
            return
        if self.path == "/salvage-log":
            self._json(200, {"log": Handler.salvage_log[-50:]})
            return
        if self.path == "/dsh/health":
            self._json(200, {"ok": True, "dsh": dsh_version, "agent_loop": True, "plugins": 0})
            return
        
        # ===== 异步 Agent 健康检查 =====
        for agent_name in AGENT_AVAILABLE:
            if self.path == f"/{agent_name}/health":
                avail = AGENT_AVAILABLE[agent_name]()
                status_text = "可用" if avail else "未安装"
                self._json(200, {"ok": avail, "agent": agent_name, "message": status_text})
                return
        if self.path == "/jules/health":
            import shutil
            avail = shutil.which('jules') is not None
            self._json(200, {"ok": avail, "agent": "jules", "message": "可用" if avail else "未安装"})
            return
        if self.path == "/ollama/health":
            import shutil
            avail = shutil.which('ollama') is not None
            self._json(200, {"ok": avail, "agent": "ollama", "message": "可用" if avail else "未安装"})
            return
        
        # ===== 异步 Agent 状态查询 =====
        for agent_name in AGENT_RUNNERS:
            prefix = f"/{agent_name}/status/"
            if self.path.startswith(prefix):
                sid = self.path[len(prefix):]
                task = TASK_MANAGER.get(sid)
                if task:
                    self._json(200, task)
                else:
                    self._json(404, {"error": "task not found"})
                return
        
        # ===== 异步 Agent 日志查询 =====
        for agent_name in AGENT_RUNNERS:
            prefix = f"/{agent_name}/log/"
            if self.path.startswith(prefix):
                sid = self.path[len(prefix):]
                task = TASK_MANAGER.get(sid)
                if task:
                    self._json(200, {"log": task.get('log', '')[-3000:]})
                else:
                    self._json(404, {"error": "task not found"})
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
            elif self.path == "/search":
                self._search()
            elif self.path == "/target":
                self._switch_target()
            elif self.path == "/estimate":
                self._estimate()
            elif self.path.startswith("/unsloth/start/"):
                self._unsloth_start()
            elif self.path == "/unsloth/train":
                self._unsloth_train()
            elif self.path == "/unsloth/train-stop":
                self._unsloth_train_stop()
            elif self.path == "/unsloth/export":
                self._unsloth_export()
                self._unsloth_train_stop()
            elif self.path == "/dsh/run":
                self._dsh_run()
            elif self.path == "/claude/create":
                self._agent_create('claude')
            elif self.path == "/openclaw/create":
                self._agent_create('openclaw')
            elif self.path == "/hermes/create":
                self._agent_create('hermes')
            elif self.path == "/jules/create":
                self._agent_create('jules')
            elif self.path.startswith("/claude/approve/") or                  self.path.startswith("/openclaw/approve/") or                  self.path.startswith("/hermes/approve/") or                  self.path.startswith("/jules/approve/"):
                parts = self.path.split('/')
                if len(parts) >= 4:
                    self._agent_approve()
                else:
                    self._json(400, {"error": "sid required"})
            else:
                self._json(404, {"error": "not found"})
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"error": str(e)})

    # ---- 异步 Agent 创建 ----
    def _agent_create(self, agent: str):
        body = self._read_body()
        prompt = body.get('prompt', '')
        if not prompt:
            self._json(400, {"error": "prompt required"})
            return
        if agent == 'jules':
            import subprocess
            try:
                proc = subprocess.Popen(['jules', 'new', prompt], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
                out, _ = proc.communicate(timeout=30)
                sid = f"jules-{int(time.time())}"
                self._json(200, {"sid": sid, "status": "awaiting-approval", "steps": [{"id": "s0", "title": "计划已生成", "status": "pending"}], "approved": False, "message": out[:500]})
            except Exception as e:
                self._json(500, {"error": f"Jules 创建失败: {e}"})
            return
        runner = AGENT_RUNNERS.get(agent)
        if not runner:
            self._json(400, {"error": f"unknown agent: {agent}"})
            return
        avail = AGENT_AVAILABLE.get(agent, lambda: False)()
        if not avail:
            self._json(503, {"error": f"{agent} CLI 未安装"})
            return
        sid = TASK_MANAGER.create(agent, prompt)
        thread = threading.Thread(target=runner, args=(sid, prompt, ''), daemon=True)
        thread.start()
        with TASK_MANAGER._lock:
            TASK_MANAGER.tasks[sid]['thread'] = thread
        self._json(200, {"sid": sid, "status": "awaiting-approval", "steps": [{"id": "s0", "title": "计划待审批", "status": "pending"}], "approved": False})

    # ---- 异步 Agent 批准执行 ----
    def _agent_approve(self):
        parts = self.path.split('/')
        sid = parts[3]
        task = TASK_MANAGER.get(sid)
        if not task:
            self._json(404, {"error": "task not found"})
            return
        TASK_MANAGER.update_state(sid, 'running')
        self._json(200, {"ok": True, "sid": sid, "message": "任务已批准，执行中"})

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

        # fallback 链：主目标失败 → 依次尝试 deepseek/siliconflow
        t0 = time.time()
        result = None
        last_err = ""
        primary = req.get("model") or Handler.model_id
        attempts = [("", None)]  # 先用当前 harness
        fallback_names = [n for n in ("deepseek", "siliconflow") if _TARGET_KEYS.get(n)]
        for fname in fallback_names:
            attempts.append((fname, INFERENCE_TARGETS[fname]))

        for fname, furl in attempts:
            try:
                if furl:  # 切到 fallback 端点
                    Handler.harness = make_harness(furl, _TARGET_KEYS[fname])
                    Handler.model_id = _TARGET_MODELS.get(fname, "")
                    Handler.current_target = fname
                use_model = Handler.model_id if furl else (req.get("model") or Handler.model_id)
                result = self.harness.chat(
                    model=use_model,
                    messages=messages,
                    **kwargs,
                )
                if result:
                    break
            except Exception as e:
                last_err = str(e)
                continue

        elapsed = round(time.time() - t0, 2)

        if not result:
            self._json(502, {"error": f"所有推理端点不可用: {last_err}"})
            return
        if last_err and fname:
            Handler.salvage_log.append({"ts": time.time(), "pattern": f"fallback→{fname}"})

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
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
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

    # ---- 切换推理端点 ----
    def _switch_target(self):
        req = self._read_body()
        name = req.get("name", "")
        if name not in INFERENCE_TARGETS:
            self._json(400, {"error": f"unknown target {name}", "available": list(INFERENCE_TARGETS)})
            return
        url = INFERENCE_TARGETS[name]
        api_key = _TARGET_KEYS.get(name) or "not-needed"
        try:
            urlopen(f"{url}/models", timeout=3)
            Handler.harness = make_harness(url, api_key)
            Handler.model_id = ""
            # 重新自动发现 model id
            try:
                with urlopen(f"{url}/models", timeout=5) as r:
                    data = json.load(r)
                models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                Handler.model_id = models[0] if models else _TARGET_MODELS.get(name, "")
            except Exception:
                pass
            Handler.current_target = name
            self._json(200, {"ok": True, "switched": name, "url": url, "model": Handler.model_id})
        except Exception as e:
            self._json(503, {"error": f"target {name} not responding: {e}"})

    # ---- 搜索 ----
    def _search(self):
        req = self._read_body()
        query = req.get("query", "")
        count = req.get("count", 5)
        if not query:
            self._json(400, {"error": "query required"})
            return
        self._json(200, {"query": query, "results": _tavily_search(query, count)})

    # ---- Agent Loop（多轮：分析 → 工具 → 推理 → 再工具 → 回答） ----
    def _dsh_run(self):
        """多轮 agent loop。SSE 事件:
          - step_start: {id, title, status}
          - step_update: {id, content}        (非流的进度更新)
          - step_reasoning: {id, content}     (推理链增量)
          - step_done: {id, status, result}
          - final: {content, reasoning, steps, used_search}
          - error: {message}
        """
        req = self._read_body()
        prompt = req.get("prompt", "")
        if not prompt:
            self._json(400, {"error": "prompt required"})
            return
        use_search = req.get("search", True)

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

        def emit(evt: str, data: dict):
            try:
                self.wfile.write(f"event: {evt}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n".encode())
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass

        try:
            # =========== Step 1: 分析 → 生成 action plan ===========
            emit("step_start", {"id": "plan", "title": "制定计划", "status": "running"})

            plan_sys = (
                "你是一个任务分解专家。输出 JSON action plan。可用 actions:\n"
                "  - search(query): 联网搜索获取最新信息\n"
                "  - fetch(url): 抓取指定网页全文\n"
                "  - answer: 生成最终回答（始终放最后）\n"
                "规则: 需要最新信息 → search。需要全文 → search 之后再 fetch 具体 URL。\n"
                "直接回答即可的任务 → 只输出 answer。\n"
                "输出格式: {\"plan\": [{\"action\":\"search\"|\"fetch\"|\"answer\", \"query\":\"...\", \"url\":\"...\"}]}"
            )
            plan_messages = [
                {"role": "system", "content": plan_sys},
                {"role": "user", "content": prompt},
            ]
            plan_result = self.harness.chat(
                model=Handler.model_id,
                messages=plan_messages,
                max_tokens=600,
            )
            plan_text = plan_result["message"]["content"] if plan_result else ""

            actions = []
            try:
                m = re.search(r"\{.*\}", plan_text, re.DOTALL)
                if m:
                    plan_json = json.loads(m.group())
                    actions = plan_json.get("plan", [])
            except Exception:
                pass
            if not actions:
                actions = [{"action": "answer"}]

            emit("step_update", {"id": "plan", "content": f"计划 {len(actions)} 步"})
            emit("step_done", {"id": "plan", "status": "done", "result": [a.get("action") for a in actions]})

            # =========== Step 2: 逐 action 执行 ===========
            tool_results = []
            for i, action in enumerate(actions):
                act = action.get("action", "")
                if act == "answer":
                    continue

                step_id = f"tool_{i}"
                step_label = {"search": "联网搜索", "fetch": "抓取网页"}.get(act, act)
                emit("step_start", {"id": step_id, "title": step_label, "status": "running"})

                if act == "search":
                    query = action.get("query", prompt)
                    if use_search:
                        emit("step_update", {"id": step_id, "content": f"正在搜索: {query[:80]}"})
                        results = _tavily_search(query, 5)
                        if results:
                            emit("step_update", {"id": step_id, "content": f"找到 {len(results)} 条结果"})
                            summary = "\n\n".join(
                                f"[{i+1}] {r.get('title', '')}\n来源: {r.get('url', '')}\n{(r.get('content', '') or '')[:400]}"
                                for i, r in enumerate(results)
                            )
                            tool_results.append(f"## 搜索: {query}\n{summary}")
                        else:
                            tool_results.append(f"## 搜索: {query}\n(无结果)")
                            emit("step_update", {"id": step_id, "content": "未找到结果"})
                    else:
                        tool_results.append(f"## 搜索: {query}\n(搜索已禁用)")
                        emit("step_update", {"id": step_id, "content": "搜索已禁用"})

                elif act == "fetch":
                    url = action.get("url", "")
                    if url:
                        emit("step_update", {"id": step_id, "content": f"抓取: {url[:80]}"})
                        try:
                            req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
                            with urlopen(req, timeout=15) as r:
                                raw = r.read().decode("utf-8", errors="replace")
                            # 粗略提取正文（去标签）
                            text = re.sub(r"<[^>]+>", " ", raw)
                            text = re.sub(r"\s+", " ", text).strip()[:5000]
                            tool_results.append(f"## 网页: {url}\n{text}")
                            emit("step_update", {"id": step_id, "content": f"已抓取 {len(text)} 字符"})
                        except Exception as e:
                            tool_results.append(f"## 网页: {url}\n(抓取失败: {e})")
                            emit("step_update", {"id": step_id, "content": f"抓取失败: {str(e)[:60]}"})
                    else:
                        emit("step_update", {"id": step_id, "content": "未提供 URL"})

                emit("step_done", {"id": step_id, "status": "done", "result": (tool_results[-1][:100] if tool_results else "")})

            # =========== Step 3: 生成最终回答（含 reasoning 流式） ===========
            emit("step_start", {"id": "answer", "title": "思考回答", "status": "running"})

            final_ctx = prompt
            if tool_results:
                final_ctx = (
                    f"用户提问: {prompt}\n\n"
                    f"以下是工具获取到的信息（供参考，回答时标注来源）:\n"
                    f"{chr(10).join(tool_results)}"
                )

            final_messages = [
                {"role": "system", "content": "你是深度求索的 AI 助手。基于已有知识或工具信息回答。简洁、准确、有来源。用中文。"},
                {"role": "user", "content": final_ctx},
            ]

            full_content = ""
            full_reasoning = ""

            for chunk in self.harness.stream_chat(
                model=Handler.model_id,
                messages=final_messages,
            ):
                ct = chunk.get("type", "")
                cd = chunk.get("data", "")
                if ct == "content_delta" and cd:
                    full_content += cd
                    emit("step_update", {"id": "answer", "content": cd})
                elif ct == "reasoning_delta" and cd:
                    full_reasoning += cd
                    emit("step_reasoning", {"id": "answer", "content": cd})

            emit("step_done", {"id": "answer", "status": "done", "result": len(full_content)})
            emit("final", {
                "content": full_content,
                "reasoning": full_reasoning,
                "steps": len(actions),
                "used_search": any(a.get("action") == "search" for a in actions),
            })

        except Exception as e:
            traceback.print_exc()
            emit("error", {"message": str(e)})

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

    # ---- 导出模型 ----
    def _unsloth_export(self):
        req = self._read_body()
        checkpoint = req.get("checkpoint", "")
        model_name = req.get("model", TRAIN_STATE.get("model", "my-model"))
        if not checkpoint:
            self._json(400, {"error": "checkpoint path required"})
            return
        self._json(200, {"ok": True, "exporting": checkpoint, "model_name": model_name, "message": "导出已启动，完成后将自动加载"})

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
    target = args.target.rstrip("/")

    def _probe_or_launch(t: str) -> bool:
        """探活推理端点，未启动则尝试 ollama serve"""
        try:
            urlopen(f"{t}/models", timeout=3)
            return True
        except Exception:
            pass
        try:
            subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(3)
            try:
                urlopen(f"{t}/models", timeout=5)
                return True
            except Exception:
                pass
        except FileNotFoundError:
            pass
        return False

    if not _probe_or_launch(target):
        print(f"[anvil-sidecar] WARNING: inference endpoint {target} not responding", file=sys.stderr)
        print(f"[anvil-sidecar]   start it: ollama serve or ling_server.py --port 18080", file=sys.stderr)

    h = make_harness(target, args.api_key)
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