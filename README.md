# 鲸团

> 你的第一个 AI 助手团队。基于 DeepSeek Harness，双击就能用。

## 产品定位

打开 App 就有 AI 同事在等你，不用命令行，不用装环境，给它派活它自己干。

- **零门槛**：双击安装，下一步下一步
- **有人味**：不是聊天窗口，是你的 AI 团队
- **真干活**：DSH 引擎驱动，能写代码、能搜资料、能读文件
- **省钱**：按用量付费，不用 $200/月
- **全本地**：数据存你自己电脑上

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Tauri v2 (Rust) |
| 前端 | Vue 3 + TypeScript + Vite |
| 引擎 | DeepSeek Harness (Node.js sidecar) |
| 状态 | Pinia |

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（自动启动 Vite + Tauri）
pnpm tauri:dev

# 构建生产版本
pnpm tauri:build
```

## 项目结构

```
.
├── docs/                    文档（PRD / 架构 / ADR / 任务）
├── src/                     前端源码
│   ├── components/          组件（team/chat/trail/onboarding/common）
│   ├── views/               页面
│   ├── stores/              Pinia stores
│   ├── services/            服务封装（IPC / events / DSH）
│   ├── types/               类型定义
│   ├── presets/             预设助手配置
│   ├── router/              Vue Router
│   └── styles/              全局样式 + design tokens
├── src-tauri/               Rust 源码
│   ├── src/
│   │   ├── dsh/             DSH 进程管理
│   │   ├── lib.rs           应用入口 + 插件注册
│   │   └── main.rs          二进制入口
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## 文档

- [PRD](docs/PRD.md) — 产品需求文档
- [架构](docs/ARCHITECTURE.md) — 整体架构与模块划分
- [任务看板](docs/TASKS.md) — 实现任务（按 Gate 推进）
- [ADR-001 技术选型](docs/adr/ADR-001-tech-stack.md)
- [ADR-002 产品定位](docs/adr/ADR-002-product-positioning.md)

## License

MIT
