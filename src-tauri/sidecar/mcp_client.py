"""
Anvil MCP Client Manager — 管理多个 MCP server 连接。

支持 stdio 模式的 MCP server。统一 HTTP API 让前端调用：
  GET  /mcp/servers          列出所有已配置的 server
  POST /mcp/connect/<name>   连接一个 server
  POST /mcp/disconnect/<name> 断开
  GET  /mcp/tools/<name>     列出某个 server 的工具
  POST /mcp/call/<name>/<tool>  调用工具

实现说明：直接用 subprocess + 手动 JSON-RPC over stdio，绕开 mcp SDK 的
stdio_client（anyio 内存流在 asyncio 下会卡住 initialize）。

配置文件：~/.anvil/mcp_servers.json
格式：
{
  "servers": {
    "my-server": {
      "command": "python3",
      "args": ["/path/to/server.py"],
      "env": {"MY_VAR": "value"}
    }
  }
}
"""
from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from typing import Any


CONFIG_DIR = os.path.expanduser("~/.anvil")
CONFIG_FILE = os.path.join(CONFIG_DIR, "mcp_servers.json")

# 协议版本
MCP_PROTOCOL_VERSION = "2024-11-05"


class MCPServerConnection:
    """单个 MCP server 的连接管理（subprocess + 手动 JSON-RPC）。"""

    def __init__(self, name: str, command: str, args: list[str] | None = None,
                 env: dict[str, str] | None = None):
        self.name = name
        self.command = command
        self.args = args or []
        self.env = env or {}
        self.connected = False
        self.tools: list[dict] = []
        self.error: str | None = None
        self._proc: subprocess.Popen | None = None
        self._lock = threading.Lock()
        self._next_id = 1
        self._pending: dict[int, dict] = {}

    # ---- 进程管理 ----
    def _spawn(self) -> subprocess.Popen:
        full_env = {**os.environ, **self.env}
        proc = subprocess.Popen(
            [self.command] + self.args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=full_env,
            text=True,
            bufsize=1,
        )
        return proc

    def _reader_loop(self):
        """后台线程：读 stdout，按 JSON-RPC 协议分发响应。"""
        proc = self._proc
        if not proc or not proc.stdout:
            return
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                # 忽略非 JSON 行（server 可能打印日志到 stdout）
                continue
            if "id" in msg:
                # 这是对请求的响应
                with self._lock:
                    pending = self._pending.get(msg.get("id"))
                if pending:
                    pending["result"] = msg
                    pending["event"].set()
            # 通知类消息（server → client）忽略

    def _request(self, method: str, params: dict | None = None, timeout: float = 30) -> dict:
        """发 JSON-RPC 请求，等待响应。"""
        if not self._proc or not self._proc.stdin:
            raise RuntimeError("not connected")
        with self._lock:
            req_id = self._next_id
            self._next_id += 1
            evt = threading.Event()
            self._pending[req_id] = {"event": evt, "result": None}
        payload = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            payload["params"] = params
        self._proc.stdin.write(json.dumps(payload) + "\n")
        self._proc.stdin.flush()
        evt.wait(timeout)
        with self._lock:
            pending = self._pending.pop(req_id, None)
        if not pending or not pending.get("result"):
            raise TimeoutError(f"request {method} timed out")
        result = pending["result"]
        if "error" in result:
            raise RuntimeError(f"server error: {result['error']}")
        return result.get("result", {})

    def _notify(self, method: str, params: dict | None = None):
        """发 JSON-RPC 通知（无响应）。"""
        if not self._proc or not self._proc.stdin:
            return
        payload = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            payload["params"] = params
        try:
            self._proc.stdin.write(json.dumps(payload) + "\n")
            self._proc.stdin.flush()
        except (BrokenPipeError, ValueError):
            pass

    # ---- 公共 API ----
    def connect(self) -> bool:
        try:
            self._proc = self._spawn()
            # 启动读线程
            t = threading.Thread(target=self._reader_loop, daemon=True)
            t.start()
            # 1. initialize
            init = self._request(
                "initialize",
                {
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {"name": "anvil", "version": "0.1.0"},
                },
                timeout=15,
            )
            # 2. initialized 通知
            self._notify("notifications/initialized")
            # 3. 拉工具列表
            try:
                tools_result = self._request("tools/list", timeout=15)
                self.tools = [
                    {
                        "name": t.get("name", ""),
                        "description": t.get("description", "") or "",
                        "inputSchema": t.get("inputSchema", {}) or {},
                    }
                    for t in tools_result.get("tools", [])
                ]
            except TimeoutError:
                self.tools = []
            self.connected = True
            self.error = None
            return True
        except Exception as e:
            self.error = str(e)
            self.connected = False
            self._cleanup()
            return False

    def disconnect(self):
        self._cleanup()
        self.connected = False

    def _cleanup(self):
        if self._proc:
            try:
                self._proc.terminate()
                self._proc.wait(timeout=3)
            except Exception:
                try:
                    self._proc.kill()
                except Exception:
                    pass
            self._proc = None

    def call_tool(self, tool_name: str, arguments: dict | None = None, timeout: float = 120) -> dict:
        if not self.connected or not self._proc:
            return {"error": "not connected"}
        try:
            result = self._request(
                "tools/call",
                {"name": tool_name, "arguments": arguments or {}},
                timeout=timeout,
            )
            # 提取文本内容
            content_text = ""
            is_error = bool(result.get("isError", False))
            for content in result.get("content", []):
                if content.get("type") == "text":
                    content_text += content.get("text", "")
                elif "text" in content:
                    content_text += str(content.get("text", ""))
            return {"content": content_text, "isError": is_error}
        except Exception as e:
            return {"error": str(e)}


