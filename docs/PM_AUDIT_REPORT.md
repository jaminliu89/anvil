# Anvil 产品经理审计报告 (PM Audit Report)

> **项目名称**：Anvil (本地 AI 工作站)
> **审计视角**：外部投资人评估 / 创始人复盘 / 快速产品迭代指南
> **审计日期**：2026 年 8 月
> **版本对象**：v0.1.0 ~ v0.3.0（重构终局架构 v2）

---

## 1. 执行摘要与产品定位 (Executive Summary)

### 1.1 产品愿景与核心痛点
Anvil 是一台**零门槛的「本地 AI 工作站」**。它的核心使命是将当下高度碎片化的本地 AI 工具链（模型推理、微调训练、编码 Agent 协同）整合进一个统一的桌面原生应用（Tauri v2 + Vue 3 + Python Sidecar），让开发者与内容创作者免于命令行配置、端口重叠与服务崩溃排查。

### 1.2 商业与产品独特性 (Value Proposition)
- **三位一体工作台**：单桌面打通 `llama.cpp` 本地推理、`Unsloth` 本地微调与 `Claude Code/Codex/Hermes` 编码 Agent 桥接。
- **规则引擎为主，LLM 为辅**：通过内置的 **DSH Guard (守卫侧车)**，实现纯规则驱动的健康检查、思考过程折叠分离、Token 消耗预估与工具调用抢救（Salvage）。即使 LLM 端点挂掉，工作站依然能静默抢救与优雅降级。
- **零术语极简体验**：将复杂的 AI 基础设施概念隐匿于后端，UI 层面全面实行“零术语”设计（用“大脑”替代“Endpoint”、用“发散度”替代“Temperature”、用“训练工坊”替代“LoRA 微调”）。

---

## 2. PRD 履约率与功能实现审计 (PRD & Implementation Audit)

审计团队针对 `docs/PRD.md` 与 `docs/TASKS.md` 约定的功能模块与实际前端 UI 及后端服务进行了逐行比对，履约审计结果如下：

| 模块 | PRD 约定功能 | 实际代码实现状态 | 履约评级 | 发现的差距 / 风险点 |
|---|---|---|---|---|
| **ChatView (对话页)** | - 流式 SSE 对话<br>- 思考过程折叠展示 (`<think>`) <br>- 发送前缓存与 token 预估<br>- 静默抢救角标 | - `src/views/ChatView.vue`<br>- `src/services/dsh.ts`<br>- `bridge.py` 中的 `_chat` / `_stream` / `_estimate` | **100% 达成** | 体验良好，思考过程能实时分离，流式失败时可自动回退至非流式。 |
| **RuntimeView (运行页)** | - 大脑状态卡（主力 vs 训练工坊）<br>- 端点热切换 (`:18080` ↔ `:8888`) <br>- 规则引擎三项体检 (doctor) | - `src/views/RuntimeView.vue`<br>- `manager.rs` 中的 `set_target` | **95% 达成** | 功能完备。轻微体验风险：切换到 `:8888` (Unsloth) 时，若未注入 Bearer Token 可能导致体检报错。 |
| **GuardView (守卫面板)** | - 协议加固可视化<br>- 环境体检清单<br>- 工具调用抢救日志 (salvage-log) | - `src/views/GuardView.vue`<br>- `bridge.py` 中的 `_doctor` / `/salvage-log` | **100% 达成** | 成功展示抢救模式历史与真实接口试调耗时。 |
| **TrainView (训练页)** | - 选基座模型 / 选数据集<br>- 高级参数（LoRA r, Epoch, LR）<br>- 训练 loss/step 实时轮询<br>- 检查点列表管理 | - `src/views/TrainView.vue`<br>- `bridge.py` 中的 `_unsloth_train` | **90% 达成** | UI 参数与后台 subprocess 执行均正常。缺乏训练产物“一键装载至推理路由器”的快捷联动按钮。 |
| **ConnectView (连接页)** | - Agent 卡片（Claude/Codex/Hermes 等）<br>- 桥接一键启动 (`unsloth start <agent>`) | - `src/views/ConnectView.vue`<br>- `bridge.py` 中的 `_unsloth_start` | **85% 达成** | 卡片展示与调用均就绪。存在违禁词“OpenAI”（违反零术语铁律）。 |
| **SettingsView (设置页)** | - 开机自启 / 主题切换<br>- 普通模式 / 高级模式切换 | - `src/views/SettingsView.vue`<br>- `src/stores/settings.ts`<br>- `App.vue` 侧边栏动态过滤 | **100% 达成** | 模式切换顺畅，主界面布局自适应表现优秀。 |

---

## 3. 零术语合规审计 (Zero-Terminology Compliance)

PRD 规定：**UI 严禁出现专业底层术语**（如 `llama-server`, `ngl`, `ctx_size`, `GGUF`, `endpoint`, `sidecar`, `harness`, `token`, `API key`, `OpenAI` 等）。

### 审计发现违规项：
1. **`src/views/ConnectView.vue` 第 6 行**：
   - 错误代码：`desc: 'OpenAI 编码 Agent（需安装）'`
   - 违规词：`OpenAI`
   - 整改建议：修改为 `'智能编码 Agent（需安装）'`。
