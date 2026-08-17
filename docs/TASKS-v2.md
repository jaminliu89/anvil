# Anvil v2 · TASKS

> Gate 结构 · 适配器体系 + dsh 双向集成 + 8 个适配器

## G1 文档（已交付）

- [x] PRD v2 定版（产品愿景、适配器体系、dsh 双向集成、8 个适配器）
- [x] ARCHITECTURE v2 定版（接口定义、7 个适配器设计、命令解析、Timeline、迁移路径）
- [x] TASKS v2 定版

## G2 Timeline + CommandBar + 适配器框架

- [ ] Timeline 组件（虚拟滚动、类型路由、adapter.render()）
- [ ] CommandBar（命令解析 + 自动补全提示 + 适配器标签）
- [ ] Adapter Registry（registry.ts + 自动命令映射）
- [ ] 命令解析器（parse.ts）
- [ ] 适配器状态检测（status() → 是否可用）

## G3 ling-adapter（默认聊天）

- [ ] ling-adapter 包装 DSH Bridge 调用（chat + streamChat）
- [ ] Timeline 渲染：消息气泡 + reasoning 折叠 + 耗时 + 缓存率
- [ ] Timeline 设为默认视图（跟 v1 ChatView 并存）
- [ ] 模型切换（Ling-3.0-tiny / DeepSeek API / Unsloth）

## G4 dock-adapter

- [ ] dock-adapter.execute() → dock CLI 调用
- [ ] /dock <prompt> → 创建 session → 渲染 session 卡片
- [ ] plan 渲染：步骤列表 + [批准] 按钮 inline
- [ ] 执行渲染：进度 + 日志折叠 + 改动文件 + PR
- [ ] 子命令：/dock approve / status / log / pr

## G5 pi-adapter + codex-adapter

- [ ] pi-adapter：/pi <prompt> → pi -p → 渲染结果
- [ ] codex-adapter：/codex <prompt> → codex exec → 渲染事件流
- [ ] /codex quota → 配额仪表盘

## G6 reasonix-adapter

- [ ] reasonix-adapter（调 Reasonix CLI / DeepSeek API）
- [ ] /reasonix <prompt> → 聊天（显示缓存率）
- [ ] /reasonix plan → 结构化计划 + [批准]
- [ ] /reasonix exec → 执行日志
- [ ] /reasonix status → 缓存 + 子agent + 会话统计
- [ ] /reasonix mcp → 工具列表 + 调用结果卡片

## G7 dsh-adapter（DeepSeek Harness）

- [ ] Level 1：/dsh start / stop / status — 生命周期管理
- [ ] Level 2：/dsh plugins — 插件发现 + 自动注册为 Anvil 适配器
- [ ] Level 3：/dsh run <prompt> — 任务路由到 dsh agent loop
- [ ] 渲染：agent 思考过程 + 工具调用 + 最终结果

## G8 unsloth-adapter

- [ ] /train list → 模型 + 检查点列表
- [ ] /train start → 训练进度 + loss 曲线
- [ ] /train status → 训练状态

## G9 灰度迁移

- [ ] Timeline 设为默认首页
- [ ] 侧边栏改造（命令列表 + 活跃 session + 适配器状态）
- [ ] v1 视图移到「经典视图」入口
- [ ] 模式切换（普通 → Timeline / 高级 → 经典视图可选）

## G10 清理

- [ ] v1 ChatView / ConnectView 代码剥离（保留在经典视图分支）
- [ ] 文档目录重组（docs/internal/ + docs/public/）
- [ ] repo 推送到 GitHub + Gitee