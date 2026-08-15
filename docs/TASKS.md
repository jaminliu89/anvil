# Anvil · TASKS

> Gate 结构 · 每项完成打勾 · 按优先级推进

## G1 品牌与文档（地基）
- [x] G1.1 PRD.md 定版（终局架构 v2 / 双模式 / 零术语词表）
- [x] G1.2 品牌统一 Anvil（tauri.conf / index.html / Cargo.toml / tray / lib.rs）
- [ ] G1.3 package.json 改名 anvil
- [ ] G1.4 删除旧视图（TeamView / OnboardingView / ChatView 旧版）+ 旧组件目录
- [ ] G1.5 ARCHITECTURE.md 落地

## G2 核心：对话链路（最重要）
- [ ] G2.1 sidecar bridge.py（HTTP 服务包 DeepSeekHarness）
  - POST /chat（守卫全开）
  - POST /stream（SSE 流式）
  - GET /doctor
  - POST /estimate
  - 验收：curl 调通 :18080 走 DSH
- [ ] G2.2 Rust 管理器升级：sidecar 进程生命周期（spawn/kill/restart/health）
- [ ] G2.3 前端 services/dsh.ts 改走 sidecar（:18443）
- [ ] G2.4 ChatView 重写：消息流 + reasoning 折叠 + 守卫角标
- [ ] G2.5 发送前预估（estimate → 「预计消耗」）

## G3 运行页
- [ ] G3.1 大脑状态卡（模型/速度/占用）真实数据
- [ ] G3.2 体检按钮（doctor 可视化：绿/黄/红清单）

## G4 高级模式
- [ ] G4.1 模式切换（settings store + 侧边栏过滤）
- [ ] G4.2 守卫面板页（doctor/validate/probe/抢救日志）
- [ ] G4.3 训练页接 Unsloth API（:8888 模型列表 + 启动训练占位）
- [ ] G4.4 连接页（unsloth start 按钮化）

## G5 打包与验收
- [ ] G5.1 pyinstaller 打包 sidecar
- [ ] G5.2 tauri.conf externalBin 挂 sidecar
- [ ] G5.3 全链路验收：Anvil 打开 → 对话 → 守卫生效 → 体检绿
- [ ] G5.4 tauri:build 出 app

## 验收标准（终局）
1. 普通用户打开 Anvil，60 秒内完成第一次对话
2. UI 扫描零违禁词（grep 词表为空）
- 3. 守卫真实生效（reasoning 分离 + usage 归一化可在响应中验证）
3. 切换端点（:18080 ↔ :8888）对话不断
4. tauri:build 产物可双击运行
