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
- [ ] T2.3 多 agent 共存规范：同一任务内子步骤展示（依赖数据结构，后续做）

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
