# Anvil — 本地 AI 控制中心

**你的机器上有多少个 AI 工具？每个都有不同的入口、不同的窗口、不同的操作方式。**

Anvil 把它们放进一个桌面 App。

---

## 管什么

| 能力 | 工具 |
|------|------|
| 本地推理 | Ling-3.0-tiny / 任何 llama.cpp 模型 |
| 云端推理 | DeepSeek API / 任意 OpenAI 兼容 API |
| 编码 Agent | Pi / Codex / Reasonix |
| 异步编码调度 | dock（worktree 隔离 + 计划审批） |
| Agent 框架 | DeepSeek Harness（插件生态） |
| 训练 | Unsloth Desktop（LoRA 微调） |

## 怎么管

一个命令栏，一个时间线。

```text
普通打字 → 跟本地模型聊天
/dock 修复 login 500 → 派异步编码任务
/reasonix plan 重构 → 生成计划，你批了再执行
/dsh run 复杂重构 → 路由给 DeepSeek Harness
/train lora → 启动微调
/ps → 看所有活跃任务
```

所有交互——聊天、计划、执行日志、diff、PR——出现在同一条时间线上。不分页、不切窗口。

## 不是又一个壳

Anvil 不把能力「抹平」。每种工具在 Timeline 里用自己的方式渲染：

- 聊天消息是气泡
- 计划是步骤卡片 + 审批按钮（inline）
- 执行是实时日志 + 进度
- 改代码是 diff 对比
- PR 是链接

## 谁需要它

- 每天用编码 Agent 写代码的开发者
- 在本地跑模型做产品原型的创作者
- 同时用多个 AI 工具，不想记端口和命令的人
- 想要本地隐私、不把代码上传到任何云端的人

## 当前状态

Developer Preview。Tauri 2 + Vue 3，MIT 开源。

```bash
git clone https://github.com/jaminliu89/anvil.git
cd anvil
npm install
cd src-tauri && cargo build --release
```

需要 Ling-3.0-tiny（:18080）和/或 Unsloth Desktop（:8888）运行。

---

GitHub: [github.com/jaminliu89/anvil](https://github.com/jaminliu89/anvil)