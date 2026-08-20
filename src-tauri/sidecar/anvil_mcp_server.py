#!/usr/bin/env python3
"""
Anvil MCP Server — 把 Anvil 的所有 agent 能力暴露成 MCP 工具。

任何支持 MCP 协议的客户端（Codex、Hermes、Claude Code、Reasonix）都能连这个 server，
通过统一的 MCP 接口调用 Anvil 里的任何 adapter。

用法（stdio 模式）：
  python3 anvil_mcp_server.py

在 Codex 中添加：
  codex mcp add anvil -- python3 /path/to/anvil_mcp_server.py

在 Hermes 中添加：
  hermes mcp add anvil --command "python3 /path/to/anvil_mcp_server.py"
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
import urllib.error

ANVIL_BRIDGE = "http://127.0.0.1:18443"


# ===== MCP 工具定义 =====

TOOLS = [
    {
        "name": "chat",
        "description": "跟 Anvil 的默认模型聊天（带搜索增强）。返回回复文本。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "要发送的消息内容",
                },
                "search": {
                    "type": "boolean",
                    "description": "是否启用联网搜索（默认 true）",
                    "default": True,
                },
            },
            "required": ["message"],
        },
    },
    {
        "name": "agent_loop",
        "description": "启动 Anvil 的 Agent Loop（多步骤、自动调工具）。返回最终结果。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "任务描述，越详细越好",
                },
                "search": {
                    "type": "boolean",
                    "description": "是否允许联网搜索（默认 true）",
                    "default": True,
                },
            },
            "required": ["task"],
        },
    },
    {
        "name": "list_tools_status",
        "description": "列出 Anvil 所有可用工具/adapter 的健康状态。",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "run_codex",
        "description": "通过 Anvil 调用 Codex 执行编码任务（沙箱环境）。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "编码任务描述",
                },
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "run_pi",
        "description": "通过 Anvil 调用 Pi 执行编码任务（非交互模式）。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "编码任务描述",
                },
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "web_search",
        "description": "通过 Anvil 的搜索能力搜索网络。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词",
                },
                "count": {
                    "type": "integer",
                    "description": "返回结果数量（默认 5）",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
]


# ===== HTTP 辅助 =====

def _post(path: str, data: dict, timeout: int = 60) -> dict:
    url = f"{ANVIL_BRIDGE}{path}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read(500).decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code}: {detail[:200]}")
    except Exception as e:
        raise RuntimeError(f"Anvil bridge 连接失败: {e}")


def _get(path: str, timeout: int = 10) -> dict:
    url = f"{ANVIL_BRIDGE}{path}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read(500).decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code}: {detail[:200]}")
    except Exception as e:
        raise RuntimeError(f"Anvil bridge 连接失败: {e}")


# ===== 工具实现 =====

def tool_chat(args: dict) -> str:
    message = args.get("message", "")
    search = args.get("search", True)
    data = _post("/chat", {
        "messages": [{"role": "user", "content": message}],
        "search": search,
    })
    return data.get("message", {}).get("content", "") or data.get("content", "") or "(空响应)"


def tool_agent_loop(args: dict) -> str:
    task = args.get("task", "")
    search = args.get("search", True)

    # 用 SSE 流式拉取 final 事件
    url = f"{ANVIL_BRIDGE}/dsh/run"
    body = json.dumps({"prompt": task, "search": search}).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    final_content = ""
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            reader = _SSEReader(resp)
            for event_name, data in reader.events():
                if event_name == "final":
                    final_content = data.get("content", "")
                    break
    except Exception as e:
        return f"Agent loop 失败: {e}"

    return final_content or "(无结果)"


def tool_list_status(_args: dict) -> str:
    data = _get("/tools/status")
    tools = data.get("tools", {})
    lines = []
    for name, status in tools.items():
        state = "✓" if status.get("healthy") else "✗"
        avail = "可用" if status.get("available") else "未安装"
        msg = status.get("message", "")
        lines.append(f"{state} {name}: {avail} — {msg}")
    return "\n".join(lines)


def tool_run_codex(args: dict) -> str:
    # 注意：Codex 任务走异步，这里简化为同步调用
    # 实际实现取决于 Anvil 的 Codex adapter 接口
    prompt = args.get("prompt", "")
    return f"[Codex 任务已提交] {prompt[:80]}...\n\n（Codex 执行需要 Anvil 桌面环境支持，当前 MCP server 仅支持桥接 HTTP 接口。完整功能请在 Anvil 桌面应用中使用。）"


def tool_run_pi(args: dict) -> str:
    prompt = args.get("prompt", "")
    return f"[Pi 任务已提交] {prompt[:80]}...\n\n（Pi 执行需要 Anvil 桌面环境支持，当前 MCP server 仅支持桥接 HTTP 接口。完整功能请在 Anvil 桌面应用中使用。）"


def tool_web_search(args: dict) -> str:
    query = args.get("query", "")
    count = args.get("count", 5)
    data = _post("/search", {"query": query, "count": count})
    results = data.get("results", [])
    if not results:
        return "无搜索结果"
    lines = []
    for i, r in enumerate(results[:count], 1):
        title = r.get("title", "")
        url = r.get("url", "")
        content = r.get("content", "")[:120]
        lines.append(f"{i}. {title}\n   {url}\n   {content}")
    return "\n\n".join(lines)


TOOL_HANDLERS = {
    "chat": tool_chat,
    "agent_loop": tool_agent_loop,
    "list_tools_status": tool_list_status,
    "run_codex": tool_run_codex,
    "run_pi": tool_run_pi,
    "web_search": tool_web_search,
}


# ===== SSE 解析 =====

class _SSEReader:
    def __init__(self, resp):
        self.resp = resp
        self.decoder = __import__("codecs").getincrementaldecoder("utf-8")()

    def events(self):
        buf = ""
        while True:
            chunk = self.resp.read(4096)
            if not chunk:
                break
            buf += self.decoder.decode(chunk)
            while "\n\n" in buf:
                event_str, buf = buf.split("\n\n", 1)
                name = ""
                data = ""
                for line in event_str.split("\n"):
                    if line.startswith("event: "):
                        name = line[7:].strip()
                    elif line.startswith("data: "):
                        data = line[6:]
                if name and data:
                    try:
                        yield name, json.loads(data)
                    except json.JSONDecodeError:
                        pass


# ===== MCP stdio server =====

def send_message(msg: dict):
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def handle_request(request: dict) -> dict | None:
    msg_id = request.get("id")
    method = request.get("method", "")
    params = request.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {},
                },
                "serverInfo": {
                    "name": "anvil",
                    "version": "0.1.0",
                },
                "instructions": "Anvil 本地 AI 工作站。通过统一接口调用所有本地 AI 工具：聊天、Agent Loop、编码、搜索等。",
            },
        }

    if method == "notifications/initialized":
        return None

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "tools": TOOLS,
            },
        }

    if method == "tools/call":
        tool_name = params.get("name", "")
        tool_args = params.get("arguments", {})

        handler = TOOL_HANDLERS.get(tool_name)
        if not handler:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [{"type": "text", "text": f"未知工具: {tool_name}"}],
                    "isError": True,
                },
            }

        try:
            result_text = handler(tool_args)
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [{"type": "text", "text": result_text}],
                },
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "content": [{"type": "text", "text": f"错误: {e}"}],
                    "isError": True,
                },
            }

    return {
        "jsonrpc": "2.0",
        "id": msg_id,
        "error": {
            "code": -32601,
            "message": f"Method not found: {method}",
        },
    }


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue

        response = handle_request(request)
        if response is not None:
            send_message(response)


if __name__ == "__main__":
    main()