2. **`src/views/TrainView.vue` 第 184 行**：
   - 错误文本：`<span class="label">侧车桥梁</span>`
   - 违规词：`侧车` (sidecar)
   - 整改建议：修改为 `<span class="label">守卫服务</span>`。
3. **`src/services/dsh.ts` 异常抛错信息**：
   - 错误文本：`throw new Error('sidecar ' + res.status)`
   - 违规词：`sidecar`
   - 整改建议：对用户展示的错误文本归一化为 `'守卫服务异常 (' + res.status + ')'`。

---

## 4. 市场定位与资本故事分析 (PMF, Competition & Monetization)

### 4.1 竞品对比与核心壁垒

| 维度 | Ollama / LM Studio | AnythingLLM / Chatbox | **Anvil (本项目)** |
|---|---|---|---|
| **核心定位** | 模型下载与纯推理引擎 | 知识库 RAG 与云端 API 客户端 | **端到端本地 AI 工作站（推理+训练+Agent）** |
| **微调能力** | 无 | 无 | **内置 Unsloth 训练引擎，UI 化一键 LoRA 微调** |
| ** Agent 编排** | 仅提供 API | 需自行配置复杂 Agent | **原生一键桥接 Claude Code / Codex / Hermes 等 CLI** |
| **故障容错** | 终端崩溃无感知 | 无 | **DSH 守卫侧车静默抢救工具调用，规则引擎主导** |
| **用户门槛** | 需了解 GGUF/Context 参数 | 需配置 API Key | **零术语黑盒化设计，打开即用** |

### 4.2 商业化路径 (Monetization & Unit Economics)
- **Freemium 模式**：个人版开源免费，提供完整桌面推理、训练与 Agent 桥接。
- **Enterprise Guard 订阅（企业安全守卫版）**：
  - 企业级代码与数据防泄露审计（Local Audit Trail）。
  - 自定义 DSH 守卫规则引擎（如敏感词拦截、合规输出强制修正）。
  - 多 Agent 团队协同与团队配置同步。

---

## 5. 用户体验与产品旅程走查 (UX & Product Journey Analysis)

1. **首次加载与预期管理**：
   - 现状：应用启动时，Rust `manager.rs` 启动 Python Sidecar 需要 2-5 秒健康检查轮询。
   - 亮点：顶部状态角标有“启动中”脉冲动画。
   - 改进点：首次启动若未检测到本地推理大脑（:18080），ChatView 的空状态提示可引导用户前往“运行”页选择或一键启动大脑。
2. **大脑热切换体验**：
   - 切换主力模型与训练工坊模型仅需一次点击，组件无感知无打扰，体验极为流畅。
3. **思考过程折叠**：
   - DeepSeek 原生 `reasoning_content` 及标准 `<think>` 标签均能自动分离，折叠样式美观，大大提升长文本阅读效率。

---

## 6. 技术架构与交付风险 (Technical & Release Risks)

1. **依赖环境风险 (Python Runtime & Unsloth CLI)**：
   - 当前在 macOS 开发模式下依赖系统 `python3` 及 `~/.unsloth/...` 路径。若用户未安装 Unsloth，训练与连接模块会处于离线状态。
   - **解法**：`G5.2/G5.3` 已实现了 PyInstaller 打包 `anvil-bridge` 二进制（~400MB），生产环境打入 macOS .dmg 即可做到自包含运行。
2. **单实例运行保护 (Single Instance)**：
   - 当前重复双击应用可能启动多个实例，引发端口 `:18443` 冲突。建议在 `tauri.conf.json` 中配置 single-instance 插件。

---

## 7. 30-60-90 天产品迭代路线图 (Product Roadmap)

```
┌──────────────────────────────────────────────────────────┐
│ 30 天：质量巩固与 MVP 交付                                  │
│ · 100% 消除 UI 违禁术语，规范错误提示                    │
│ · 增加单实例保护与启动离线引导卡片                        │
│ · 打包全自包含 DMG 镜像发布 v1.0.0                      │
└─────────────────────────────┬────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────┐
│ 60 天：功能增强与体验闭环                                   │
│ · 训练产物（LoRA 检查点）一键“装载至推理路由器”          │
│ · 模型管理中心（GUI 化下载 HuggingFace/GGUF 模型）         │
│ · 数据集可视化预览与简易编辑器                            │
└─────────────────────────────┬────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────┐
│ 90 天：商业化与生态扩张                                     │
│ · 企业级守卫审计面板（安全与合规日志）                    │
│ · 支持多模态本地模型（Vision / Audio）                    │
│ · 推出 Agent 社区模板与插件工作流                         │
└──────────────────────────────────────────────────────────┘
```

---

## 8. 总结与 PM 审计判定

**审计结论**：**通过 (Pass with minor polish)**
Anvil 项目在架构设计、零术语原则、DSH 守卫创新性与三位一体（推理+训练+Agent）的理念上具有高度的行业先锋性与资本吸引力。代码质量优良，PRD 履约率达到 95% 以上。

只要完成上述 3 项违禁词与错误提示的修补，该 MVP 即可作为具备高完成度的产品进行发布并向外部投资人呈递。
