# Anvil

**本地 AI 控制中心。一个桌面 App 管你机器上的所有 AI 能力。**

Anvil 不是又一个 AI 聊天工具。它是编排层——把推理、编码 agent、训练、agent 框架全部纳入一个桌面窗口，每种工具保留自己的独特能力。

## 它能做什么

你机器上跑着多个 AI 工具：本地模型、云 API、编码 agent、训练平台。每个有自己的入口、自己的终端窗口、自己的交互方式。

Anvil 给它们一个统一的桌面界面：

- **聊天** — 跟本地模型对话（Ling-3.0-tiny / DeepSeek API / Unsloth）
- **编码** — 调 pi / codex / Reasonix 改代码，结果直接返回聊天
- **异步派发** — 派任务给 dock，后台改完通知你
- **训练** — 连 Unsloth Desktop 做 LoRA 微调
- **Agent 框架** — 集成 DeepSeek Harness 的插件生态

所有交互发生在同一条时间线上，不分页、不切窗口。

## 快速开始

```bash
git clone https://github.com/jaminliu89/anvil.git
cd anvil
npm install
cd src-tauri && cargo build --release
```

前提：Ling-3.0-tiny (128080) 和 / 或 Unsloth Desktop (18888) 已在运行。

## 为什么不是...

- **...Jules 网页版？** Jules 把你的代码上传到 Google Cloud VM。Anvil 全部本地。
- **...Open WebUI？** Open WebUI 是 Ollama 的聊天界面。Anvil 管的不只是聊天——它还管编码 agent、训练、异步派发。
- **...DeepSeek Harness 的 Web UI？** dsh 是一个 agent 框架，有自己的 Web UI。Anvil 是桌面端编排层，把 dsh 和其他工具整合到一个窗口里。
- **...在终端里直接调 pi / codex？** 你可以继续在终端里调。Anvil 不取代它们——它给你一个统一的图形界面来监控和编排。

## 架构

```
Anvil (Tauri 2 + Vue 3)
├── Timeline — 统一会话流（聊天 + 计划 + 执行日志 + diff）
├── Command Bar — /dock /reasonix /pi /codex /train
├── Adapter Registry — 每个工具一个适配器
└── DSH Bridge — 推理底座 + 守卫 + 健康检查

后端：DSH Bridge (Python sidecar, :18443)
引擎：Ling-3.0-tiny / DeepSeek API / Unsloth / dock / pi / codex / Reasonix
```

## 适配器

Anvil 通过适配器连接每种工具。适配器不是薄封装——它把工具的独特能力翻译成 Timeline 里的交互：

| 适配器 | 命令 | 独特能力 |
|--------|------|---------|
| Ling-3.0-tiny | 默认聊天 | 本地离线推理 + reasoning 折叠 |
| DeepSeek API | 默认聊天（可选） | 云端推理 + 缓存 |
| dock | /dock | 异步编码 session + worktree 隔离 + 审批 |
| Reasonix | /reasonix | 前缀缓存 + 子智能体 + MCP + 计划模式 |
| pi | /pi | 非交互编码执行 |
| codex | /codex | 沙箱执行 + 配额管理 |
| DeepSeek Harness | /dsh | agent loop + 插件生态 |
| Unsloth | /train | LoRA 微调 + 模型导出 |

## 协议

MIT