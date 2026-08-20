# Anvil Agent Contract

多 Agent 协作开发本项目时的统一约定。

## 必读书单

1. `SOUL.md` — 品牌人格与产品原则（先读这个）
2. `README.md` — 项目定位与架构
3. `src/styles/tokens.css` — Parchment 4.0 设计令牌
4. `src/adapters/` — 现有适配器实现模式

## 开发流程

1. 改动前先搜现有实现，确认没有重复造轮子
2. 小步提交，每个 commit 一个明确变更
3. UI 改动必须：`npm run dev` 启动 → 浏览器打开 → 截图验证 → 再声称完成
4. 功能改动必须：完整链路实测（从用户输入到最终输出），不能只测前端
5. 改完只验证改的那一块，不准顺手优化其他东西

## 编码任务的降级链

编码类任务（改代码、修 bug、写功能）必须遵守以下四层降级顺序。每层都有自己的内部探活链，上一层完全不通才下探下一层。

```
第 1 层 — Codex（最强代码大脑，首选）
  内部 fallback（按 codex config.toml 的 model_providers 顺序）:
    主 provider → 备用 provider 1 → 备用 provider 2 → ...

第 2 层 — Pi（轻量编码，Codex 全挂时降级）
  内部 fallback:
    主 provider（settings.json defaultProvider）
      → provider-cache.json（上次探活缓存的可用 provider）
        → models-store.json 里所有 provider 按顺序试

第 3 层 — Hermes agent loop（本地编排兜底，Pi 也挂了才用）
  内部 fallback（固定顺序）:
    1. 智谱 CodingPlan (zai / glm-5.2)
    2. 火山 CodingPlan (volc-coding-plan / ark-code-latest)
    3. 火山 AgentPlan (volcengine-agent-plan / ark-code-latest)
    4. DeepSeek 官方 (deepseek / deepseek-v4-flash)
    5. 火山按量 (volc-paygo / deepseek-v4-flash-ga-260731)
    6. 硅基流动 (siliconflow / deepseek-ai/DeepSeek-V4-Flash)

第 4 层 — Claude（特殊场景备用，不进自动降级链）
  两套模式:
    1. Claude Desktop（本地代理 15721 端口 → Anthropic API）
    2. Claude Code / cc alias（直连 SiliconFlow，绕过本地代理）
```

### 规则

- 每层内部先探活再调用，不通就切到该层下一个候选
- 当前层所有候选全挂，才降入下一层
- 用户只看到结果，不感知切换过程和当前在哪层
- 切换失败必须有明确错误提示，不能静默挂死
- 严禁把任何一个 agent 或 provider 设为单点依赖
- Claude 不进自动降级链——它是贵的，只在用户明确指定 `/claude` 时用

### 探活工具

本地探活脚本: `~/ScriptHub/devops/model-health.py`

```bash
model-health --all              # 探活全部 8 个源
model-health --agent codex      # 只探 Codex
model-health --agent pi         # 只探 Pi
model-health --check            # 只探 Hermes，不切换
```

- Hermes 段：主挂了自动切 fallback，并写回 config.yaml
- Pi 段：主挂了自动写 provider-cache.json 做修复
- Codex / Claude / ARK / ZAI / SF / DS 段：只读探活，不改配置

## Sidecar 铁律

- spawn 子进程时必须显式 `.env()` 注入所有需要的环境变量（API key 等）
- 不依赖 shell 环境变量继承，那是不可靠的
- 配置变更后必须 pkill 旧 sidecar 进程，防止端口复用旧实例
- 验证配置生效前，先确认端口没有残留 sidecar

## 不可触碰

- 不动用户已有项目的数据库和配置
- 不创建空壳功能（UI 有了但后端没通）
- 不硬编码假数据当真实状态
- 不暴露内部技术细节给普通用户界面
- 不加 emoji、渐变、玻璃拟态、发光效果

## 交付标准

- build 通过 ≠ 完成
- 界面好看 ≠ 完成
- 真实用户路径从头到尾跑通 = 完成
- 有降级方案、失败不挂死 = 完成
