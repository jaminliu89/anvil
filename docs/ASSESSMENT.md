# Anvil 项目完整走查报告 — v2.1

**日期**: 2026-08-17  
**角色**: 首席产品架构师 + PM（代行 10 角色）  
**范围**: 代码/架构/体验/发布流程全链路

---

## 一、现状盘点

### 1.1 运行态

| 组件 | 端口 | 状态 | 备注 |
|------|------|------|------|
| Vite Dev Server | :5211 | ✓ | 前端热更新 |
| DSH Bridge | :18443 | ✓ | chat/stream/search/health 全通 |
| Inference (llama-server) | :18080 | ✓ | Ling 推理端点 |
| Dock API | :8710 | ✓ | 异步编码 session |
| DeepSeek Harness | :3000 | ✗ | 未启动，需 npx |
| Tauri Desktop | — | ✗ | 脚手架就位，未打包 |

### 1.2 功能完成度

| 能力 | 完成度 | 缺什么 |
|------|--------|--------|
| 聊天（→ Ling） | 90% | 排版大修，多模型切换 |
| 联网搜索（Tavily） | 90% | 搜索结果归并到上下文 |
| 适配器切换 | 85% | 自动注册（bridge → 前端） |
| dock 调度 | 70% | 子命令不全 |
| markdown 渲染 | 90% | 边缘 case（嵌套列表等） |
| 暗色模式 | 100% | Parchment 4.0 dark |
| pi/codex/reasonix | 20% | 等 Tauri shell 权限 |
| dsh 插件自动发现 | 30% | harness 初始化 + 注册管线 |
| Unsloth 训练 | 40% | 前端训练卡片 + loss 曲线 |
| Tauri 桌面打包 | 10% | 未完整验证 |

### 1.3 代码健康度

- 构建通过 ✓
- TypeScript 零错误 ✓
- 桥 Python 语法正确 ✓
- 无 dead code/console.log 遗留 ✗（少量）
- 无 security 红线（密钥不落代码） ✓

---

## 二、10 角色走查发现

### 2.1 PM — 产品方向
- **问题**: PRD 缺失（已补 v2.1）。产品定位清晰（本地 AI 控制中心），但价值主张没在 UI 上说清楚
- **建议**: 空状态放一句话+一个示例 prompt，不光是 logo

### 2.2 SA — 系统架构
- **问题**: DSH bridge 和 inference endpoint 是两层。bridge 是守卫，inference 是模型。但 bridge 启动时 `--target` 硬编码 `localhost:18080`，多模型切换无设计
- **建议**: bridge 接收 `target` 参数，前端 `/switch` 时 bridge 切目标（或加 proxy）

### 2.3 UX — 交互设计
- **问题**: 
  1. 消息气泡区域无用户头像/模型标签（ChatGPT 有粗体模型名+头像）
  2. 搜索按钮在 CommandBar 上方，但打开后无视觉反馈（只在搜索条里显示「每次聊天自动搜索网络」）
  3. 空状态提示文本不够直接
  4. 思考折叠区域「展开思考」四个字太小(12px)
- **建议**: 对齐 ChatGPT 最新布局——助手气泡左上角标模型名、用户头像右对齐、搜索按钮变图标+动效

### 2.4 FE — 前端实现
- **问题**: 
  1. markdown 渲染函数可能对某些边缘 case（合并引用、嵌套列表）处理不完整
  2. 搜索注入 + 上下文折叠逻辑 OK，但搜索结果以系统消息展示，用户感知不强
  3. 适配器切换后，`currentAdapterId` 持久化（刷新丢失）
- **建议**: 
  1. 搜索结果改为「[搜索来源：N 条]」系统消息，颜色区分
  2. 适配器加 localStorage 持久化

### 2.5 BE — 后端实现
- **问题**: 
  1. bridge `_dsh_plugins()` 尝试读 harness 的 `plugins` 属性，但 DSH harness 可能在 bridge 启动时未初始化
  2. Tavily key 从 `~/.hermes/.env` 读，依赖 Hermes 项目存在
- **建议**: 
  1. harness 初始化失败时降级返回空列表而非 503
  2. Tavily key 也支持从 `ANVIL_TAVILY_KEY` env var 读

### 2.6 QA — 测试覆盖
- **问题**: 零自动化测试。所有验证靠手动 curl + 浏览器查看
- **建议**: 加一个 smoke-test.sh，覆盖：bridge health → search → chat → dock sessions → vite build

### 2.7 Security — 安全
- **问题**: 
  1. Tavily key 明文在 bridge 进程 env 中（本地应用可接受）
  2. 无 CORS 白名单（当前 `*`，本地 dev 可接受）
- **建议**: Tauri 打包时限定 `Access-Control-Allow-Origin: tauri://localhost`

### 2.8 DevOps — 部署
- **问题**: Tauri 打包依赖 rsproxy.cn 镜像 + 1024×1024 icon 源文件
- **建议**: 写 `scripts/gen-icon.py` + `MAKE.md` 步骤

### 2.9 DM — 数据模型
- **问题**: 窗口状态/适配器选择/主题偏好无持久化
- **建议**: 用 `@tauri-apps/plugin-store` 或 localStorage 兜底

### 2.10 用户 — 真实体验
- **实测截图反馈**:
  1. 联网搜索结果以系统消息展示，用户说「看不到自己输出的信息」 ✓ 已修
  2. 推理端点没启动报超时 ✓ bridge 加自动探活
  3. 搜索按钮位置不合理 ✓ 已移到输入栏上方
  4. 助手回复没有排版 ✓ markdown 已加

---

## 三、下一页行动路线

### 3.1 立即（今日）

| 优先级 | 任务 | 角色 | 预计时间 |
|--------|------|------|----------|
| P0 | UI 排版大修（对齐 ChatGPT 最新布局） | UX + FE | 1.5h |
| P0 | bridge 多模型代理 + 切换 | SA + BE | 1h |
| P1 | 搜索结果归并 + 上下文折叠优化 | FE | 0.5h |
| P1 | 适配器 localStorage 持久化 | FE | 15min |
| P1 | smoke-test.sh | QA | 0.5h |

### 3.2 本周

| 优先级 | 任务 | 角色 |
|--------|------|------|
| P0 | Tauri 2 桌面壳完整验证 + 打包 | DevOps |
| P1 | dsh 插件自动注册管线 | SA + BE |
| P1 | pi/codex/reasonix Tauri shell 集成 | BE |
| P2 | Unsloth 训练 UI 卡片 | FE |
| P2 | docs 重组（internal/public） | DM |

### 3.3 下阶段

| 任务 | 说明 |
|------|------|
| 多模型切换 UI | /switch 时 bridge 切推理目标 |
| dsh agent loop 真实路由 | harness 初始化后路由到 DSH |
| GitHub + Gitee 双端推送 | v2-dev → main |
| 首次用户引导 | 空状态 + 示例对话 |

---

## 四、马上要做的第一件事

**UI 排版大修（对齐 ChatGPT 最新布局）：**
1. 助手气泡左上角标模型名（如「Ling-3.0-tiny」）
2. 用户消息右对齐（当前右对齐但无头像，加圆形首字母头像）
3. 搜索结果系统消息改为胶囊色块
4. 搜索按钮改为图标+文字（当前纯文字太低调）
5. 空状态由「Anvil + 一行提示」改为两行示例 prompt + 快捷键提示