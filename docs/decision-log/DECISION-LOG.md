# Anvil · Decision Log

> 所有重大决策都记在这里。半年后回看，知道为什么这么走。

---

## D001 · 技术栈：Tauri 2 + Vue 3

**日期**: 2026-08 上旬（项目启动时）
**决策**: 桌面端用 Tauri 2，前端用 Vue 3
**原因**:
- 本地 AI 工具需要桌面壳（系统快捷键、托盘、通知、sidecar 进程管理）
- Tauri 2 生态成熟，Rust 后端安全轻量
- Vue 3 上手快，组合式 API 适合中小型桌面应用
- 不选 Electron — 包太大，本地工具不需要
- 不选 React — 团队 Vue 更熟，且项目规模不需要 React 的生态复杂度

---

## D002 · 架构模式：Adapter Registry + 统一 Timeline

**日期**: 2026-08 上旬
**决策**: 所有 AI 工具通过适配器接入，统一在一条时间线里交互
**原因**:
- 工具会越来越多（ling/dock/pi/codex/reasonix/dsh/unsloth），每个做一套 UI 不可持续
- 适配器不是薄封装——每种工具保留自己的独特能力，输出格式不同但都在 Timeline 里渲染
- 用户只有一个入口，不用在窗口间切来切去
- 不选标签页模式 — 工具之间应该串联，不是孤岛
- 不选聊天模式 — Anvil 是编排层不是聊天工具，聊天只是 ling adapter 的能力

---

## D003 · 后端选型：Python sidecar（bridge.py）+ deepseek-harness

**日期**: 2026-08 中旬
**决策**: 推理守卫 + 工具调用用 Python sidecar，不直接在前端调 API
**原因**:
- deepseek_harness 是 Python 库，处理 reasoning 分离/tool_calls 抢救/usage 归一化
- 守卫层统一处理多端点 fallback、超时、错误抢救
- Python 生态工具多（搜索/爬取/文件处理），加工具成本低
- 不选纯前端 JS — 守卫逻辑复杂，JS 生态没有等价物
- 不选 Rust 后端 — 增加开发成本，且 AI 工具 Python 生态丰富得多

---

## D004 · DSH 命名修正：不是 Agent 框架，是守卫桥

**日期**: 2026-08-19
**决策**: 澄清 DSH (DeepSeek Harness) 的定位——它是推理守卫库，不是 agent 框架
**背景**: PRD 里写"DSH agent loop""dsh 插件生态"，实际 deepseek_harness pip 包只是个 chat client 加守卫（reasoning 分离 / tool_calls 抢救 / usage 归一化 / 缓存）。真正的 @deepseek-ai/dsh agent 框架是另一个 npm 包。
**影响**:
- 原来的 /dsh/run 接口是假的（404）
- dsh-adapter 是壳，没有真实后端对应
**行动**:
- 自己在 bridge.py 里实现最小 agent loop（三步：分析→工具→回答）
- DSH 适配器的定位改为「bridge 内置的 agent loop」，不依赖外部 dsh agent 框架
- _upstream 里如果将来要接真的 dsh agent 框架，另说

---

## D005 · Agent Loop MVP 范围：三步单轮

**日期**: 2026-08-19
**决策**: MVP 只做三步单轮 loop（分析任务 → 工具调用 → 生成回答），不做多轮
**原因**:
- 先验证核心体验是否对（步骤可视化 + 工具调用 + 流式回答）
- 多轮需要更复杂的状态管理和 token 控制，MVP 不需要
- 单轮也能覆盖 80% 的实用场景（搜索+总结、查资料+回答）
- 多轮等 v2，有真实使用反馈再做

---

## D006 · 工具 MVP 只做联网搜索

**日期**: 2026-08-19
**决策**: 第一个工具就是联网搜索（Tavily），其他工具后续加
**原因**:
- 搜索是最高频的工具调用场景
- Tavily 已经在 bridge 里集成了（/search 接口），复用成本最低
- 搜索结果直接增强回答质量，用户感知强
- 下一个工具候选：网页抓取（fetch URL 全文）

---

## D007 · 设计系统：Parchment 4.0 Black & White Editorial

**日期**: 2026-08
**决策**: 全量对齐 Parchment 4.0 黑白编辑风格
**原因**:
- 工具类产品需要克制、专业、高信息密度
- 黑白灰 + 极少强调色 = 内容本身是主角
- 已有完整的 token 体系和组件规范，不用从零设计
- 不选彩色渐变/玻璃拟态 — 与产品定位不符，且维护成本高

---

## D008 · 数据存储：localStorage MVP 版

**日期**: 2026-08
**决策**: MVP 阶段对话历史/设置全存 localStorage，不做后端持久化
**原因**:
- MVP 阶段快验证，不搞复杂的
- 数据量小（纯文本对话），localStorage 够用
- Tauri 的 store 插件后续可以上，但不是现在的优先级
- 等有真实用户+数据量大了，再迁移到 SQLite 或 store 插件

---

## D009 · Sidecar 通信协议：HTTP + SSE

**日期**: 2026-08
**决策**: 前端与 Python sidecar 通过 HTTP + SSE 通信，不用 Tauri invoke
**原因**:
- HTTP 是通用协议，调试方便，dev server 也能用（不需要 Tauri 壳就能开发）
- SSE 天然适合流式输出（推理/工具调用过程）
- 不选 WebSocket — 不需要双向通信，SSE + HTTP 足够
- 不选 Tauri command — Rust→Python 还要再套一层，增加复杂度，且 Web 模式下用不了

---

## D010 · 多推理端点策略：fallback 链

**日期**: 2026-08 中旬
**决策**: 主端点挂了自动 fallback 到 deepseek/siliconflow 等云端
**原因**:
- 本地模型不稳定，不能因为 Ling 挂了整个 app 就废了
- 用户大概率有云端 API key，做个自动切换体验好很多
- 守卫层统一处理，前端无感知
- 不选手动切换 — 用户不应该关心哪个端点在跑，能用就行

---

## 待决策（Pending）

- DSH agent loop v2 做多轮的话，最大轮数设多少？
- 工具列表扩展优先级：网页抓取 > 文件读写 > 代码执行 > 计算器
- 本地工具（pi/codex/dock）通过 sidecar shell 调用还是走各自的 HTTP API？
- 要不要做插件系统（用户可以自己加工具）？
- Tauri 打包什么时候做？现在纯 Web 能验证核心体验
