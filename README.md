// Anvil · 本地 AI 工作站

对话 · 训练 · Agent 桥接，全部本地，零术语。

## 架构（终局 v2）

- **Anvil（本仓库）**：Tauri v2 + Vue 3。用户唯一入口。
- **DSH sidecar**：Python，包 `deepseek_harness`，协议守卫（reasoning 分离 / tool_calls 抢救 / usage 归一化 / cache 估算）。
- **推理路由**：Ling-3.0-tiny（:18080）↔ Unsloth（:8888），可切换，用户无感。
- **训练**：Unsloth Desktop API（:8888）。
- **Agent 桥接**：`unsloth start claude|codex|hermes|pi|openclaw|opencode`。

## 开发

```bash
npm run dev          # 前端
npm run tauri:dev    # 桌面
npm run tauri:build  # 打包
```

## 文档

- docs/PRD.md — 产品定义 / 终局架构 / 零术语词表
- docs/TASKS.md — Gate 任务看板
