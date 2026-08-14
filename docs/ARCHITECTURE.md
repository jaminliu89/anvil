# 鲸团 · Architecture

> 整体架构、模块划分、数据流、技术选型理由。
> 产品名：鲸团（JingTuan）— 你的 AI 助手团队
> 底层引擎：DeepSeek Harness (dsh)

---

## 1. 架构总览

三层架构，严格分层。上层依赖下层，下层不知道上层存在。

```
┌─────────────────────────────────────────────────────┐
│              Presentation Layer (Vue 3)              │
│  团队首页 │ 对话界面 │ 干活轨迹 │ 设置 │ 插件中心     │
├─────────────────────────────────────────────────────┤
│              IPC Bridge Layer                       │
│  Tauri invoke / Events / TypeScript types           │
├─────────────────────────────────────────────────────┤
│              Rust Core Layer                        │
│  DSH 进程管理 │ 托盘 │ 通知 │ 快捷键 │ 自启 │ 配置    │
├─────────────────────────────────────────────────────┤
│              DSH Runtime (Node.js sidecar)          │
│  模型 │ 工具 │ 插件 │ 会话 │ 持久化                  │
└─────────────────────────────────────────────────────┘
```

---

## 2. 前端模块划分

```
src/
├── components/           可复用组件
│   ├── team/            AI 团队相关（助手卡片 / 头像 / 状态标签）
│   ├── chat/            聊天相关（消息气泡 / 输入框 / Markdown 渲染）
│   ├── trail/           干活轨迹（时间线 / 工具调用卡片 / 审批卡片）
│   ├── onboarding/      引导页组件
│   └── common/          通用组件（按钮 / 对话框 / 空状态 / 加载）
├── views/               页面级组件
│   ├── TeamView.vue     我的 AI 团队（首页）
│   ├── ChatView.vue     对话页（含轨迹面板）
│   ├── SettingsView.vue 设置页
│   └── OnboardingView.vue 引导页
├── stores/              Pinia stores
│   ├── team.ts          助手列表 + 当前助手
│   ├── chat.ts          当前会话 + 消息流
│   ├── trail.ts         干活轨迹状态
│   └── settings.ts      设置状态
├── services/            外部服务封装
│   ├── ipc/             Tauri invoke 封装（类型安全）
│   ├── events.ts        Tauri 事件监听
│   └── dsh.ts           DSH 服务控制（启动 / 停止 / 状态）
├── types/               TypeScript 类型定义
│   ├── assistant.ts     助手相关类型
│   ├── message.ts       消息相关类型
│   ├── trail.ts         轨迹相关类型
│   └── settings.ts      设置相关类型
├── presets/             预设助手配置
│   ├── index.ts         助手清单
│   ├── writer.ts        小文（文案写手）
│   ├── coder.ts         阿码（程序员）
│   ├── researcher.ts    小研（研究员）
│   └── creator.ts       小创（打杂能手）
├── router/              Vue Router
├── styles/              全局样式 + design tokens
│   ├── tokens.css       CSS 变量（颜色 / 间距 / 字号 / 圆角）
│   └── globals.css      全局样式
├── utils/               工具函数
├── App.vue
└── main.ts
```

---

## 3. Rust 模块划分

```
src-tauri/src/
├── main.rs              入口
├── lib.rs               库入口（注册 commands + 插件）
├── commands/            Tauri command handlers
│   ├── team.rs          助手相关 commands
│   ├── chat.rs          消息发送 / 中止
│   └── settings.rs      设置读写
├── dsh/                 DSH 进程管理
│   ├── manager.rs       进程生命周期（启动 / 停止 / 重启 / 状态）
│   ├── port.rs          端口分配 + 冲突检测
│   └── types.rs         DSH 相关类型
├── config.rs            应用配置管理
└── error.rs             错误类型
```

### 使用的 Tauri 插件
- `tauri-plugin-shell` — sidecar 进程管理
- `tauri-plugin-single-instance` — 单实例
- `tauri-plugin-tray-icon` — 系统托盘
- `tauri-plugin-notification` — 桌面通知
- `tauri-plugin-autostart` — 开机自启
- `tauri-plugin-global-shortcut` — 全局快捷键
- `tauri-plugin-store` — 简单配置存储
- `tauri-plugin-window-state` — 窗口状态记忆

---

## 4. DSH 集成方案

### 4.1 进程模型

DSH 作为独立 sidecar 进程运行，由 Rust 管理生命周期：

```
Tauri 主进程 (Rust)
  └── dsh 子进程 (Node.js)
       ├── 启动参数：--headless 或 --profile web + 自定义端口
       ├── stdin：JSON-RPC 请求（发消息 / 中止 / 列表）
       ├── stdout：JSON-RPC 响应 + 流式事件
       └── stderr：日志输出 → Rust log
```

**为什么用 sidecar 而不是直接调 HTTP API：**
- 保留 DSH 的完整插件体系和会话持久化
- 进程隔离，DSH 崩溃不影响 GUI
- 升级 DSH 版本不影响 Rust 主程序
- 未来可以支持多 DSH 实例（不同助手用不同 profile）