class MCPManager:
    """全局 MCP 连接管理器。"""

    def __init__(self):
        self._servers: dict[str, MCPServerConnection] = {}
        self._config = self._load_config()
        for name, cfg in self._config.get("servers", {}).items():
            self._servers[name] = MCPServerConnection(
                name=name,
                command=cfg.get("command", ""),
                args=cfg.get("args", []),
                env=cfg.get("env", {}),
            )

    def _load_config(self) -> dict:
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE) as f:
                    return json.load(f)
        except Exception:
            pass
        return {"servers": {}}

    def _save_config(self):
        try:
            os.makedirs(CONFIG_DIR, exist_ok=True)
            config = {"servers": {}}
            for name, srv in self._servers.items():
                config["servers"][name] = {
                    "command": srv.command,
                    "args": srv.args,
                    "env": srv.env,
                }
            with open(CONFIG_FILE, "w") as f:
                json.dump(config, f, indent=2)
        except Exception:
            pass

    def list_servers(self) -> list[dict]:
        return [
            {
                "name": s.name,
                "connected": s.connected,
                "tools_count": len(s.tools),
                "error": s.error,
                "command": s.command,
            }
            for s in self._servers.values()
        ]

    def add_server(self, name: str, command: str, args: list[str] | None = None,
                   env: dict[str, str] | None = None) -> bool:
        if name in self._servers:
            return False
        self._servers[name] = MCPServerConnection(name, command, args or [], env or {})
        self._save_config()
        return True

    def remove_server(self, name: str) -> bool:
        if name not in self._servers:
            return False
        srv = self._servers.pop(name)
        srv.disconnect()
        self._save_config()
        return True

    def connect(self, name: str) -> bool:
        srv = self._servers.get(name)
        if not srv:
            return False
        return srv.connect()

    def disconnect(self, name: str) -> bool:
        srv = self._servers.get(name)
        if not srv:
            return False
        srv.disconnect()
        return True

    def get_tools(self, name: str) -> list[dict]:
        srv = self._servers.get(name)
        if not srv:
            return []
        return srv.tools

    def call_tool(self, name: str, tool: str, arguments: dict | None = None, timeout: float = 120) -> dict:
        srv = self._servers.get(name)
        if not srv:
            return {"error": f"server '{name}' not found"}
        return srv.call_tool(tool, arguments, timeout=timeout)


# 单例
_manager: MCPManager | None = None


def get_manager() -> MCPManager:
    global _manager
    if _manager is None:
        _manager = MCPManager()
    return _manager
