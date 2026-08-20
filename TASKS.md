# Anvil Redesign Tasks

基于终局思维的 6 阶段重构。每完成一项标记 done，按顺序推进。

## Phase 1 — 信息架构重构（骨架）
- [x] T1.1 建 TASKS.md + git 分支
- [x] T1.2 左侧导航从 7 项压到图标栏，砍掉对话/运行/训练/守卫一级入口
- [x] T1.3 路由从 7 page 压到 1 主 page + drawer 状态
- [x] T1.4 模式切换移入图标栏底部小圆点，不占常驻位

## Phase 2 — 时间线成为主舞台
- [x] T2.1 时间线布局：左侧时间轴竖线 + 右侧内容区
- [x] T2.2 agent loop 卡片重做：时间轴式步骤流 + 状态指示器
- [x] T2.3 多 agent 共存规范：同一任务内子步骤展示（agent 标签 + 嵌套子步骤时间轴，前端层完成；bridge 侧结构化 step 输出待后续）

## Phase 3 — 智能路由（去斜杠依赖）
- [x] T3.1 意图猜测条：输入时实时猜测用哪个 agent，显示在输入框上方
- [x] T3.2 Command Palette 重构：/ 触发分组命令面板（替代简陋 suggest）
- [x] T3.3 空状态建议卡片点击直接发送

## Phase 4 — 底部操作栏重组
- [x] T4.1 砍掉底部操作栏一排按钮
- [x] T4.2 历史对话移到左侧栏抽屉（HistoryPanel 组件）
- [x] T4.3 新对话移入历史抽屉顶部按钮
- [x] T4.4 联网搜索移到意图条右侧开关

## Phase 5 — 视觉打磨
- [x] T5.1 空状态 emoji 图标 → 统一线性 SVG 图标
- [x] T5.2 空状态视觉层级优化（品牌字加重 + 间距调整）
- [x] T5.3 右下角帮助按钮改 titlebar ? 图标（Phase 1 已完成）
- [x] T5.4 意图条文字层级优化（adapter 加字重 + 理由文字减淡）
- [x] T5.5 快捷按钮圆角 + hover 微交互统一

## Phase 6 — 次级功能抽屉化
- [x] T6.1 ConnectView → 抽屉适配（去 page-head + v2 token + 缩小尺寸）
- [x] T6.2 TrainView → 抽屉适配（去 page-head + 调整 padding，v2 token 后续细化）
- [x] T6.3 GuardView → 抽屉适配（完整重写样式 + v2 token）
- [x] T6.4 SettingsView → 抽屉适配（完整重写样式 + v2 token）
- [x] T6.5 RuntimeView → 抽屉适配（完整重写样式 + v2 token）

## Phase 7 — 统一调度（自然语言即入口）
- [x] T7.1 默认 adapter 改 dsh（agent loop 是万能入口）
- [x] T7.2 聊天消息自动路由：猜意图 → 选 agent → 同步/异步分流
- [x] T7.3 失败自动兜底：目标 agent 不可用就切 DSH
- [x] T7.4 系统操作自然语言触发（打开设置/历史/连接/训练等）
- [x] T7.5 文案去斜杠化：空状态/输入框/意图条全改成自然语言风格
- [x] T7.6 意图规则扩充：覆盖编码/搜索/训练/Jules/Claude/OpenClaw/Hermes 等触发词
- [x] T7.7 异步任务卡片（状态标签 + 步骤时间轴 + 批准按钮 + 错误态/完成态）
- [x] T7.8 dock adapter 深度接入：派单 → 状态更新 → 批准 → 结果回填
- [x] T7.9 Jules adapter 骨架（可用性检测 + 意图识别 + 自动降级）
- [x] T7.10 Claude Code adapter（bridge 代理 + 意图识别 + 异步任务卡片）
- [x] T7.11 OpenClaw adapter（bridge 代理 + 意图识别 + 异步任务卡片）
- [x] T7.12 Hermes Agent adapter（bridge 代理 + 意图识别 + 研究写作路由）
- [x] T7.13 Ollama adapter（本地模型聊天兜底）
- [x] T7.14 Bridge 异步 Agent 任务管理器（统一生命周期：create→status→log→approve）
- [x] T7.15 异步任务实时进度轮询（每 10s 前端轮询 status 更新卡片）
- [x] T7.16 Jules 完整流程（new→list→pull，bridge subprocess 代理）
- [x] T7.17 Antigravity (agy) 本地实时编码 adapter
- [x] T7.18 多任务队列视图（左侧栏增强，展示所有运行中任务）
