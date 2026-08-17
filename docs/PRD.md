# Anvil — PRD v2.1

## 产品愿景

Anvil 是一个本地 AI 控制中心。它把推理、编码 agent、训练、agent 框架全部纳入一个桌面窗口。每种工具保留自己的独特能力，但交互统一在一条时间线上。

用户不需要在不同终端窗口之间切来切去。Anvil 是编排层——不是又一个聊天工具。

## 目标用户

- 拥有多台 AI 工具（本地模型、云 API、编码 agent、训练平台）的开发者
- 需要一站式监控和编排 AI 工作流的团队
- 不希望代码上传到云端的隐私敏感用户

## 架构摘要

```
┌─ Anvil (Tauri 2 + Vue 3) ──────────────────────┐
│  Timeline  ←- 所有交互统一在这条时间线          │
│  ├─ 聊天气泡（用户纯文本 / 助手 markdown）       │
│  ├─ 系统消息（搜索结果 / 状态提示）              │
│  ├─ 执行计划（计划卡片 + [批准] 按钮）           │
│  ├─ 执行日志（mono 代码块）                      │
│  └─ 训练消息                                     │
│                                                  │
│  CommandBar  ←- 斜杠命令 + 自动补全              │
│  ├─ /help — 全部命令面板                         │
│  ├─ /switch <id> — 切换聊天引擎                  │
│  ├─ /dock /codex /pi /reasonix /dsh — 命令      │
│  └─ 联网搜索开关（每次聊天自动搜索网络）           │
│                                                  │
│  Sidebar                                          │
│  ├─ 时间线（默认） / 对话 / 运行 / 训练           │
│  ├─ 连接 / 守卫 / 设置（高级模式）                │
│  └─ 普通模式 / 高级模式切换                       │
└──────────────────────────────────────────────────┘

后端:
  DSH Bridge (:18443) — Python 守卫桥 + Tavily 搜索
  ├─ POST /chat — 非流式对话（守卫全开）
  ├─ POST /stream — 流式对话（SSE）
  ├─ POST /search — Tavily 联网搜索
  ├─ GET  /health — 存活探针
  ├─ GET  /doctor — 完整体检
  ├─ GET  /dsh/plugins — 插件列表
  └─ GET  /dsh/sessions — 会话列表

  Ling (:18080) — 本地推理端点（llama-server / vllm）
  Dock (:8710) — 异步编码 session 调度器
  DeepSeek Harness (:3000) — Agent 框架平台
  pi / codex / Reasonix — 编码 agent（CLI）

设计系统:
  Parchment 4.0 — 黑白编辑风格（canvas #FFF / ink #111 / line #E5E5E5）
  ├─ 暗色模式可用（[data-theme="dark"]）
  ├─ NovelAgent 主题可选（墨蓝 + 暖 canvas）
  └─ 禁用 emoji / 渐变 / 玻璃拟态 / 发光
```

## 适配器状态（v2.1）

| 适配器 | 状态 | 说明 |
|--------|------|------|
| ling | ✓ 可用 2.1 | 默认聊天引擎，走 bridge → Ling :18080 |
| dock | ✓ 可用 2.0 | 异步编码 session 调度器 :8710 |
| pi | ✓ 骨架 0.5 | Tauri invoke 占位，等桌面壳 |
| codex | ✓ 骨架 0.5 | 同上 |
| reasonix | ✓ 骨架 0.5 | 同上 |
| dsh | ⚡ 部分实现 0.7 | bridge 查询插件/会话, 缺失 agent loop 真实路由 |
| unsloth | ✓ 骨架 0.3 | bridge 网关已实现 |

## 已知问题

1. **推理端点自启不稳定** — bridge 尝试 `ollama serve`，但如果 ollama 不在 PATH 则打印提示
2. **dsh-adapter 插件查询** — bridge 的 dsh harness 初始化需要 `--target` `--api-key`，如果 harness 未初始化则返回 503
3. **TimelineView 排版** — markdown 渲染已加，但部分边缘 case（合并的引用块、嵌套列表）可能不完美
4. **桌面壳未连接** — Tauri 2 脚手架已搭建，但 `tauri dev` 未完整测试，CORS bridge 只在 dev server 场景验证
5. **无多模型切换 UI** — 目前硬编码 `ling` 作为默认适配器，/switch 列表手动注册
6. **桥自动发现** — 插件应自注册为适配器，当前手动 registerAllAdapters()