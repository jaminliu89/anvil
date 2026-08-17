# Anvil v2 · TASKS

> Gate 结构 · v2.1 当前状态

## G1 文档（已交付）

- [x] PRD v2.1 定版
- [x] ARCHITECTURE v2 定版
- [x] TASKS v2.1 定版
- [x] README v2 定版

## G2 Timeline + CommandBar + 适配器框架

- [x] Timeline 组件（消息路由 + 类型分发）
- [x] CommandBar（命令解析 + /help 面板 + 自动补全）
- [x] Adapter Registry（registry.ts 自注册 + 命令映射）
- [x] 命令解析器（parse.ts：chat / command / builtin / error）
- [x] 适配器状态检测（status() → 头部显示）
- [x] 联网搜索开关（消息区 ↔ CommandBar 上方）
- [x] 助手消息 markdown 排版（代码块 / 标题 / 列表 / 引用 / 链接）
- [x] 暗色模式（Parchment 4.0 dark token）

## G3 ling-adapter（默认聊天）

- [x] ling-adapter 包装 bridge（chat + streamChat + 超时提示）
- [x] Timeline 渲染：消息气泡 + reasoning 折叠 + markdown
- [x] Timeline 设为默认视图（router / 指向 Timeline）
- [ ] 模型切换（ling / deepseek / dsh — 需 bridge 多模型路由）

## G4 dock-adapter

- [x] dock-adapter.execute() → dock CLI
- [x] /dock <prompt> → 创建 session → 渲染 session 卡片
- [x] plan 渲染：步骤列表 + [批准] 按钮 inline
- [x] 执行渲染：进度 + 日志
- [ ] 子命令：/dock approve / status / log / pr（部分实现）

## G5 pi-adapter + codex-adapter

- [ ] pi-adapter：/pi <prompt> → pi -p（需 Tauri shell 权限）
- [ ] codex-adapter：/codex <prompt> → codex exec
- [ ] /codex quota → 配额仪表盘

## G6 reasonix-adapter

- [ ] reasonix-adapter（调 Reasonix CLI / DeepSeek API）
- [ ] /reasonix <prompt> → 聊天（显示缓存率）
- [ ] /reasonix plan → 结构化计划 + [批准]
- [ ] /reasonix exec → 执行日志

## G7 dsh-adapter（DeepSeek Harness）

- [x] Level 1：/dsh start / stop / status — 生命周期管理（走 bridge）
- [x] Level 2：/dsh plugins — 插件发现（bridge 查询）
- [x] Level 3：/dsh run <prompt> — 任务路由（bridge POST /dsh/run）
- [ ] Level 4：dsh 插件自动注册为 Anvil 适配器
- [ ] Level 5：dsh agent loop 真实执行（需 harness 初始化）

## G8 unsloth-adapter

- [x] bridge 网关：/unsloth/status /checkpoints /start /train /train-stop
- [ ] 前端 /train UI：训练卡片 + loss 曲线
- [ ] 模型导出 + 自动加载到推理端点

## G9 体验闭环（当前焦点）

- [x] Timeline 设为默认首页
- [x] 侧边栏改造（时间线/对话/运行/训练/连接/守卫/设置）
- [x] 推理端点自动探活（bridge 启动时 probe + ollama serve）
- [ ] 搜索注入 + 自动上下文归并（搜索结果以系统消息注入）
- [ ] 适配器自动注册（bridge → 插件列表 → 前端自动注册）
- [ ] 排序/排版大修（对齐 ChatGPT 最新布局风格）

## G10 清理

- [ ] v1 ChatView / ConnectView 代码剥离
- [ ] docs/internal/ + docs/public/ 分目录
- [ ] repo 双端推送（GitHub + Gitee）