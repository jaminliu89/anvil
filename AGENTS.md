# AGENTS.md

## Repository mission

Anvil is the group's provider-agnostic Agent Runtime / Harness and local orchestration foundation.

## Core rules for every coding agent

1. Do not hard-code product logic to GPT, Claude, Gemini, Grok, Codex, Pi, DeepSeek Harness or any single vendor.
2. External capabilities enter through adapters/registries.
3. Prefer capability-based routing over provider-name conditionals.
4. Keep Agent Protocol stable; implementation details may change behind it.
5. Skills are versioned reusable assets, not loose prompt strings scattered through UI code.
6. Every meaningful run must produce inspectable events and a final Artifact or Action Receipt.
7. Risky/irreversible actions must pass permission policy before execution.
8. Runtime code must remain usable by multiple vertical agents without forks.
9. UI is a client of runtime contracts; UI choices must not define architecture.
10. Terminal/desktop/local-first remains valuable, but local is one runtime provider rather than a permanent hard limit.

## Working method

Before implementation:
- read `docs/AGENT_RUNTIME_ARCHITECTURE.md`;
- read `docs/AGENT_PROTOCOL.md`;
- read `docs/PROVIDER_ADAPTER_SPEC.md`;
- read `docs/MASTER_TASK_AGENT_RUNTIME.md`.

For each phase:
- produce code or file assets;
- define DoD;
- add tests where executable behavior exists;
- preserve backward compatibility where practical;
- document architecture decisions that affect future agents.

## Benchmark policy

Grok Build, Claude Code, ChatGPT, Gemini, Manus, Codex and other systems are benchmarks/providers. Absorb reusable primitives and interaction patterns; do not copy brand-specific product surfaces or create architectural lock-in.

## Current priority

Phase 1 of `docs/MASTER_TASK_AGENT_RUNTIME.md`: runtime contracts in code.
