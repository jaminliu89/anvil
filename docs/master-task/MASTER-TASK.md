# Anvil · Master Task

> 本地 AI 控制中心。一个桌面 App 管你机器上的所有 AI 能力。
> 项目真相源 —— 所有重大决策、架构、路线图都在这里。

---

## 当前状态

**阶段**: Alpha（核心骨架可用，功能深度参差不齐）

| 维度 | 状态 | 说明 |
|------|------|------|
| Timeline + CommandBar | ✅ 完成 | 统一会话流 / 斜杠命令 / 联网搜索开关 / 多会话 |
| ling-adapter（聊天） | ✅ 完成 | 流式对话 / reasoning 折叠 / fallback 链 |
| dock-adapter（编码） | ✅ 核心完成 | session 创建 / 审批 / 执行 |
| dsh-adapter（agent loop） | ✅ MVP 完成 | 三步 loop（分析→搜索→回答），SSE 流式 |
| unsloth-adapter（训练） | ⚠️ 部分完成 | TrainView 已接 bridge，导出未通 |
| pi/codex/reasonix-adapter | ❌ 骨架 | 依赖 Tauri shell invoke，等 Tauri 打包 |
| Tauri 桌面壳 | ❌ 骨架 | Rust 脚手架 + 插件已装，tauri dev/build 未跑 |
| 适配器自动发现 | ❌ 未做 | bridge GET /capabilities 已实现但前端未全量消费 |

---

## 路线图

### Phase 1 · DSH Agent Loop v2（当前迭代目标）

核心链：**reasoning 展示 → 多轮 agent loop → 网页抓取工具**

1. reasoning 流式展示（agent loop 的思考过程可见）
2. 多轮 agent loop（工具结果回喂 → 再思考 → 再调用工具）
3. 网页抓取工具（fetch URL 全文，配合搜索）
4. 端到端验证

### Phase 2 · 体验闭环

1. 修复 UI 红线（emoji、按钮高度、错误态）
2. 空/加载/错误三态全覆盖
3. 移动端适配（至少不溢出）
4. 信息密度提升（运行页、设置页）

### Phase 3 · 适配器补齐

1. 连接 Tauri shell invoke，让 pi/codex/reasonix 适配器可用
2. 适配器自动发现（bridge 启动时推能力列表到前端）
3. 适配器能力展示面板

### Phase 4 · Tauri 桌面壳

1. tauri dev 跑通 + 验证 Rust invoke
2. sidecar 打包到 bundle
3. 全局快捷键 + 托盘 + 通知
4. macOS 签名 + DMG 分发

### Phase 5 · 发布

1. 生产构建验证
2. GitHub Release + 三端备份
3. 用户文档

---

## 当前迭代：DSH Agent Loop v2

### 目标

把 agent loop 从「单轮三步」升级到「多轮 reasoning 可见」：

```
用户问 → 分析任务 → 搜索/抓取 → 基于结果推理 → 再行动 → 最终回答
```

### 增量改动

| 改动 | 文件 | 影响 |
|------|------|------|
| agent loop 流式输出 reasoning | bridge.py _dsh_run | SSE 新增 step_reasoning 事件 |
| 前端渲染 reasoning | dsh-adapter.ts + TimelineView.vue | agent-loop 卡片加 reasoning 折叠区域 |
| 多轮 agent loop | bridge.py _dsh_run | loop 内可以再调工具 |
| 网页抓取工具 | bridge.py | 新 /fetch 端点 + agent loop 可调用 |
| 端到端测试 | — | curl + 浏览器验证 |

### 验收标准

- [ ] /dsh 回答里显示模型的思考过程（reasoning 折叠）
- [ ] agent loop 可以自动决定多轮搜索（一轮不够再搜）
- [ ] agent loop 可以自动抓取网页全文
- [ ] 浏览器端卡片实时更新 reasoning 和步骤状态
- [ ] 构建通过（vue-tsc + vite build 无 error）

---

## 关键链接

| 文档 | 路径 |
|------|------|
| PRD | docs/PRD.md |
| 架构 | docs/ARCHITECTURE-v2.md |
| Decision Log | docs/decision-log/DECISION-LOG.md |
| Master Task | docs/master-task/MASTER-TASK.md（本文件） |
| 开发日志 | docs/dev-log/ |
| 调研 | docs/research/ |
| GitHub | github.com/jaminliu89/anvil |