# Anvil v2 Architecture

> 适配器体系 + 命令栏 + 统一会话 + DeepSeek Harness 双向集成

## 总体架构

```
┌──────────────────────────────────────────────────────────────────┐
│  Anvil Desktop (Tauri 2 + Vue 3)                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐           │
│  │  Timeline (统一会话流)                             │           │
│  │  消息 | 计划卡片 | 审批按钮 | 执行日志 | diff | PR  │           │
│  └────────────────────┬─────────────────────────────┘           │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────┐           │
│  │  Command Bar                                      │           │
│  │  /dock /reasonix /dsh /pi /codex /train /help    │           │
│  │  无前缀文字 → 当前适配器.chat()                   │           │
│  └────────────────────┬─────────────────────────────┘           │
│                       │                                          │
├───────────────────────┼──────────────────────────────────────────┤
│  Adapter Registry     │                                          │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────┐           │
│  │  Command Parser + Router                          │           │
│  │  parse("/dock 修复 login") → dock-adapter.execute│           │
│  │  parse("为什么报错") → ling-adapter.chat          │           │
│  └────────────────────┬─────────────────────────────┘           │
│                       │                                          │
│  ┌────────────────────┼──────────────────────────────────────┐  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │  ling    │  │ reasonix │  │  dock    │  │  pi      │ │  │
│  │  │  adapter │  │  adapter │  │  adapter │  │  adapter │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  codex   │  │  dsh     │  │ unsloth  │              │  │
│  │  │  adapter │  │  adapter │  │  adapter │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                       │                                          │
├───────────────────────┼──────────────────────────────────────────┤
│  Execution Layer      │                                          │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────┐           │
│  │  DSH Bridge (:18443)                              │           │
│  │  推理 (Ling / DeepSeek API) + 守卫 + 健康检查     │           │
│  └───────────────────────────────────────────────────┘           │
│                       │                                          │
│  ┌────────────────────┼───────────────────┐  ┌───────────────┐  │
│  │  dock CLI          │  pi CLI           │  │  codex CLI   │  │
│  │  Reasonix CLI      │  dsh (npx)        │  │  gh / git    │  │
│  └────────────────────┴───────────────────┘  └───────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 适配器接口

```typescript
interface Adapter {
  id: string
  name: string
  description: string
  commands: string[]          // 触发命令，如 ['dock','d']
  capabilities: Capability[]
  dependencies: string[]      // 依赖的服务或 CLI

  chat?(history, opts): Promise<ChatResponse>
  execute(command: string, args: string): Promise<ExecutionResult>
  render(entry: TimelineEntry, container: HTMLElement): void
  status(): Promise<AdapterStatus>  // 是否可用
}

interface Capability {
  type: 'chat' | 'plan' | 'execute' | 'mcp' | 'train' | 
        'inspect' | 'agent-loop' | 'plugin-system'
  provider: 'streaming' | 'structured' | 'async' | 'sync'
  description: string
}
```

## 各适配器设计

### ling-adapter（默认）

```
命令: 无（默认聊天适配器）
能力: chat(streaming), inspect(status)
依赖: DSH Bridge (:18443) 或直接 :18080

execute(): 不适用（没有 /ling 命令）
chat(): 走 DSH Bridge → Ling-3.0-tiny / DeepSeek API
render(): 
  - 用户消息: 气泡（右对齐）
  - AI 回复: 气泡（左对齐） + reasoning 折叠条 + 耗时 + 缓存命中率
status(): 探活 :18080 或 :18443
```

### dock-adapter

```
命令: /dock, /d
能力: plan(structured), execute(async), inspect(sessions)
依赖: dock CLI（~/ScriptHub/dock/dock.py）

execute("dock", "修复 login 500"):
  → dock create <repo> "修复 login 500"
  → 返回 { sessionId, branch, worktree }
  → 等待 plan 完成
  → 返回 TimelineEntry { type: 'plan', steps: [...] }

子命令:
  /dock <prompt>           → 创建 + plan
  /dock approve <sid>      → 批准执行
  /dock status [sid]       → 状态
  /dock log <sid>          → 日志
  /dock pr <sid>           → PR

render():
  - 创建: session 信息卡（sid / branch / repo）
  - plan: 步骤列表 + [批准] 按钮（inline）
  - 执行: 进度条 + 折叠日志
  - 完成: 改动文件列表 + diff 预览 + [PR] 按钮
```

### reasonix-adapter

```
命令: /reasonix, /rx
能力: chat(streaming), plan(structured), execute(sync), 
      mcp(list+call), inspect(cache+subagents)
依赖: Reasonix CLI 或 DeepSeek API

子命令:
  /reasonix <prompt>          → 普通聊天（走 DeepSeek API）
  /reasonix plan <prompt>     → 计划模式
  /reasonix exec [step]       → 执行计划
  /reasonix status            → 缓存命中率 + 子agent + 会话统计
  /reasonix mcp               → 列出 MCP 工具 + 调用

render():
  - 聊天: 同 ling-adapter（但显示缓存率）
  - 计划: 结构化步骤卡片 + [批准]
  - 执行: 实时流式日志
  - 状态: 缓存仪表盘（小）+ 子agent 列表
  - MCP: 工具列表 + 调用结果卡片
