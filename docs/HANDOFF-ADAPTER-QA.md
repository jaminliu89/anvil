# Anvil 接口 QA 交接文档

> 交接时间：2026-08-19
> 仓库：https://github.com/jaminliu89/anvil
> 当前分支：main
> 状态：Build 通过 (vite build ✓)，bridge 端点 100%，Rust 后端 31%

## 已完成

### Bridge 侧（Python sidecar :18443）
20 个端点全部可用，适配器侧 11 个引用全覆盖：
- 通用：/health /chat /stream /models /target /search /capabilities
- DSH：/dsh/health /dsh/run
- Unsloth：/unsloth/status /checkpoints /train /train-status /train-stop /export
- 其他：/doctor /estimate /salvage-log

### 前端适配器（TS 侧）7 个全部注册
- ling-adapter：流式对话 + reasoning 折叠 ✓
- dock-adapter：session / plan / approve / log / pr / repo ✓
- dsh-adapter：agent loop SSE 流式 ✓
- unsloth-adapter：train start/status/list/stop ✓
- pi-adapter：骨架完成，invoke 未接
- codex-adapter：骨架完成，invoke 未接
- reasonix-adapter：chat 走 bridge 凑合用，其余 invoke 未接

### Rust 侧已实现（4/13）
- dsh_start / dsh_stop / dsh_status / dsh_set_target

## 未完成（按优先级排序）

### P0 — Rust invoke 命令缺失（9 条）
三个 CLI adapter 的后端调用全挂，dev 模式下会报 "需要桌面环境"。

**pi（2 条）**
- `run_pi` — 执行 `pi -p <prompt>` 并返回 stdout
- `check_pi_installed` — 检测 pi CLI 是否可用

**codex（2 条）**
- `run_codex` — 执行 `codex exec <prompt>` 并返回
- `get_codex_quota` — 查询 codex 配额使用情况

**reasonix（5 条）**
- `check_reasonix_installed` — 检测 reasonix CLI
- `run_reasonix_plan` — `reasonix --plan` 返回结构化 steps
- `run_reasonix_exec` — 执行已批准的计划
- `get_reasonix_status` — 缓存命中率 / 子 agent 数 / 会话数
- `list_reasonix_mcp` — MCP 工具列表

实现模式参考 `src-tauri/src/dsh/commands.rs`，用 `std::process::Command` 调 CLI，结果用 String 返回。
注册到 `src-tauri/src/lib.rs` 的 `generate_handler!` 宏里。

### P1 — Unsloth 模型导出 + 自动加载
- bridge 已有 `/unsloth/export` 端点
- 前端 `unsloth-adapter.ts` 缺 `export` 子命令
- TrainView.vue 缺导出按钮 + 加载到 Ling 的流程
- TASKS-v2 G8 最后一项："模型导出 + 自动加载"

### P2 — dsh-adapter Level 4 / 5（架构目标，非紧急）
- Level 4：DSH 插件自动注册为 Anvil 适配器（bridge /capabilities → 前端动态 register）
- Level 5：agent loop 真实路由到 harness（当前是单步流式，不是多 agent 协作）
- 不影响基础功能，是架构演进方向

### P3 — G9 UI 排版大修（5 子项）
- 助手消息左上角模型名标签
- 用户气泡右侧首字母头像
- 搜索结果胶囊色块
- 空状态示例 prompt
- 搜索按钮图标化+动效

### P4 — G10 清理
- v1 ChatView 剥离（当前 TimelineView 已替代，但旧文件没删）
- docs/internal + docs/public 分类
- GitHub + Gitee 双端推送（目前只有 origin = GitHub）

## 关键文件

```
src/adapters/
  types.ts          # Adapter 接口定义（能力声明）
  registry.ts       # 注册 + 命令映射 + allStatuses()
  index.ts          # 7 个适配器静态注册
  intent.ts         # 意图猜测（输入实时推荐适配器）
  parse.ts          # 命令解析器（chat / command / builtin / error）
  ling-adapter.ts   # 默认聊天（bridge SSE）
  dock-adapter.ts   # dock API :8710
  dsh-adapter.ts    # agent loop（含 runAgentLoopStream 导出）
  pi-adapter.ts     # Tauri invoke 骨架
  codex-adapter.ts  # Tauri invoke 骨架
  reasonix-adapter.ts  # Tauri invoke 骨架 + bridge chat 凑合用
  unsloth-adapter.ts   # bridge HTTP

src/views/
  TimelineView.vue  # 主舞台（消息 + agent loop + 所有渲染）
  TrainView.vue     # 训练 UI（542 行）

src-tauri/src/
  lib.rs            # invoke_handler 注册入口
  dsh/commands.rs   # 已实现的 4 条 DSH 命令（参考模板）
  system_commands.rs

src-tauri/sidecar/
  bridge.py         # Python 桥（822 行，stdlib http.server）
```

## 验证方式

```bash
# 前端构建
cd anvil && npm run build

# 全链路 smoke test（需要 bridge + ling + dock 都在跑）
./scripts/smoke-test.sh

# Rust 编译
cd src-tauri && cargo build
```

## 下一步建议

1. 先补 Rust invoke 9 条命令（P0），三个 CLI adapter 才能真正跑通
2. 再接 unsloth 导出前端（P1）
3. UI 优化最后做（P3）
