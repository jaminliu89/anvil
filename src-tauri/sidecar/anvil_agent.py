#!/usr/bin/env python3
"""
Anvil Agent Engine — 多轮工具循环 + 注册表
直接用 SSE 调用模型，绕过 harness 的过滤，拿到完整 tool_calls。
保持 SSE 事件协议不变，前端零改动。
"""
import json
import re
import subprocess
import os
import time
from urllib.request import Request, urlopen


# ===== 工具注册表 =====
TOOLS = {}

def register_tool(name, description, parameters, fn):
    TOOLS[name] = {
        "name": name,
        "description": description,
        "parameters": parameters,
        "fn": fn,
    }

def _format_tools_schema():
    schema = []
    for name, t in TOOLS.items():
        props = {}
        required = []
        for pname, pinfo in t["parameters"].items():
            ptype = pinfo.get("type", "string")
            type_map = {"string": "string", "number": "number", "int": "integer",
                       "boolean": "boolean", "array": "array", "object": "object"}
            json_type = type_map.get(ptype, ptype)
            props[pname] = {"type": json_type, "description": pinfo.get("description", "")}
            if pinfo.get("required"):
                required.append(pname)
        schema.append({
            "type": "function",
            "function": {
                "name": name,
                "description": t["description"],
                "parameters": {"type": "object", "properties": props, "required": required},
            },
        })
    return schema


# ===== 内置工具 =====

def tool_search(params):
    query = params.get("query", "")
    count = min(int(params.get("count", 5)), 10)
    try:
        from bridge import _tavily_search
        results = _tavily_search(query, count)
    except ImportError:
        results = []
    if not results:
        return f"搜索 '{query}' 无结果"
    lines = [f"搜索结果 ({len(results)} 条):"]
    for i, r in enumerate(results):
        title = r.get("title", "")
        url = r.get("url", "")
        content = (r.get("content", "") or "")[:500]
        lines.append(f"[{i+1}] {title}\n   来源: {url}\n   {content}")
    return "\n\n".join(lines)

def tool_fetch(params):
    url = params.get("url", "")
    if not url:
        return "错误: 缺少 url 参数"
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 Anvil/1.0"})
        with urlopen(req, timeout=20) as r:
            raw = r.read().decode("utf-8", errors="replace")
        text = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        max_len = int(params.get("max_length", 8000))
        if len(text) > max_len:
            text = text[:max_len] + f"\n... (已截断，完整 {len(text)} 字符)"
        return f"网页 {url} 内容：\n{text}"
    except Exception as e:
        return f"抓取失败: {e}"

def tool_shell(params):
    cmd = params.get("command", "")
    if not cmd:
        return "错误: 缺少 command 参数"
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True,
            timeout=30, cwd=os.path.expanduser("~"),
        )
        output = result.stdout[-3000:] if result.stdout else ""
        err = result.stderr[-500:] if result.stderr else ""
        parts = []
        if output:
            parts.append(f"输出:\n{output}")
        if err:
            parts.append(f"错误:\n{err}")
        parts.append(f"退出码: {result.returncode}")
        return "\n".join(parts)
    except subprocess.TimeoutExpired:
        return "命令执行超时（30 秒）"
    except Exception as e:
        return f"执行失败: {e}"

def tool_read_file(params):
    path = os.path.expanduser(params.get("path", ""))
    if not path:
        return "错误: 缺少 path 参数"
    try:
        with open(path, "r", errors="replace") as f:
            content = f.read()
        if len(content) > 10000:
            content = content[:10000] + f"\n... (已截断，共 {len(content)} 字符)"
        return f"文件 {path} 内容：\n{content}"
    except Exception as e:
        return f"读取失败: {e}"

def tool_write_file(params):
    path = os.path.expanduser(params.get("path", ""))
    content = params.get("content", "")
    if not path:
        return "错误: 缺少 path 参数"
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w") as f:
            f.write(content)
        return f"已写入 {path}（{len(content)} 字符）"
    except Exception as e:
        return f"写入失败: {e}"


