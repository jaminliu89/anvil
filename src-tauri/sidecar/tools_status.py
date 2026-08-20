"""Anvil 工具健康检查模块。

所有外部工具的真实探活函数 + 统一入口。
bridge.py 里 from tools_status import get_tools_status, TOOL_PROBES
"""
from __future__ import annotations

import os
import shutil
import subprocess
import time
from urllib.request import urlopen, Request
from urllib.error import URLError

_STATUS_CACHE: dict = {}
_STATUS_CACHE_TTL = 60  # 秒

BRIDGE_BASE = "http://127.0.0.1:18443"

# ===== 探活函数 =====

def _probe_codex() -> dict:
    """Codex: 检查 CLI + 认证状态 + 额度。"""
    if not shutil.which('codex'):
        return {'available': False, 'healthy': False, 'message': 'codex CLI 未安装'}
    try:
        r = subprocess.run(
            ['codex', 'exec', '--sandbox', 'danger-full-access', 'echo ok'],
            capture_output=True, text=True, timeout=30,
            cwd=os.getcwd() or '/tmp',
        )
        output = r.stdout + r.stderr
        if 'usage limit' in output.lower() or 'hit your usage' in output.lower():
            return {'available': True, 'healthy': False, 'message': '额度已用完'}
        if r.returncode == 0 and 'ok' in output.lower():
            return {'available': True, 'healthy': True, 'message': 'codex 就绪'}
        # 提取错误
        for line in output.split('\n'):
            if 'ERROR' in line or 'error' in line:
                msg = line.strip()[:120]
                return {'available': True, 'healthy': False, 'message': msg}
        return {'available': True, 'healthy': False, 'message': '执行失败'}
    except Exception as e:
        return {'available': True, 'healthy': False, 'message': f'探活失败: {type(e).__name__}'}


def _probe_pi() -> dict:
    """Pi: 检查 CLI + 主 provider 连通性。"""
    if not shutil.which('pi'):
        return {'available': False, 'healthy': False, 'message': 'pi CLI 未安装'}
    try:
        r = subprocess.run(
            ['pi', '-p', '回复ok'],
            capture_output=True, text=True, timeout=30,
            cwd='/tmp',
        )
        if r.returncode == 0 and r.stdout.strip():
            return {'available': True, 'healthy': True, 'message': 'pi 就绪'}
        err = (r.stderr or r.stdout or '').strip().split('\n')[-1][:120]
        return {'available': True, 'healthy': False, 'message': err or 'pi 执行失败'}
    except Exception as e:
        return {'available': True, 'healthy': False, 'message': f'探活失败: {type(e).__name__}'}


def _probe_reasonix() -> dict:
    """Reasonix: 检查 CLI 是否安装。"""
    if not shutil.which('reasonix'):
        return {'available': False, 'healthy': False, 'message': 'reasonix CLI 未安装'}
    try:
        r = subprocess.run(
            ['reasonix', '--version'],
            capture_output=True, text=True, timeout=10,
        )
        if r.returncode == 0:
            return {'available': True, 'healthy': True, 'message': f'reasonix {r.stdout.strip()[:30]}'}
        return {'available': True, 'healthy': False, 'message': '版本检查失败'}
    except Exception as e:
        return {'available': True, 'healthy': False, 'message': f'探活失败: {type(e).__name__}'}


def _probe_claude() -> dict:
    if not shutil.which('claude'):
        return {'available': False, 'healthy': False, 'message': 'claude CLI 未安装'}
    return {'available': True, 'healthy': True, 'message': 'claude CLI 已安装'}


def _probe_hermes() -> dict:
    if not shutil.which('hermes'):
        return {'available': False, 'healthy': False, 'message': 'hermes CLI 未安装'}
    return {'available': True, 'healthy': True, 'message': 'hermes CLI 已安装'}


def _probe_dock() -> dict:
    """Dock: 检查 dock CLI 是否可用。"""
    if not shutil.which('dock'):
        return {'available': False, 'healthy': False, 'message': 'dock CLI 未安装'}
    return {'available': True, 'healthy': True, 'message': 'dock CLI 已安装'}


def _probe_jules() -> dict:
    if not shutil.which('jules'):
        return {'available': False, 'healthy': False, 'message': 'jules CLI 未安装'}
    return {'available': True, 'healthy': True, 'message': 'jules CLI 已安装'}


def _probe_openclaw() -> dict:
    if not shutil.which('openclaw'):
        return {'available': False, 'healthy': False, 'message': 'openclaw CLI 未安装'}
    return {'available': True, 'healthy': True, 'message': 'openclaw CLI 已安装'}


def _probe_antigravity() -> dict:
    if not shutil.which('agy'):
        return {'available': False, 'healthy': False, 'message': 'agy CLI 未安装'}
    return {'available': True, 'healthy': True, 'message': 'agy CLI 已安装'}