### 4.2 通信协议

优先用 DSH 的官方 headless JSON-RPC 协议。如果 headless 模式不够用，回退方案：
1. 启动 DSH Web UI 的 HTTP server
2. 前端在 WebView 里加载 DSH Web UI
3. 通过 postMessage 与外壳层通信

MVP 阶段用方案 2（直接加载 DSH Web UI），先把整个链路跑通，再逐步替换为自研 UI。

### 4.3 启动流程

```
用户打开 App
  ↓
检查 DSH 是否已安装（本地资源目录）
  ├── 未安装 → 从内嵌的 DSH bundle 解压
  └── 已安装 → 跳过
  ↓
分配随机可用端口
  ↓
启动 DSH 进程（指定端口 + profile）
  ↓
轮询健康检查（GET /health）
  ↓
DSH ready → 前端加载 Web UI + 外壳层
  ↓
显示主界面
```

### 4.4 崩溃恢复

- DSH 进程异常退出 → Rust 自动重启（最多重试 3 次，指数退避）
- 重启后恢复会话（DSH 自己的持久化）
- 连续崩溃 3 次 → 通知用户 + 显示日志

---

## 5. 预设助手体系

### 5.1 设计原则

每个助手 = 一个 DSH profile（preset 组合 + 插件集合 + 系统提示词）。

用户看到的是"小文 / 阿码 / 小研 / 小创"，背后是不同的 DSH profile。

### 5.2 四个初始助手

| 助手 | 定位 | DSH 模式 | 预装插件 | 系统提示词 |
|------|------|---------|---------|-----------|
| 小文 | 文案写手 | 标准 | dsh-web-search + 写作技能包 | 你是一名资深内容创作者… |
| 阿码 | 程序员 | PTC | 文件系统 + terminal + git | 你是一名全栈工程师… |
| 小研 | 研究员 | 标准 | web-search + 网页阅读 + 笔记 | 你是一名研究分析师… |
| 小创 | 打杂能手 | 创造 | 全部插件 + 实验性功能 | 你是一个全能助手… |

### 5.3 自定义助手（v0.2）

- 用户可以创建自己的助手
- 选角色 / 选技能 / 写描述 / 选头像
- 后台生成对应的 DSH profile

---

## 6. 数据库 / 存储

| 数据 | 存在哪 | 说明 |
|------|--------|------|
| DSH 会话 / 消息 | DSH 原生（SQLite） | 存在 DSH home 目录 |
| 助手配置 | DSH profile | 每个助手一个 profile |
| 应用设置 | tauri-plugin-store (JSON) | API key / 主题 / 自启 / 快捷键 |
| 窗口状态 | tauri-plugin-window-state | 大小 / 位置 / 最大化 |
| 前端缓存 | IndexedDB / localStorage | UI 状态 / 草稿 / 主题偏好 |

不重复造轮子——能让 DSH 存的都让 DSH 存。

---

## 7. 关键技术决策

完整 ADR 见 `docs/adr/`。

| 决策 | 选择 | 理由 |
|------|------|------|
| 桌面壳 | Tauri v2 | 用户明确不要 Electron；体积小 / 启动快 / Rust 安全 |
| 前端 | Vue 3 + 自研组件 | 对齐 Hermes 风格，灵活可控，避免 naive-ui 的后台感 |
| 引擎接入 | DSH sidecar + Web UI iframe | 最快跑通全链路，保留 DSH 全部能力 |
| 进程管理 | Rust 侧管理 | 崩溃隔离 + 自动重启 + 状态可见 |
| 存储 | DSH 原生 + Tauri store | 不重复造轮子，数据互通 |
| 包体积 | 内嵌精简 Node runtime | 用户不用装环境，但增加 ~30MB 体积 |

---

## 8. 设计原则

1. **下沉优先**：所有功能先想"普通人能不能理解"，不能理解就包装
2. **引擎是引擎，产品是产品**：DSH 是引擎，用户不需要知道引擎是什么
3. **渐进式自研 UI**：先 iframe 套 DSH Web UI 跑通，再逐步替换核心页面
4. **默认即最优**：预设助手就是最佳配置，不让用户选来选去
5. **后台常驻心智**：关窗口不退出，活还在干，完了通知你
6. **进度可见**：AI 在干什么要可视化，不能是黑盒

---

## 9. MVP 开发顺序（价值优先）

1. Tauri 脚手架 + DSH sidecar 启动（先让 DSH 跑起来）
2. 系统托盘 + 通知 + 单实例（桌面体验基础）
3. 首启动引导（API key 配置）
4. 我的 AI 团队首页（4 个预设助手）
5. 对话界面（DSH Web UI 嵌入 + 外壳导航）
6. 全局快捷键 + 开机自启
7. 干活轨迹面板（从 DSH 事件流读取）
8. 打包 + 验证