def register_default_tools():
    TOOLS.clear()
    register_tool("search", "联网搜索，获取最新信息。需要实时数据、新闻、天气、查资料时使用。",
        {"query": {"type": "string", "required": True, "description": "搜索关键词"},
         "count": {"type": "number", "required": False, "description": "返回结果数量，默认 5"}},
        tool_search)
    register_tool("fetch", "抓取指定网页的完整正文（去标签纯文本）。已知 URL 时用。",
        {"url": {"type": "string", "required": True, "description": "网页地址"}},
        tool_fetch)
    register_tool("shell", "执行 shell 命令（macOS 终端）。用于操作文件系统、运行程序、查询系统状态等。",
        {"command": {"type": "string", "required": True, "description": "要执行的 shell 命令"}},
        tool_shell)
    register_tool("read_file", "读取本地文件的内容。",
        {"path": {"type": "string", "required": True, "description": "文件路径，可以用 ~ 表示用户目录"}},
        tool_read_file)
    register_tool("write_file", "写入内容到本地文件。文件不存在则创建，存在则覆盖。",
        {"path": {"type": "string", "required": True, "description": "文件路径"},
         "content": {"type": "string", "required": True, "description": "要写入的完整内容"}},
        tool_write_file)


# ===== SSE 流式调用（原生，绕开 harness 过滤） =====

def stream_chat(base_url, api_key, model, messages, tools=None, tool_choice="auto"):
    """原生 SSE 流式调用，生成 dict chunk。
    Yields: {'type': 'reasoning_delta'|'content_delta', 'data': '...'}
    以及最终汇总: {'final': True, 'content': '...', 'reasoning': '...', 'tool_calls': [...]}
    """
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "max_tokens": 4096,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = tool_choice

    req = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    content = ""
    reasoning = ""
    tool_calls_buf = {}  # idx -> {id, name, arguments}

    with urlopen(req, timeout=300) as resp:
        buffer = ""
        for line_bytes in resp:
            line = line_bytes.decode("utf-8", errors="replace").rstrip("\n\r")
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    obj = json.loads(data)
                except json.JSONDecodeError:
                    continue

                choices = obj.get("choices", [])
                if not choices:
                    continue
                delta = choices[0].get("delta", {})

                # 推理内容
                if "reasoning_content" in delta and delta["reasoning_content"]:
                    reasoning += delta["reasoning_content"]
                    yield {"type": "reasoning_delta", "data": delta["reasoning_content"]}

                # 正文内容
                if "content" in delta and delta["content"]:
                    content += delta["content"]
                    yield {"type": "content_delta", "data": delta["content"]}

                # 工具调用
                if "tool_calls" in delta and delta["tool_calls"]:
                    for tc in delta["tool_calls"]:
                        idx = tc.get("index", 0)
                        if idx not in tool_calls_buf:
                            tool_calls_buf[idx] = {"id": tc.get("id", ""), "name": "", "arguments": ""}
                        if "function" in tc:
                            fn = tc["function"]
                            if "name" in fn and fn["name"]:
                                tool_calls_buf[idx]["name"] = fn["name"]
                            if "arguments" in fn and fn["arguments"]:
                                tool_calls_buf[idx]["arguments"] += fn["arguments"]

    tool_calls = list(tool_calls_buf.values())
    yield {
        "final": True,
        "content": content,
        "reasoning": reasoning,
        "tool_calls": tool_calls,
    }


# ===== Agent Loop 主逻辑 =====

