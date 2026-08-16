# Anvil 架构

> 规则引擎为骨架，LLM 为加速器。所有核心功能能用纯规则跑通，LLM 降级后用户不卡壳。

## 总体架构

```
┌──────────────────────────────────┐
│  Tauri Desktop App (macOS)       │
│  ┌────────────┐  ┌────────────┐  │
│  │ Vue 3 前台  │  │ Rust 后台  │  │
│  │ 六个页面     │  │ 进程管理   │  │
│  │ 状态管理     │  │ 托盘/菜单  │  │
│  │ 守卫/UI     │  │ 生命周期   │  │
│  └─────┬──────┘  └─────┬──────┘  │
│        ├────── HTTP ────┤         │
│        │  :18443        │ spawn   │
│  ┌─────┴────────────────┴──────┐  │
│  │  Python Sidecar (bridge.py)  │  │
│  │  ┌────────────────────────┐  │  │
│  │  │  DSH Guard（守卫层）    │  │  │
│  │  │  · reasoning 分离      │  │  │
│  │  │  · usage 归一化        │  │  │
│  │  │  · doctor 体检         │  │  │
│  │  │  · estimate 预估       │  │  │
│  │  └──────────┬─────────────┘  │  │
│  │  ┌──────────┴─────────────┐  │  │
│  │  │  Unsloth 网关          │  │  │
│  │  │  · /unsloth/status     │  │  │
│  │  │  · /unsloth/checkpoints│  │  │
│  │  │  · /unsloth/start/*    │  │  │
│  │  └────────────────────────┘  │  │
│  └──────────────────────────────┘  │
└──────────────────────────────────┘
         │           │
  ┌──────┴─┐   ┌─────┴──────┐
  │:18080  │   │  :8888     │
  │Ling    │   │ Unsloth    │
  │llama   │   │ Desktop    │
  │Server  │   │ (可选)     │
  └────────┘   └────────────┘
```

## 三层请求流

一个聊天请求的完整路径：

```
[ChatView] → POST /chat → [bridge.py] → DSH Guard
  ├─ reasoning 分离     ← 把 <think>...</think> 从回复中剥离
  ├─ usage 归一化       ← 统一 token/tps/耗时 格式
  ├─ 错误封装           ← 非 200 响应转为友好消息
  └─ POST → [llama-server:18080]
                └─ 流式 SSE 返回 → bridge.py SSE → ChatView

[ChatView] → POST /stream → [bridge.py] → SSE 直通
  ├─ 同上守卫
  ├─ 流式逐字推送
  └─ ChatView 解析 SSE + 渲染 reasoning 折叠
```

## 页面路由

| 路由 | 页面 | 功能 |
|---|---|---|
| `/` | ChatView | 默认页，聊天对话 + 推理折叠 + 守卫角标 |
| `/runtime` | RuntimeView | 大脑切换（:18080/:8888）+ 体检三项 |
| `/guard` | GuardView | 守卫日志、doctor 清单、抢救记录 |
| `/train` | TrainView | Unsloth 模型/训练状态 + 启动训练 |
| `/connect` | ConnectView | Agent 桥接卡片（claude/codex/pi/hermes） |
| `/settings` | SettingsView | 模式切换（普通/高级）+ 配置 |

## 守卫层（DSH Guard）

bridge.py 的核心，不是装饰品。

### 响应处理管线

```
原始响应 (JSON) → [guard.hydrate]
  ├─ 提取 reasoning_content（DeepSeek 原生字段）
  ├─ 若没有 → 从 content 中正则提取 <think>...</think>
  ├─ 剥离 reasoning 后纯内容 → response.content
  └─ 返回 {content, reasoning, usage, guard}

usage 归一化 → [guard.hydrate_usage]
  ├─ 统一 token_count/tps/duration_ms
  ├─ 兼容不同后端的不同字段名
  └─ 缺失字段自动补 0

错误封装 → [guard.safe]
  ├─ 非 200 → 提取后端错误消息
  ├─ 超时 → 友好提示
  └─ 保持流式输出兼容
```

### 健康检查

```
GET /doctor → [guard.status]
  ├─ model: 模型名称 / 未加载
  ├─ alive: true/false
  ├─ total_tokens, tps, uptime
  └─ config: 当前配置（model/temperature/max_tokens）

GET /health → [快速存活检查]
  └─ {ok: true, dsh: "0.2.0", ts: timestamp}
```

