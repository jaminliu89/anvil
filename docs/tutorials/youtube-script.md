# Anvil Local AI Workstation · YouTube Long-Form Script

> First person · 柳俊明 · Real tutorial with verified sources

---

## Hook (0:00 - 1:00)

If you run local AI models, you know the problem.

You have llama.cpp on port 18080 for inference. You have Unsloth Desktop on 8888 for training. You have Claude Code or Codex needing a model endpoint. Three separate tools, three ports, three startup commands, three config files. Every time you switch context, you type another shell command. It's fragmented.

I've been building AI content tools for my own workflow — I'm a photographer, content creator, and I develop AI video tools. For the past year, my desktop was covered with terminal windows.

So I built something that puts the three things I do every day — inference, training, agent orchestration — into one desktop app. Called it Anvil. It's open source, runs fully local, and it's the tool I actually use.

Let me show you what it is, what it does, and whether it's useful for your workflow.

---

## Part 1: What Is It (3:00 - 8:00)

Anvil is a local AI workstation. A macOS desktop app (Tauri v2 + Vue 3) that integrates three things into one window.

**1. Inference — ChatView**

Your local model — I run Ling-3.0-tiny, but any llama.cpp-compatible model works — runs on llama-server. Anvil's ChatView connects to it through a guard sidecar called the DSH Bridge (port 18443). You get streaming output, collapsible thinking traces, token estimation before sending, and normal/advanced mode switching.

The DSH Bridge is the key piece. It's a Python HTTP server running a rule engine that does health checks, fault recovery, and model health monitoring. The principle I follow: the frontend rule engine is the primary engine, LLM is an optional accelerator. All critical paths — is the model alive, should we switch endpoints, did the last call fail — go through hard-coded rules, not LLM prompts. This comes from my experience building ToneLab: rule engine as skeleton, LLM as muscle, staged state machine, layered calls, feedback loops.

**2. Training — TrainView**

Integrated with Unsloth Desktop. TrainView lets you select a base model, pick a dataset (HuggingFace or local file), set hyperparameters (epochs, learning rate, LoRA rank, batch size, max sequence length), and start training with one click. Progress streams live, logs scroll in real time, checkpoint list pulls from Unsloth directly.

The bridge.py sidecar handles the `unsloth train` CLI behind the scenes — you don't touch the terminal.

**3. Agent Orchestration — ConnectView**

One-click launch of coding agents — Claude Code, Codex, Hermes, Pi, OpenCode, OpenClaw — all bridged to your local model. The sidecar calls `unsloth start <agent>` and pipes it to your local endpoint. Zero cloud dependency, zero API cost per request.

Verified source: Unsloth.ai (accessed August 2026) confirms their Desktop supports connecting Claude Code, Codex, and other agents to local GPUs. The Ling-3.0-tiny model (HF: inclusionAI/Ling-3.0-tiny) has 7.9B total parameters, 1.3B activated per token, 256K context window, native function calling and thinking modes — verified on Hugging Face model card.

---

## Part 2: What Can It Do (8:00 - 14:00)

Let me walk through three real scenarios I run daily on a MacBook Pro M2 Pro with 16GB RAM.

**Scenario A: Local Coding Assistant**

Model: Ling-3.0-tiny Q4_K_M (bloomer010's GGUF). Runs on llama-server :18080 via the `ling-tiny` launch script. Anvil ChatView connects through the DSH Bridge.

What I get: streaming responses with thinking trace collapsed by default (expand to see reasoning), token estimation before sending so I know the cost, normal mode for quick Q&A and advanced mode for deeper reasoning. First token latency is 1-2 seconds on this hardware.

The model's hybrid MoE architecture means only 1.3B params activate per token — that's why it runs fast enough on a laptop.

**Scenario B: Fine-Tune a Small Model**

Say you want a custom model for your domain — wedding industry scripts, photography style prompts, customer service replies. Open TrainView, pick a base model (Ling, Llama 3.2 1B, Qwen 2.5 1.5B, etc.), point to a dataset, set epochs and learning rate, hit start.

The bridge spawns `unsloth train` as a subprocess and captures its output. You watch step count, loss, and elapsed time update in real time. Training logs stream into a scrollable pane. When it finishes, checkpoints appear in the list — you can open them in Unsloth Desktop for further use.

Hardware requirement: Unsloth Desktop runs on Mac, Windows, Linux. I've done 1B-parameter LoRA training on this M2 Pro 16GB. No cloud GPU rental needed.

**Scenario C: Fully Local Coding Agent**

With Ling running on :18080 and Unsloth Desktop online, open ConnectView. Pick Claude Code or Codex. Click start. The bridge calls `unsloth start claude`, which spawns the agent connected to your local model.

Now you have a coding agent running entirely on your machine — no data leaves your computer, no API calls go to OpenAI or Anthropic. For development work involving proprietary code, this is a real privacy advantage.

---

## Part 3: What's In It For Me (14:00 - 17:00)

Here's who gets value from this setup.

**AI content tool developers.** If you build AI video tools, writing assistants, or content generation pipelines — and you need frequent local model inference for R&D — Anvil eliminates the overhead of managing separate services. I route hundreds of inference calls daily through the DSH Bridge with zero API cost.

**Developers running local models.** You don't want cloud API dependency, or you need low latency. Anvil gives you a single window for inference, training, and agent bridging — no terminal juggling.

**Coding agent users.** If you use Claude Code or Codex daily, bridging them to a local model saves API costs and keeps your code private. Anvil makes that a one-click operation.

**Unsloth users already doing fine-tuning.** Anvil gives you a GUI for training launch and monitoring. You don't need to remember `unsloth train --model --dataset --epochs --lr` parameter syntax.

---

## Part 4: Who Is This For (17:00 - 19:00)

Primary audience: developers and AI content creators who already use local AI tools.

- You run llama.cpp, Ollama, or similar locally
- You use coding agents (Claude Code, Codex, etc.)
- You do model fine-tuning with Unsloth
- You handle sensitive data and prefer local processing

Secondary audience: anyone hitting terminal friction managing multiple local AI services. If you have three terminal tabs open just to keep your models running, Anvil consolidates them.

Not for: users who don't work with local AI at all. Cloud API users with minimal footprint. General consumers.

---

## Outro (19:00 - 20:00)

Anvil is open source, MIT license. GitHub repo at github.com/jaminliu89/anvil (private during development, public planned). Current version v0.3. Core features — ChatView, RuntimeView health checks, GuardView rule engine, TrainView with Unsloth integration, ConnectView agent launcher — are working.

Setup:
```
git clone https://github.com/jaminliu89/anvil.git
cd anvil
npm install
# Requires Ling-3.0-tiny GGUF model and Unsloth Desktop
# See docs/ for detailed setup
```

If you're doing local AI work and feeling the fragmentation, check it out. Star if useful, open an issue if you hit something.

I'm 柳俊明. Thanks for watching.

---

*Sources:*
- *Hugging Face: inclusionAI/Ling-3.0-tiny model card (accessed Aug 2026)*
- *Unsloth.ai official site (accessed Aug 2026)*
- *Project source: github.com/jaminliu89/anvil*
- *Measurements from personal testing on MacBook Pro M2 Pro (16GB RAM)*