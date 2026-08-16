# Anvil 本地 AI 工作台 · B站长视频文案

> 第一人称 · 柳俊明 · 真实教程

---

## 开场（30秒）

大家好，我是俊明。

今天聊个现实问题。我自己做自媒体、做摄影、也做 AI 内容工具开发。过去一年我桌面上的终端窗口越来越多——这边跑着 llama.cpp 做推理，那边开着 Unsloth 做训练，还有一个 Agent 框架在等模型加载。三个工具三个端口，每次切换大脑要在终端敲一串命令。整个流程是碎的。

所以我花了两个月写了一个东西，把我日常需要的三件事——推理、训练、Agent 协同——集成到一个桌面应用里。叫 Anvil，铁砧的意思。

今天跟你聊聊它是什么、能干什么、对你有什么用。

---

## 第一部分：是什么（3分钟）

Anvil 是一个本地 AI 工作台。它是一个 macOS 桌面应用，做三件事。

**第一，推理。** 你本地跑了一个模型，比如 Ling-3.0-tiny 或者任何 llama.cpp 兼容的模型，Anvil 的 ChatView 可以直接对话。支持流式输出、思考过程展开、发送前 token 预估。我在 PRD 里写的原则是——前端规则引擎是主引擎，LLM 是可选加速器。所有健康检查、故障恢复、大脑切换都走规则引擎，推理只在用户发起对话时调用 LLM。

**第二，训练。** Anvil 集成了 Unsloth Desktop。你可以在 TrainView 里选模型、选数据集、配超参数，一键开始训练。训练进度实时显示，日志流式输出，检查点列表直接从 Unsloth 拉取。不需要打开终端敲命令行。

**第三，Agent 协同。** 你在 ConnectView 里一键启动 Claude Code、Codex、Hermes、Pi 等编码 Agent，自动桥接到本地模型。我实测过几个场景：本地推理零成本、响应速度比云端快、数据不出本机。

架构上还有一个 DSH 守卫侧车（bridge.py），运行在 18443 端口，自动做健康检查、故障恢复、大脑切换。LLM 挂了它接管决策，不需要人盯着。这是我从 ToneLab 项目里带过来的模式——规则引擎为骨架、LLM 为血肉、分阶段状态机、分层调用、反馈闭环。

---

## 第二部分：能做什么（4分钟）

我列几个真实的用法。这些不是画饼，都是我在 M2 Pro MacBook 上跑通了的。

**场景一：本地编码助手**

我装了一个 Ling-3.0-tiny 模型，7.9B 总参数量、1.3B 每 token 激活参数，256K 上下文窗口。用 llama-server 跑在 18080 端口。Anvil 的 ChatView 连上去，流式对话、思考过程折叠展示。写代码、改 Bug、解释代码片段都很流畅。在我这台 16GB 内存的 M2 Pro 上首 token 延迟在 1-2 秒内。

**场景二：微调一个小模型**

如果你有一个特定场景——比如我婚礼行业的朋友想做一个话术生成模型——可以用 Unsloth Desktop 做 LoRA 微调。在 TrainView 里选基础模型、上传数据集、设一下 epochs 和学习率，点开始就行。Anvil 的 bridge.py 后台调 `unsloth train` CLI，进度实时推回前端。

需要什么硬件？Unsloth 官方说可以在 MacBook 上跑。实测 8GB 内存能跑 1B 级模型，16GB 可以跑 3B 级。不需要租云 GPU。

**场景三：编码 Agent 全本地运行**

你在 ConnectView 里点一下 "Claude Code" 按钮，bridge 会调 `unsloth start claude`，自动把 Agent 桥接到本地 Ling 模型。这样你写代码用的 AI 助手完全跑在本机上，数据不出门。对于做 AI 工具开发的、处理敏感代码的，这是一个实在的隐私优势。

---

## 第三部分：对我有什么用（2分钟）

如果你是以下这几类人，Anvil 对你可能有实际价值。

**做 AI 内容工具开发的。** 自媒体、视频生成、写作工具——如果你需要本地推理来做 R&D，不想每调一次模型就花云端 API 费用。我自己的 Creator OS 项目就是用这套架构跑的，每天几百次推理调用，零 API 成本。

**在本地跑模型做研发的。** 你不想依赖云端 API，或者你的场景需要低延迟。Anvil 一个窗口管推理、训练、Agent，不用记住三个不同的启动命令。

**每天用编码 Agent 写代码的。** Claude Code、Codex 这些 Agent 默认连云端模型。Anvil 让它们连到本地模型，响应速度和隐私都更好。

**做模型微调的。** 如果你已经在用 Unsloth，Anvil 给了你一个图形界面来启动和管理训练任务。不需要记住 `unsloth train --model xxx --dataset yyy` 的参数格式。

---

## 第四部分：哪些人群能用（1分钟）

Anvil 的目标人群很具体。

**开发者为主**——你用编码 Agent、跑本地模型、做微调训练。你需要终端能力，但不希望每次操作都打开终端。

**AI 内容创作者**——你做 AI 视频、AI 写作、AI 工具开发。你需要本地推理的稳定性和低成本。

**Unsloth 用户**——已经在用 Unsloth 做训练的，Anvil 给了一个本地 UI。

**隐私敏感用户**——你的数据不能上传云端，但你需要用 AI。全部本地运行。

不适合什么人？不做 AI 开发的普通用户暂时用不上。云端 API 调用量极小的人也用不上。但如果你每天对着终端敲 `python3 bridge.py`、`llama-server`、`unsloth train`，Anvil 就是帮你把这些集成到一个窗口里。

---

## 结尾（30秒）

Anvil 是我自己用的工具，我把它开源了。GitHub 搜 jaminliu89/anvil，私仓，MIT 协议。

安装很简单：

```
git clone https://github.com/jaminliu89/anvil.git
cd anvil
npm install
```

前提是你已经装好了 Ling-3.0-tiny 模型和 Unsloth Desktop。

整个项目还在 v0.3 阶段，很多功能还在迭代。但核心链路——ChatView 对话、RuntimeView 体检、GuardView 守卫、TrainView 训练——已经可以跑了。

如果你也在做本地 AI 工具链的整合，欢迎来 GitHub 看看。有用的话给个 star，有想法提 issue。

我是俊明，下期见。