def run_agent_loop(base_url, api_key, model, prompt, emit_fn, use_search=True, max_rounds=12):
    """
    ReAct 式多轮 agent loop。
    emit_fn(evt, data) — SSE 发射函数
    """
    register_default_tools()
    tools_schema = _format_tools_schema()

    sys_prompt = """你是 Anvil，不是普通的 AI 助手。你是用户的顶级产品架构师、产品经理、创业顾问、贴心助理、文案师、运营助理、爆款制造机。

你的核心价值：把用户的一句话变成真正完成的交付物。

铁律（按顺序执行）：
1. 项目开始 → 直接给出具体可执行的计划：做什么、用什么工具、产出什么、怎么验证。不等用户重复，不泛泛而谈
2. MVP 闭环（默认模式）→ 用户给一个需求，专注做到"能用"。不主动发散、不加多余功能、不画大饼
3. 编程任务必须闭环 → 写代码 → 运行验证 → 报错就修 → 再验证，循环直到交付物真的能跑通，不能"写完就交差"
4. Roadmap 门 → 只有用户明确说"加功能/继续拓展/下一步规划"时，才展开 roadmap。其余时间聚焦
5. 角色自动切换 → 内容创作用文案师/爆款制造机思路，商业问题用创业顾问思路，产品问题用产品架构师思路，运营问题用运营助理思路。自动判断，不需要用户指定

工具规则：
- 需要实时信息就 search，不要凭记忆编造
- 操作文件或系统就用 write_file / read_file / shell
- 写代码必须用 write_file 落盘 + shell 运行验证
- 所有回答用中文，完整、准确、有结构
- 最多进行 12 轮工具调用"""

    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": prompt},
    ]

    tool_calls_count = 0
    used_search = False
    full_reasoning = ""
    final_answer = ""

    for round_num in range(max_rounds):
        round_id = f"round_{round_num}"
        emit_fn("step_start", {"id": round_id, "title": f"第 {round_num + 1} 轮", "status": "running"})

        final_data = None
        try:
            for chunk in stream_chat(
                base_url=base_url,
                api_key=api_key,
                model=model,
                messages=messages,
                tools=tools_schema,
            ):
                if chunk.get("final"):
                    final_data = chunk
                elif chunk["type"] == "reasoning_delta":
                    full_reasoning += chunk["data"]
                    emit_fn("step_reasoning", {"id": round_id, "content": chunk["data"]})
                elif chunk["type"] == "content_delta":
                    emit_fn("step_update", {"id": round_id, "content": chunk["data"]})
        except Exception as e:
            emit_fn("step_done", {"id": round_id, "status": "failed", "result": str(e)})
            final_answer = f"执行出错: {e}"
            break

        if not final_data:
            final_answer = "无响应"
            break

        tool_calls = final_data.get("tool_calls", [])

        if tool_calls:
            # 组装 assistant 消息
            assistant_msg = {
                "role": "assistant",
                "content": final_data.get("content", ""),
                "tool_calls": [],
            }
            for tc in tool_calls:
                assistant_msg["tool_calls"].append({
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments"]},
                })
            messages.append(assistant_msg)

            # 逐个执行工具
            for tc in tool_calls:
                tool_name = tc["name"]
                try:
                    tool_args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                except json.JSONDecodeError:
                    tool_args = {}

                if tool_name == "search" and not use_search:
                    tool_output = "搜索已被禁用"
                elif tool_name in TOOLS:
                    emit_fn("step_update", {"id": round_id, "content": f"\n▶ 调用工具: {tool_name}"})
                    try:
                        tool_output = TOOLS[tool_name]["fn"](tool_args)
                    except Exception as e:
                        tool_output = f"工具执行出错: {e}"
                    if tool_name == "search":
                        used_search = True
                    tool_calls_count += 1
                else:
                    tool_output = f"未知工具: {tool_name}"

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": tool_output if isinstance(tool_output, str) else json.dumps(tool_output, ensure_ascii=False),
                })

            emit_fn("step_done", {"id": round_id, "status": "done", "result": f"调用 {len(tool_calls)} 个工具"})

        else:
            # 没有工具调用 = 最终回答
            final_answer = final_data.get("content", "")
            full_reasoning = final_data.get("reasoning", "")
            emit_fn("step_done", {"id": round_id, "status": "done", "result": "已完成"})
            break

    else:
        final_answer = final_data.get("content", "") if final_data else "任务超出最大轮次"

    emit_fn("step_start", {"id": "answer", "title": "最终回答", "status": "running"})
    emit_fn("step_done", {"id": "answer", "status": "done", "result": f"{len(final_answer)} 字符"})
    emit_fn("final", {
        "content": final_answer,
        "reasoning": full_reasoning,
        "steps": tool_calls_count + 1,
        "tool_calls": tool_calls_count,
        "used_search": used_search,
    })


if __name__ == "__main__":
    print("Anvil Agent Engine — imported by bridge.py")