## 进程生命周期（Rust 管理器）

manager.rs 管理 bridge.py 和关联进程：

```
Tauri 启动
  └─ manager::init()
        ├─ 从 app 资源目录定位 bridge.py
        ├─ 或从 sidecar 目录定位（开发模式）
        ├─ spawn("python3", ["bridge.py", "--port", "18443"])
        ├─ 轮询 /health 直到 200（最多 10 秒）
        └─ 注册 on_exit 回调（自动重启）

Rust 对外暴露命令：
  ├─ get_sidecar_status()  → {pid, alive, uptime}
  ├─ restart_sidecar()     → kill + respawn
  └─ stop_sidecar()        → kill + 从托盘隐藏
```

## 大脑切换

RuntimeView 实现端点热切换：

```
[切换按钮 :18080 ↔ :8888]
  ├─ 更新 store.settings.inferenceEndpoint
  ├─ ChatView watch → 自动重连新端点
  ├─ 原端点不做健康检查（无阻塞切换）
  └─ guard 自动适应新端点的响应格式
```

Unsloth Desktop 切换的特殊性：
- Unsloth :8888 需要 API 认证（Bearer token）
- 当前：切换显示「Unsloth 已连接」但未通过认证
- 待完善：通过 Unsloth CLI 获取 API key 后自动注入

## 训练页（TrainView）

通过 bridge.py 的 Unsloth 网关与 Unsloth Desktop 交互：

```
[TrainView] → GET /unsloth/status → [bridge.py]
  └─ 转发到 :8888 → 返回 Unsloth 状态/版本

[TrainView] → GET /unsloth/checkpoints → [bridge.py]
  └─ 转发到 :8888 → 返回检查点列表

[TrainView] → "打开 Unsloth Desktop"
  └─ window.open('unsloth://') → macOS URL scheme
```

## 连接页（ConnectView）

检测本地可用的编码 Agent：

```
[ConnectView] 挂载 → 检测各 Agent CLI 是否存在
  └─ which claude/codex/pi/hermes/opencode → 状态
  └─ 显示已检测到的 Agent + 启动按钮

启动按钮 → POST /unsloth/start/{agent_id}
  └─ 调用 unsloth run --agent {agent_id}
  └─ 输出 API key 传给 Agent
```

## 设计约束

### 前端
- 语言：Vue 3 + TypeScript + Vite
- 状态管理：Pinia stores（dsh.ts / settings.ts）
- 样式：Parchment 设计系统（暖石色系）
- 路由：vue-router，懒加载
- 部署：Tauri 内嵌 webview

### 后端（Rust）
- 语言：Rust（tauri 2.x）
- 进程管理：std::process::Command + 回调
- 暴露 Tauri 命令：get_sidecar_status / restart_sidecar / stop_sidecar
- 托盘：系统托盘 + 菜单

### 后端（Python sidecar）
- 语言：Python 3.12
- HTTP：http.server（stdlib，无额外依赖）
- LLM：DeepSeekHarness 库
- 网关：requests 转发到 Unsloth Desktop API

## 目录结构

```
dsh-gui/
├── src/                     # Vue 3 前端
│   ├── App.vue
│   ├── main.ts
│   ├── views/               # 6 个页面
│   │   ├── ChatView.vue
│   │   ├── RuntimeView.vue
│   │   ├── GuardView.vue
│   │   ├── TrainView.vue
│   │   ├── ConnectView.vue
│   │   └── SettingsView.vue
│   ├── services/            # API 层
│   │   └── dsh.ts           # DSH bridge client
│   ├── stores/              # 状态
│   │   ├── dsh.ts
│   │   └── settings.ts
│   ├── styles/              # Parchment 设计系统
│   │   └── main.css
│   └── router/
│       └── index.ts
├── src-tauri/               # Tauri 后端
│   ├── src/
│   │   ├── lib.rs
│   │   └── dsh/
│   │       └── manager.rs   # 进程管理器
│   ├── sidecar/
│   │   └── bridge.py        # DSH 守卫 HTTP 服务
│   ├── icons/
│   └── tauri.conf.json
├── docs/
│   ├── PRD.md               # 产品需求文档
│   ├── TASKS.md              # 执行清单
│   ├── ARCHITECTURE.md      # 本文
│   └── PITCH.md             # 宣传文档
└── README.md
```