def _probe_dsh() -> dict:
    """DSH: 检查 bridge /health 端点。"""
    try:
        with urlopen(f"{BRIDGE_BASE}/health", timeout=2) as r:
            if r.status == 200:
                return {'available': True, 'healthy': True, 'message': 'bridge 运行中'}
        return {'available': True, 'healthy': False, 'message': f'HTTP {r.status}'}
    except Exception:
        return {'available': False, 'healthy': False, 'message': 'bridge 未启动'}


def _probe_ling() -> dict:
    """Ling: 检查本地模型推理端点。"""
    try:
        with urlopen("http://127.0.0.1:18080/v1/models", timeout=2) as r:
            if r.status == 200:
                return {'available': True, 'healthy': True, 'message': '本地模型运行中'}
        return {'available': True, 'healthy': False, 'message': f'HTTP {r.status}'}
    except Exception:
        return {'available': False, 'healthy': False, 'message': '本地模型未启动'}


def _probe_ollama() -> dict:
    """Ollama: 检查本地 Ollama 端点。"""
    try:
        with urlopen("http://127.0.0.1:11434/api/tags", timeout=2) as r:
            if r.status == 200:
                return {'available': True, 'healthy': True, 'message': 'ollama 运行中'}
        return {'available': True, 'healthy': False, 'message': f'HTTP {r.status}'}
    except Exception:
        # 再试 CLI 是否安装
        if shutil.which('ollama'):
            return {'available': True, 'healthy': False, 'message': 'ollama 已安装但未启动'}
        return {'available': False, 'healthy': False, 'message': 'ollama 未安装'}


def _probe_unsloth() -> dict:
    """Unsloth: 检查 Unsloth Desktop 端点。"""
    try:
        with urlopen("http://127.0.0.1:8888/api/health", timeout=2) as r:
            if r.status == 200:
                return {'available': True, 'healthy': True, 'message': 'unsloth 运行中'}
        return {'available': True, 'healthy': False, 'message': f'HTTP {r.status}'}
    except Exception:
        if shutil.which('unsloth'):
            return {'available': True, 'healthy': False, 'message': 'unsloth 已安装但未启动'}
        return {'available': False, 'healthy': False, 'message': 'unsloth 未安装'}


def _probe_volc_coding() -> dict:
    """火山 CodingPlan: 检查 key + 端点连通性。"""
    # key 三路兜底
    key = os.environ.get("VOLC_ARK_CODING_KEY", "")
    if not key:
        for path in (os.path.expanduser("~/.hermes/.env"), os.path.expanduser("~/.zshrc")):
            try:
                with open(path) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("VOLC_ARK_CODING_KEY=") or line.startswith("export VOLC_ARK_CODING_KEY="):
                            key = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
                if key:
                    break
            except OSError:
                continue
    if not key:
        return {'available': False, 'healthy': False, 'message': 'VOLC_ARK_CODING_KEY 未配置'}

    try:
        import json as _json
        payload = _json.dumps({
            "model": "ark-code-latest",
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 4,
        }).encode()
        req = Request(
            "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
            },
        )
        with urlopen(req, timeout=15) as r:
            if r.status == 200:
                return {'available': True, 'healthy': True, 'message': 'CodingPlan 就绪'}
        return {'available': True, 'healthy': False, 'message': f'HTTP {r.status}'}
    except Exception as e:
        return {'available': True, 'healthy': False, 'message': f'探活失败: {type(e).__name__}'}


# ===== 注册表 =====

TOOL_PROBES = {
    'codex': _probe_codex,
    'pi': _probe_pi,
    'reasonix': _probe_reasonix,
    'claude': _probe_claude,
    'hermes': _probe_hermes,
    'dock': _probe_dock,
    'jules': _probe_jules,
    'openclaw': _probe_openclaw,
    'antigravity': _probe_antigravity,
    'dsh': _probe_dsh,
    'ling': _probe_ling,
    'ollama': _probe_ollama,
    'unsloth': _probe_unsloth,
    'volc-coding': _probe_volc_coding,
}


def get_tools_status(force: bool = False) -> dict:
    """获取所有工具状态，带缓存。"""
    now = time.time()
    result = {}
    for name, probe_fn in TOOL_PROBES.items():
        cached = _STATUS_CACHE.get(name)
        if not force and cached and (now - cached['ts']) < _STATUS_CACHE_TTL:
            result[name] = cached['data']
        else:
            try:
                data = probe_fn()
            except Exception as e:
                data = {'available': False, 'healthy': False, 'message': str(e)}
            _STATUS_CACHE[name] = {'ts': now, 'data': data}
            result[name] = data
    return result
