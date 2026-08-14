# 鲸团 · Implementation Tasks

> 按 Gate 推进，完成一个 Gate 才进下一个。每条任务 = 可验证交付物。

---

## Gate 1 · 文档与产品定义

- [x] G1.1 PRD v0.1（产品定位 / 功能范围 / 技术规格）
- [x] G1.2 ARCHITECTURE.md（分层架构 / 模块划分 / 数据流）
- [x] G1.3 ADR-001 技术选型（Tauri / Vue / DSH sidecar）
- [x] G1.4 ADR-002 产品定位（AI 助手团队心智）

## Gate 2 · 脚手架与基础框架

- [x] G2.1 Tauri v2 + Vue 3 + Vite + TS 脚手架
- [x] G2.2 Design tokens + 全局样式（深色扁平风格）
- [x] G2.3 路由 + Pinia stores（team / dsh）
- [x] G2.4 4 个预设助手配置（小文 / 阿码 / 小研 / 小创）
- [x] G2.5 团队首页 + 助手卡片组件
- [x] G2.6 对话页 / 设置页 / 引导页骨架
- [x] G2.7 git init + 首次 commit
- [x] G2.8 前端 build 通过 + Rust cargo check 通过

## Gate 3 · DSH 引擎接入

- [x] G3.1 调研 DSH Web UI 启动方式与接口（--port / --host）
- [x] G3.2 Rust DSH 进程管理器（启动 / 停止 / 端口分配 / 健康检查）
- [x] G3.3 Tauri commands（dsh_status / dsh_start / dsh_stop / dsh_port）
- [x] G3.4 前端 DSH service 封装（invoke + 事件监听）
- [x] G3.5 对话页 DSH Web UI 嵌入（iframe + 加载态 + 错误重试）
- [ ] G3.6 崩溃自重启（指数退避 + 最大重试次数）
- [ ] G3.7 端到端冒烟：App 启动 → DSH 启动 → Web UI 加载 → 能正常交互
- [ ] G3.8 内嵌 Node runtime 方案（用户不用自己装 Node）

## Gate 4 · 首启动引导

- [x] G4.1 引导页布局（3 步流程 + 进度指示）
- [x] G4.2 语言选择（中 / 英）
- [x] G4.3 API key 配置（输入 + 格式校验 + 本地存储）
- [x] G4.4 默认助手选择（4 个预设助手卡片式选择）
- [x] G4.5 引导完成 → 跳转到团队首页
- [x] G4.6 非首次启动跳过引导（路由守卫 + store 持久化）

## Gate 5 · 系统集成（桌面体验）

- [ ] G5.1 系统托盘（关闭窗口最小化到托盘 / 托盘菜单 / 快速唤起）
- [ ] G5.2 桌面通知（任务完成 / 需要审批 / 崩溃恢复）
- [ ] G5.3 单实例（重复启动聚焦已有窗口）✓ 插件已装
- [ ] G5.4 全局快捷键（Option+Space 唤起 / 隐藏）
- [ ] G5.5 开机自启（设置项 + 开关）
- [ ] G5.6 窗口状态记忆（大小 / 位置 / 最大化）✓ 插件已装

## Gate 6 · 体验打磨

- [ ] G6.1 会话历史列表与搜索
- [ ] G6.2 干活轨迹面板（工具调用实时展示）
- [ ] G6.3 审批卡片（同意 / 拒绝）
- [ ] G6.4 自定义助手（创建 / 编辑 / 删除）
- [ ] G6.5 工作区管理（添加本地文件夹）
- [ ] G6.6 插件中心（图形化浏览 / 安装 DSH 插件）
- [ ] G6.7 主题切换（深色 / 浅色 / 跟随系统）

## Gate 7 · 打包与交付

- [ ] G7.1 Tauri build 配置（macOS DMG + Apple Silicon）
- [ ] G7.2 应用图标 + 品牌信息
- [ ] G7.3 包体积验证（目标 < 150MB，含 DSH + Node）
- [ ] G7.4 冷启动时间验证（目标 < 5s）
- [ ] G7.5 全流程冒烟测试（安装 → 引导 → 对话 → 托盘 → 通知）
- [ ] G7.6 交付走查报告（三视角 PM/SA/UX）
- [ ] G7.7 README 完善（安装 / 使用 / 开发指南）

---

## 完成定义（DoD）

每个任务完成必须满足：
1. 代码已写入对应文件
2. 本地 build / check 通过
3. 无 TS / Rust 编译错误
4. 对应文档同步更新
5. git commit + 语义化 message
