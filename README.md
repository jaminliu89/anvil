# Anvil

本地 AI 工作台。一个 app 管本地推理、训练、Agent 编排。

## 一句话

Anvil 把三个东西集成到一个桌面里：llama.cpp 推理（Ling-3.0-tiny 等本地模型）、Unsloth 微调训练、编码 Agent 协同。再加一个守卫侧车（DSH bridge）做健康检查和故障恢复。

不需要配置多个端口、记住哪些服务分别在哪启动、手动检查谁挂了。Anvil 一个窗口解决。

## 安装

### 依赖

| 组件 | 来源 | 说明 |
|---|---|---|
| Ling-3.0-tiny | `ghcr.io/jaminliu89/ling-3.0-tiny-mac` | 编码 Agent 主力模型 |
| Unsloth Desktop 2 | unsloth.ai | 训练后端 |

### macOS

```bash
# 克隆
git clone https://github.com/jaminliu89/anvil.git
cd anvil

# 前端
npm install

# 桌面构建
cd src-tauri && cargo build --release
```

开箱即用，前提是 Ling-3.0-tiny（:18080）和 Unsloth Desktop（:8888）已在运行。

### 从源码运行

```bash
# 1. 启动守卫侧车
python3 src-tauri/sidecar/bridge.py --port 18443

# 2. 启动前端开发服务器
npm run dev

# 3. 打开 http://localhost:5173
```

## 架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  ChatView   │────▶│  DSH Bridge  │────▶│  llama-server   │
│  RuntimeView│     │  (:18443)    │     │  (:18080)       │
│  GuardView  │     │  规则引擎    │     │                  │
│  TrainView  │     │  + 健康检查  │     │  ┌────────────┐ │
│  ConnectView│     │  + 故障恢复  │     │  │Ling-3.0-tiny│ │
└─────────────┘     └──────────────┘     │  └────────────┘ │
                           │             └─────────────────┘
                           ▼
                    ┌──────────────┐
                    │  Unsloth     │
                    │  Desktop     │
                    │  (:8888)     │
                    │  训练 + 推理 │
                    └──────────────┘
```

### 核心原则

AI 内容工具领域沉淀的架构原则——**前端规则引擎是主引擎，LLM 是可选项**。所有核心功能（健康检查、故障恢复、大脑切换）走 DSH 守卫的规则引擎，推理只在用户发起对话时调用 LLM。

## 功能

### ChatView — 对话

流式对话，支持：
- 思考过程折叠展示（LLM 的 reasoning_content）
- 发送前 token 预估
- 普通/高级模式切换（普通 = 简短回复，高级 = 深度推理）
- 模型自动切换（Ling-tiny / Unsloth / 云端 API）

### RuntimeView — 运行时

- 实时显示各大脑状态（健康/停机/无响应）
- 一键切换推理端点（:18080 ↔ :8888）
- 三项体检：进程存活、API 响应、模型就绪

### GuardView — 守卫面板

- 全局健康监控
- 抢救日志：自动记录故障和恢复操作
- 规则引擎状态展示

### TrainView — 训练

- 检测 Unsloth Desktop 状态（在线/离线、模型加载情况）
- 查看已保存的检查点列表
- 打开 Unsloth Desktop 管理训练任务

### ConnectView — Agent 桥梁

- 一键启动编码 Agent 并连接到本地模型
- 支持 Claude Code / Codex / Hermes / Pi / OpenCode / OpenClaw
- 检查 Agent 安装状态和运行情况

## 开发

### 项目结构

```
src/                    # Vue 3 前端
  views/                # 页面组件
    ChatView.vue        # 对话页
    RuntimeView.vue     # 运行时页
    GuardView.vue       # 守卫面板页
    TrainView.vue       # 训练页
    ConnectView.vue     # Agent 桥梁页
  services/
    dsh.ts              # DSH 守卫 API 客户端
  router/
    index.ts            # 路由配置
src-tauri/
  src/
    dsh/
      manager.rs        # 侧车进程管理器
      guard.rs          # 规则引擎 + 健康检查
    lib.rs              # Tauri 入口
  sidecar/
    bridge.py           # DSH 守卫 HTTP 服务
```

### 构建打包

```bash
# 前端构建
npm run build

# 桌面应用打包
cd src-tauri && cargo tauri build
```

## 协议

MIT