# Anvil · PRD (Product Requirements Document)

> 本地 AI 工作站 · 用户唯一入口 · 零术语极简 UI · Parchment 设计系统

---

## 1. 产品定义与核心价值

Anvil 是一台**「本地 AI 工作站」**：用户打开它就能进行流式对话、调节性能、微调模型、连接 Agent。
所有专业能力（推理引擎、协议守卫、训练管线、Agent 桥接）被隐匿在后端，用户只需通过高颜值的暖纸界面进行操控。

**一句话定位**：开发者与内容创作者获得本地 AI 的全部能力，一行命令行都不用敲。

---

## 2. 核心架构与模块分工 (v2 定版)

```
┌─ Anvil（唯一桌面入口，Parchment 暖纸视觉）──────────┐
│ 普通模式：对话 · AI 引擎 · 设置                   │
│ 高级模式：+ 训练工坊 · Agent 连接 · 守卫面板        │
│                                                     │
│ DSH Guard（守卫侧车：协议加固 + 自动抢救）         │
└──────────────┬──────────────────────┬───────────────┘
               ▼                      ▼
        主力推理大脑 (:18080)   训练工坊大脑 (:8888)
```

---

## 3. 零术语设计宪法 (UI 禁用词表)

| 禁用词 (Forbidden Term) | 替换词 (Product Term) |
|---|---|
| `llama-server` / `Endpoint` | **AI 大脑 / 引擎** |
| `Temperature` / `ngl` | **思考能力 / 发散度** |
| `ctx_size` / `Context` | **记忆长度** |
| `GGUF` / `Model file` | **模型文件** |
| `Sidecar` / `Harness` | **守卫服务** |
| `Token` / `Usage` | **预计消耗 / 耗时** |
| `API Key` / `Bearer` | **安全钥匙** |
| `LoRA Fine-tuning` | **训练工坊** |

---

## 4. 视图规格与交互定义

### 4.1 对话页 (`/`)
- 消息流：Markdown 格式化、气泡分层。
- 思考过程折叠条：实时提取 DeepSeek/Llama `<think>` 推演内容。
- 发送前缓存预估提示（Token Estimate）。
- 守卫状态角标：静默抢救计数。

### 4.2 AI 引擎页 (`/runtime`)
- 大脑状态卡：主力模型 (:18080) 与训练工坊模型 (:8888) 一键热切换。
- 智能调节滑块：思考能力与内存上限。
- 规则引擎体检（Doctor Checklist）。

### 4.3 训练工坊 (`/train`) [高级模式]
- 选基座模型：支持选择经典轻量模型与自定义 HuggingFace ID。
- 数据集接入：支持在线数据集与本地文件选择。
- 训练实时监控：Loss 曲线、Step 步数与实时日志。
- 检查点管理。

### 4.4 Agent 连接 (`/connect`) [高级模式]
- Agent 状态卡片：Claude Code / Codex / Hermes / Pi / OpenClaw / OpenCode。
- 一键启动状态桥接。

### 4.5 守卫面板 (`/guard`) [高级模式]
- 守卫引擎体检（Doctor）。
- 工具调用抢救日志（Salvage Log）。

### 4.6 系统设置 (`/settings`)
- Parchment 色调选择（暖纸亮色 / 暖石暗色）。
- 开机自启与自动就绪大脑。
- 普通模式与高级模式切换。
