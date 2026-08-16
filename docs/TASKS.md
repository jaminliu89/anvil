# Anvil · TASKS

> Gate 结构 · 每项完成打勾 · 按优先级推进

## G1 品牌与文档（地基）
- [x] G1.1 PRD.md 定版（终局 v2 / 双模式 / 零术语词表）
- [x] G1.2 品牌统一 Anvil（tauri.conf / index.html / Cargo.toml / tray / lib.rs）
- [x] G1.3 package.json 改名 anvil
- [x] G1.4 删除旧视图 + 旧组件目录
- [x] G1.5 ARCHITECTURE.md 落地

## G2 核心：对话链路（最重要）
- [x] G2.1 sidecar bridge.py（HTTP 服务包 DeepSeekHarness）
- [x] G2.2 Rust 管理器升级（spawn/kill/restart/health）
- [x] G2.3 前端 services/dsh.ts 改走 sidecar（:18443）
- [x] G2.4 ChatView 重写（消息流 + reasoning 折叠 + 守卫角标）
- [x] G2.5 发送前预估（estimate → 「预计消耗」）

## G3 运行页
- [x] G3.1 大脑状态卡（模型/速度/占用/心跳）
- [x] G3.2 体检按钮（doctor 可视化：绿/黄/红清单）

## G4 高级模式
- [x] G4.1 模式切换（settings store + 侧边栏过滤）
- [x] G4.2 守卫面板页（doctor/validate/probe/抢救日志）
- [x] G4.3 训练页接 Unsloth API — 傻瓜化训练 UI（模型选择/数据集选/LoRA参数/实时进度/检查点）
- [ ] G4.4 启动按钮改 spawn_sidecar（ConnectView → unsloth start claude --config unsloth_config.yaml）
- [x] G4.4a 连接页（agent 卡片 + unsloth 状态检测 + 三端状态）

## G5 打包与验收
- [x] G5.1 ARCHITECTURE.md 落地（三端架构 + 规则引擎宪法）
- [x] G5.2 pyinstaller 打包 sidecar（anvil-bridge ~400MB）
- [x] G5.3 tauri.conf externalBin 挂 sidecar + manager.rs find_binary()
- [x] G5.4 tauri.conf.json 已为 Anvil（productName / identifier）
- [ ] G5.5 全链路验收（Anvil 打开 → 对话 → 守卫生效 → 体检绿）
- [x] G5.6 tauri build 出 .app + .dmg（5.4MB aarch64）

## 验收标准（终局）
1. 普通用户打开 Anvil，60 秒内完成第一次对话
2. UI 扫描零违禁词（grep 词表为空）
3. 守卫真实生效（reasoning 分离 + usage 归一化可在响应中验证）
4. 切换端点（:18080 ↔ :8888）对话不断
5. tauri build 产物可双击运行