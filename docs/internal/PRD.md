# Anvil · PRD v2

> 本地 AI 操作系统。一个界面统管所有模型、Agent、工具。

你现在看到的是 v2 规划。v1（当前）是「一个聊天框 + 六个页面」。v2 是「一个命令栏 + 适配器体系 + 统一会话」。

## 你要解决的问题

本地有太多工具和模型，每个有自己的界面和入口：

| 工具 | 入口 | 交互方式 |
|---|---|---|
| Hermes | 终端 / 这个对话 | 自然语言聊天 |
| Pi | 终端 CLI | 编码指令 |
| Codex | 终端 CLI | 编码指令 |
| Reasonix | 终端 CLI/TUI | 编码指令 + 计划 |
| dock | 终端 CLI | 异步编码 session |
| Ling-3.0-tiny | llama.cpp 端口 | 纯推理 |
| Unsloth | 网页 :8888 | 训练 / 推理 |
| DeepSeek API | API 调用 | 云端推理 |

你在用一个「统一聊天界面」控制它们全部——但不是把能力抹平，是保留每种工具的独特性。

## v2 核心架构

```
统一会话（timeline）——所有交互都在同一条时间线上
        │
    ┌───┴──────────────┐
    │  命令栏           │
    │  普通打字 → AI 聊天
    │  /reasonix  → Reasonix 适配器
    │  /dock      → dock 适配器
    │  /codex     → Codex 适配器
    │  /pi        → Pi 适配器
    │  /ps        → 查看活跃 session
    └───┬──────────────┘
        │
    ┌───┴──────────────┐
    │  适配器注册表      │
    │  reasonix-adapter │  计划/子agent/MCP/缓存状态
    │  dock-adapter     │  异步创建/进度/审批/PR
    │  pi-adapter       │  编码/沙箱
    │  codex-adapter    │  配额/事件流
    │  ling-adapter     │  本地推理
    │  unsloth-adapter  │  训练/检查点
    └───┬──────────────┘
        │
    ┌───┴──────────────┐
    │  执行层           │
    │  DSH Bridge      │  HTTP 守卫 + 健康检查
    │  CLI/API 直调    │  不走 bridge 的直连
    └──────────────────┘
```

## 设计原则

### 1. 会话统一，视图解耦

v1 有 6 个页面（Chat/Runtime/Guard/Train/Connect/Settings）。v2 的默认视图只有一个：**时间线**。

所有交互——对话、命令结果、计划审批、训练进度——全部出现在同一条会话流里。不是切页面，是往下滚。

侧边栏作为导航和状态栏，不承载主要交互。

### 2. 适配器，不是下拉列表

每个工具/模型是一个**适配器**，注册到系统：

```
Adapter {
  id: string           // 唯一标识
  name: string         // 展示名称
  commands: string[]   // 触发的斜杠命令
  capabilities: [      // 能力声明
    { type: 'chat', provider: 'streaming' },
    { type: 'plan', provider: 'structured' },
    { type: 'execute', provider: 'async' },
    { type: 'mcp', provider: 'tools' },
  ]
  render(message): UI  // 渲染该工具的输出到会话流
}
```

### 3. 命令栏，不是纯聊天框

```
/help                  → 列出所有可用命令和适配器
/dock 修复 login 500   → dock 异步编码
/reasonix plan 重构    → Reasonix 计划模式
/reasonix exec         → 执行已批准的计划
/ps                    → 活跃 session 列表
/codex quota           → codex 配额状态
/pi run "修复所有 lint" → pi 非交互执行
/train lora            → Unsloth 训练
/switch ling           → 切到 Ling 模型聊天
```

没打斜杠的普通文字 → 路由到当前适配器（默认 Ling 聊天）。

### 4. 深度能力暴露，不是浅层封装

每个适配器要把工具的**独有功能**翻译成 Anvil 的交互：

| 适配器 | 独有能力 | 在 Anvil 里长什么样 |
|---|---|---|
| Reasonix | 前缀缓存 | 消息下方显示缓存命中率、节省 token |
| | 子智能体 | 会话里显示子任务卡片，可展开看详情 |
| | MCP 工具 | 聊天时显示可用工具列表 + 调用结果 |
| | 双模型模式 | 输入框旁的 quick/deep 切换 |
| dock | 异步 session | 计划卡片 + 审批按钮 inline |
| | worktree 隔离 | session 状态条显示分支、文件改动 |
| | 多引擎 | 创建时选引擎（pi/codex） |
| Codex | 沙箱 | 配额仪表盘、事件流折叠 |
| Pi | 非交互编码 | 结果 diff 直接渲染 |
| Ling | 本地推理 | 思考过程折叠、速度/内存显示 |

### 5. v1 页面灰度保留

v1 的页面（Chat/Runtime/Guard/Train/Connect/Settings）不删，作为**高级模式**的可选视图。默认新用户只看到时间线 + 命令栏。高级用户可以在侧边栏切回经典视图。

## 适配器管线（从输入到输出）

```
用户输入
  │
  ├─ 以 / 开头 → 命令解析器 → 匹配适配器 → 执行
  │     /dock 修复 login 500
  │     → dock-adapter.createSession("修复 login 500")
  │     → 返回 { sessionId, plan }
  │     → 渲染：计划卡片 + [批准] 按钮
  │
  └─ 普通文字 → 当前适配器.chat()
        "为什么这个函数会报错"
        → ling-adapter.chat(history)
        → 流式渲染回复
```

## v2 版本规划

| 版本 | 交付物 |
|---|---|
| v2.0 | 统一时间线 + 命令栏 + ling-adapter（替代当前 ChatView） |
| v2.1 | dock-adapter + Reasonix-adapter（异步编码 + 计划能力） |
| v2.2 | MCP 工具集成 + 子智能体可视化 |
| v2.3 | v1 页面灰度迁移完成，高级模式保留经典视图 |

## 不做

- 不做「统一模型接口」——每个适配器保留独特能力
- 不做云同步——全部本地
- 不做插件市场——适配器先写死在代码里
- 不做移动端