```

### dsh-adapter（DeepSeek Harness）

```
命令: /dsh
能力: agent-loop(async), plugin-system(inspect), execute(async)
依赖: Node.js + @deepseek-ai/dsh

集成三层次：

Level 1 — 生命周期管理:
  /dsh start              → 启动 dsh 服务（npx @deepseek-ai/dsh web）
  /dsh stop               → 停止 dsh
  /dsh status             → dsh 运行状态 + 端口

Level 2 — 插件桥接:
  /dsh plugins            → 列出已安装 dsh plugin
  /dsh plugin install <n> → 安装插件
  已安装插件自动注册为 Anvil 适配器:
    dsh plugin:github-review → /github-review <pr-url>
    dsh plugin:agent-loop    → /dsh run <prompt>

Level 3 — 任务路由:
  /dsh run <prompt>       → 路由到 dsh 的 agent loop
  /dsh schedule <cron>    → 定时任务

render():
  - 状态: 服务状态卡（端口/运行时间/插件数）
  - 插件列表: 卡片网格
  - agent-loop 执行: 思考过程 + 工具调用记录 + 最终结果
```

### pi-adapter

```
命令: /pi
能力: execute(sync)
依赖: pi CLI

execute("pi", "修复所有 lint"):
  → pi -p --provider zai-coding-cn --no-session "修复所有 lint"
  → 返回执行结果文本

render(): 结果文本 + 耗时 + 引擎标签
```

### codex-adapter

```
命令: /codex, /cx
能力: execute(sync), inspect(quota)
依赖: codex CLI

子命令:
  /codex <prompt>    → codex exec
  /codex quota       → 配额仪表盘

render():
  - 执行: JSONL 事件流（折叠） + 最终结果
  - 配额: 使用量/剩余/重置日期仪表盘
```

### unsloth-adapter

```
命令: /train, /unsloth
能力: train(async), inspect
依赖: Unsloth Desktop (:8888)

子命令:
  /train list             → 模型 + 检查点列表
  /train start <M> <D>    → 训练
  /train status           → 进度

render():
  - 列表: 模型卡 + 检查点
  - 训练: 进度条 + loss 曲线
```

## 命令解析器

```typescript
function parse(input: string): 
  | { type: 'chat', text: string }
  | { type: 'command', adapter: Adapter, command: string, args: string }
  | { type: 'error', message: string }

// /dock 修复 login 500
// → { type: 'command', adapter: dock-adapter, command: 'dock', args: '修复 login 500' }

// "为什么报错"
// → { type: 'chat', text: '为什么报错' }
// → currentAdapter.chat(history, text)
```

## Timeline

```typescript
interface TimelineEntry {
  id: string
  timestamp: number
  adapterId: string
  
  // 类型系统——每个适配器渲染自己的类型
  type: 'message' | 'plan' | 'execution' | 'approval' | 
        'diff' | 'pr' | 'log' | 'system' | 'plugin' | 
        'train' | 'mcp-result'
  
  data: Record<string, any>  // 适配器自定义数据
}
```

Timeline 是一个虚拟滚动列表。每个条目由产生它的适配器 `.render()`。适配器不知道 Timeline 的存在——它只接收一个 container 元素，在里面渲染。

## 状态管理

```typescript
// Adapter 注册表
const registry = new Map<string, Adapter>()

// 当前活动适配器（用于无前缀聊天）
let currentAdapter: Adapter = lingAdapter

// Timeline 存储
const timeline: TimelineEntry[] = []

// 命令到适配器的映射（自动构建）
const commandMap = new Map<string, Adapter>()
// /dock → dockAdapter, /d → dockAdapter
// /reasonix → reasonixAdapter, /rx → reasonixAdapter
// ...
```

## v1 → v2 迁移

| 步骤 | 内容 | 影响 |
|------|------|------|
| 1 | Timeline 组件 + CommandBar（新文件，跟现有视图并行） | 无 |
| 2 | Adapter 注册表 + 命令解析器（新文件） | 无 |
| 3 | ling-adapter（包装现有 ChatView 逻辑） | 无 |
| 4 | dock-adapter（调 dock CLI） | 无 |
| 5 | pi/codex/reasonix-adapter | 无 |
| 6 | dsh-adapter | 无 |
| 7 | Timeline 设为默认首页 | 旧 ChatView 保留在「经典视图」 |
| 8 | 经典视图入口 + 代码清理 | 旧视图移到侧边栏 |

所有 v1 代码（ChatView / RuntimeView / GuardView / TrainView / ConnectView / SettingsView）在 v2 期间**不删不改**。v2 是平行添加，最后一步才移走。

## 关键设计决策

1. **适配器是映射器，不是封装器** — 不把独特能力抹平，每种工具的输出在 Timeline 里有自己的渲染方式
2. **dsh 是插件平台，不是工具** — Anvil 跟 dsh 是双向集成，不是「又调一个 API」
3. **无锁迁移** — v1 视图全部保留到最后一刻，不破坏现有功能
4. **普通文字聊天不消失** — 没打 / 的文字继续走 Ling 聊天，这是默认入口
5. **所有适配器可独立开关** — 某个工具没装，对应的适配器自动隐藏