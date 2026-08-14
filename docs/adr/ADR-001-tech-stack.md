# ADR-001: 技术栈选型 — Tauri + Vue 3 + DSH sidecar

- 状态: Accepted
- 日期: 2026-08-14
- 决策者: 柳俊明

## 背景

做一个基于 DeepSeek Harness 的桌面端 AI 助手产品：
- 借鉴 Grok Bot 的「AI 同事」心智模型
- 下沉市场，普通人能用
- 不要 Electron
- 全本地运行

## 决策

### 桌面壳：Tauri v2

**选择**: Tauri 2.x（Rust + 原生 WebView）

**理由**:
- 用户明确拒绝 Electron
- 体积小（~10MB Rust 二进制 vs Electron 150MB+）
- 启动快（冷启动 < 1s vs Electron 3s+）
- 内存占用低
- Rust 生态适合做进程管理、系统集成
- v2 已稳定，插件生态成熟（tray / notification / autostart / global-shortcut 全有）

**替代方案及否决理由**:
- Electron — 用户明确不要
- Wails (Go) — Go GUI 生态弱，系统集成插件少
- .NET MAUI / WPF — 仅 Windows，不跨平台
- 纯原生 SwiftUI — 只做 macOS 可以，但以后跨平台成本太高

---

### 前端框架：Vue 3 + TypeScript + Vite

**选择**: Vue 3 + Vite + TypeScript + 自研组件

**理由**:
- 用户已有多个 Vue 项目，技能复用
- Composition API + TS 体验好
- 自研组件而不用 UI 库，保持 Hermes 风格的扁平极简感
- 避免 naive-ui / Element Plus 的「国产后台」视觉感
- Vite 启动快，开发体验好

**替代方案及否决理由**:
- React + shadcn/ui — 视觉风格不对齐，且用户 Vue 技术栈更熟
- Svelte 5 — 生态成熟度不如 Vue3，组件库少
- 纯原生 — 效率太低

---

### DSH 接入：Sidecar 模式 + Web UI 嵌入

**选择**: DSH 作为 sidecar 进程，前端嵌入 DSH Web UI（iframe / WebView）

**理由**:
- 最快跑通全链路——DSH 的 Web UI 已经是完整的 Agent 界面
- 保留 DSH 的完整能力（插件、工具、会话持久化、Trajectory 视图）
- 进程隔离，DSH 崩溃不影响 GUI
- 渐进式替换——以后可以逐步把核心页面换成自研 UI
- 升级 DSH 版本只需替换 sidecar bundle

**替代方案及否决理由**:
- 纯 HTTP API 调用 — 丢了 90% 的 DSH 能力（插件/工具/会话管理），退化成普通聊天机器人
- Rust 直接调 DSH SDK — DSH 是 Node.js 的，Rust 没有原生 SDK，重写成本极高
- 纯自研 Agent 引擎 — 工作量巨大，DSH 77k stars 不是白给的

**降级方案**:
如果 DSH Web UI 嵌入体验不好（跨域/通信问题），回退到：
1. 自研核心 UI（团队首页 / 对话页）
2. 通过 DSH 的 headless JSON-RPC 协议通信
3. 复杂页面（插件管理 / Trajectory）仍然跳转 DSH Web UI

---

### 进程管理：Rust 侧管理 DSH 生命周期

**选择**: Rust 负责启动 / 停止 / 健康检查 / 崩溃重启

**理由**:
- Rust 的进程管理能力强（tokio + Command）
- 崩溃隔离——DSH 挂了 GUI 不挂
- 自动重启 + 指数退避，用户无感
- 状态统一由 Rust 维护，前端只展示

**反模式**:
- 前端直接管 DSH 进程（Node 集成 Electron 式）— 违背 Tauri 安全模型
- DSH 独立运行，GUI 只做客户端 — 安装体验差，用户要自己启服务

---

### 存储：DSH 原生 + Tauri store

**选择**: 会话数据用 DSH 原生存储，应用配置用 Tauri store plugin

**理由**:
- 不重复造轮子——DSH 已经有完整的会话持久化
- DSH 数据格式与 CLI 版互通，用户可以在终端和 GUI 间切换
- 应用配置（API key / 主题 / 自启）量少，用 store plugin 的 JSON 就够
- 减少 Rust 侧的数据库开发量

**替代方案及否决理由**:
- SQLite 前端 IndexedDB 全自研 — 工作量大，且与 DSH 数据不互通
- 全靠 DSH，配置也存在 DSH profile 里 — 应用级配置（自启 / 快捷键 / 主题）不属于 DSH 的范畴

---

## 后果

### 正面
- 最快速度交付可用产品（MVP 只需要壳 + DSH 嵌入）
- 体积小、启动快、内存低
- 保留 DSH 的完整生态能力
- 渐进式演进，以后可以逐步自研更多 UI

### 负面
- 需要同时维护 Rust + Vue + Node.js (DSH) 三端
- 内嵌 DSH + Node runtime 会增加包体积（预计增加 30-50MB）
- DSH 还在开发者预览，API 可能变动
- iframe 嵌入方式的体验上限受限于 DSH Web UI
