# Anvil v2 · TASKS

> Gate 结构 · v2.1 当前状态

## G1 文档（已交付）

- [x] PRD v2.1 定版
- [x] ARCHITECTURE v2 定版
- [x] TASKS v2.1 定版
- [x] README v2 定版

## G2 Timeline + CommandBar（已交付）

- [x] Timeline 组件（消息路由 + 类型分发）
- [x] CommandBar（命令解析 + /help 面板 + 自动补全）
- [x] Adapter Registry（registry.ts 自注册 + 命令映射）
- [x] 命令解析器（parse.ts：chat / command / builtin / error）
- [x] 联网搜索开关 + 搜索结果注入
- [x] 助手消息 markdown 渲染
- [x] 暗色模式

## G3 ling-adapter（已交付）

- [x] bridge 封装（chat + stream + 超时提示）
- [x] Timeline 渲染 + reasoning 折叠 + markdown
- [x] Timeline 默认视图
- [x] 多模型切换（bridge 多目标路由 — POST /target + INFERENCE_TARGETS 注册表）

## G4 dock-adapter（已交付核心）

- [x] execute() → dock CLI
- [x] session 卡片 + 审批按钮
- [x] plan 渲染 + 执行日志
- [ ] 子命令完整：approve / status / log / pr

## G5 pi + codex-adapter（骨架）

- [ ] /pi <prompt> → pi CLI（需 Tauri shell）
- [ ] /codex <prompt> → codex exec
- [ ] /codex quota → 配额

## G6 reasonix（骨架）

- [ ] /reasonix <prompt> → chat + 缓存率
- [ ] /reasonix plan → 结构化计划 + 审批
- [ ] /reasonix exec → 执行日志
- [ ] /reasonix mcp → 工具列表

## G7 dsh-adapter（部分交付）

- [x] /dsh start|stop|status（走 bridge）
- [x] /dsh plugins（bridge 查询）
- [x] /dsh run <prompt>（bridge POST）
- [ ] Level 4：插件自动注册为适配器
- [ ] Level 5：agent loop 真实路由（需 harness 初始化）

## G8 unsloth（bridge 网关）

- [x] bridge 端：status/checkpoints/start/train/stop
- [x] 前端 /train UI + loss 曲线（TrainView.vue 542 行 — 配置表单/检查点/实时状态/bridge 全接）
- [ ] 模型导出 + 自动加载

## G9 体验闭环（当前焦点）

- [ ] UI 排版大修 — 对齐 ChatGPT 最新布局
  - [ ] 助手消息左上角模型名标签
  - [ ] 用户气泡右侧首字母头像
  - [ ] 搜索结果胶囊色块
  - [ ] 空状态示例 prompt
  - [ ] 搜索按钮图标化+动效
- [x] 适配器 localStorage 持久化（anvil.adapter / anvil.search）
- [x] 会话持久化 + 多会话切换（conv-store.ts + conv-select 下拉 + 新对话/删除）
- [x] bridge 多模型代理（POST /target，/switch 同步切换推理端点）
- [x] smoke-test.sh 全链路（7/7 PASS）
- [x] 适配器自动注册数据源（bridge GET /capabilities — 前端拉取适配器清单）

## G10 清理

- [ ] v1 ChatView 剥离
- [ ] docs/internal/ + docs/public/ 分类
- [ ] GitHub + Gitee 双端推送