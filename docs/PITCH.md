# Anvil — 本地 AI 工作台

把碎片化的本地 AI 工具链，
集成到一个桌面里。

---

## 痛点

本地 AI 圈现状——

你装了一个模型，一个训练工具，一个 Agent 框架。
三个不同的端口，三个不同的启动方式，三套不同的配置。
每次切换大脑要在终端里敲一串命令。
训练和推理是两套独立的流程，互相不知道对方存在。

碎片化。

## 方案

Anvil 把这三件事集成到一个桌面应用里：

**推理** — 对接 llama.cpp 集群，ChatView 流式对话带思考折叠
**训练** — Unsloth Desktop 集成，检查点管理一键打开
**Agent** — Claude Code / Codex / Hermes 等编码 Agent 一键启动

再加一个 DSH 守卫侧车——自动做健康检查、故障恢复、大脑切换。LLM 挂了它接管决策，不用人盯着。

## 为什么是 Anvil

名字来自锻造——本地模型是粗坯，训练是锻造，Agent 是锤击。

Anvil 不是又一个模型管理器。它是一个工作台——你把模型、训练、Agent 放上去，它负责让它们协同工作。

## 谁需要它

- 做 AI 内容工具开发的（自媒体、视频生成、写作工具）
- 在本地跑模型做 R&D 的（不想依赖云端 API）
- 用编码 Agent 每天写代码的（本地推理零成本）
- 做模型微调的（Unsloth 用户）

## 当前状态

v0.3 开发中。功能路线：

- ChatView → v0.1 可用
- RuntimeView + GuardView → v0.2 可用
- TrainView + ConnectView → v0.3 开发中
- 训练任务编排 + 完整打包 → v0.4

## 不做什么

- 不做模型商店（去 Unsloth / Hugging Face 下载）
- 不做云端推理（Anvil 是本地工具）
- 不做 LLM 评测（那是别人的事）
- 不做花哨 UI（Parchment 暖石系，功能区分靠颜色不是装饰）

---

GitHub: github.com/jaminliu89/anvil