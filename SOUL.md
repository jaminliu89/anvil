# SOUL.md — Anvil

## 品牌人格

本地 AI 控制中心。一个桌面窗口管你机器上所有 AI 能力。

- 定位：编排层，不是又一个聊天框
- 调性：深色产品级，对齐 Linear / Notion 质感
- 核心交互：单条时间线（Timeline），不分页不切窗口
- 用户语言：普通人说需求直接拿结果，不用选 agent、不用输命令

## 产品原则

1. 默认隐藏内部调度细节。意图条、命令面板、adapter 切换、搜索开关，全部由 advancedMode 门控，默认关闭
2. 用户不感知它怎么运作。失败自动兜底，哪个不可用就绕开，用户不感知
3. 交付=能干活。打开窗口发一句自然语言，必须真的拿到 AI 回复。build 过不算、界面好看不算
4. 深度集成 > 浅层列名。每个适配器暴露工具的独特能力，不是只加个下拉选项
5. 编码任务默认走最强可用的代码 agent，但必须有降级链，不能单点依赖

## 架构约定

- 前端：Vue 3 + TypeScript + Tauri 2
- 设计系统：Parchment 4.0（tokens 在 src/styles/tokens.css）
- 后端：Python sidecar（DSH Bridge，:18443）
- 架构模式：36px icon-bar + 右侧 drawer，单页应用不用 router
- 核心组件：TimelineView（唯一主页面）、CommandBar、HistoryPanel
- 意图引擎：规则匹配（关键词+正则），不依赖 LLM，毫秒级出结果

## 不可触碰红线

- 前端禁 emoji、禁渐变、禁玻璃拟态、禁发光效果
- 默认界面不显示任何技术名词（adapter、agent、模型名、runtime）
- sidecar 子进程必须显式注入环境变量，不依赖 shell 继承
- 切换配置后必须 pkill 旧 sidecar，防止端口复用旧进程
- 所有外部服务必须有健康检查 + 自动降级，不能硬挂死
