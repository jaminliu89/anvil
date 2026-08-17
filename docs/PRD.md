# Anvil — PRD v2.1

## 产品愿景

Anvil 是一个本地 AI 控制中心。把推理、编码 agent、训练、agent 框架全部纳入一个桌面窗口。每种工具保留自己的独特能力，但交互统一在一条时间线上。

用户不需要在不同终端窗口之间切来切去。Anvil 是编排层——不是又一个聊天工具。

## 目标用户

- 拥有多台 AI 工具（本地模型、云 API、编码 agent、训练平台）的开发者
- 需要一站式监控和编排 AI 工作流的团队
- 不希望代码上传到云端的隐私敏感用户

## 架构摘要

```
Anvil (Tauri 2 + Vue 3)
├── Timeline — 统一会话流（聊天 + 计划 + 执行日志 + diff）
├── CommandBar — 斜杠命令 + 自动补全 + 联网搜索开关
├── Adapter Registry — 每个工具一个适配器
├── Sidebar — 时间线/对话/运行/训练/连接/守卫/设置
└── Parchment 4.0 — 黑白编辑风格（canvas #FFF / ink #111 / line #E5E5E5）

后端:
  DSH Bridge (:18443) — Python 守卫桥 + Tavily 搜索 + 自动探活
  Ling (:18080) — 本地推理端点（llama-server / vllm）
  Dock (:8710) — 异步编码 session 调度器
  DeepSeek Harness (:3000) — Agent 框架平台
  pi / codex / Reasonix — 编码 agent（CLI）
```

## 适配器状态

| 适配器 | 状态 | 说明 |
|--------|------|------|
| ling | 可用 2.1 | 默认聊天引擎，走 bridge → Ling :18080 |
| dock | 可用 2.0 | 异步编码 session 调度器 :8710 |
| pi | 骨架 0.5 | Tauri invoke 占位，等桌面壳 |
| codex | 骨架 0.5 | 同上 |
| reasonix | 骨架 0.5 | 同上 |
| dsh | 部分实现 0.7 | bridge 查询插件/会话，缺失 agent loop 真实路由 |
| unsloth | 骨架 0.3 | bridge 网关已实现 |

## 已知问题

1. **推理端点** — bridge 自动探活 + ollama serve，但 ollama 不在 PATH 时只打印提示
2. **dsh-adapter 插件** — bridge 的 dsh harness 初始化需要 --target --api-key，未初始化则 503
3. **TimelineView 排版** — markdown 已加，边缘 case（合并引用块/嵌套列表）可能不完美
4. **桌面壳未连接** — Tauri 2 脚手架已搭建，tauri dev 未完整测试
5. **无多模型切换 UI** — 硬编码 ling 默认，/switch 列表手动注册
6. **桥自动发现** — 插件应自注册为适配器，当前手动 registerAllAdapters()