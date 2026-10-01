# CTAB Technology Selection Audit — Anvil Rescue

Date: 2026-09-05
Decision: **CONDITIONAL GO — simplify before implementation**

## Executive decision

CTAB does not approve the current architecture as-is for continued feature development. It approves a constrained rescue stack for Vertical Slice 001.

### Approved NOW

- Desktop shell: **Tauri 2** — KEEP.
- Frontend: **Vue 3 + TypeScript + Vite** — KEEP.
- Existing Timeline presentation: SALVAGE.
- Owned runtime contracts: SELF-BUILD, minimal and framework-neutral.
- Dock: KEEP as an external owned coding worker/scheduler behind a contract, subject to fresh verification.
- Local persistence for Phase 0: lightweight local state only; do not introduce Postgres/Redis/vector DB.
- Git worktree isolation for coding tasks: KEEP through Dock.

### Remove from critical startup path NOW

- DeepSeek Harness sidecar.
- Ling local inference endpoint.
- Unsloth/training.
- Reasonix.
- automatic web-search dependency.
- direct multi-adapter routing from the primary product path.

These may remain quarantined code/assets but must not be required for Anvil to launch or complete VS-001.

## Why current selection failed as a product

1. Tauri shell startup initializes a DSH-oriented sidecar automatically, making a secondary experimental subsystem part of application readiness.
2. The product registers many adapters at once (Ling, Dock, Pi, Codex, Reasonix, DSH, Unsloth) before a single primary task path is accepted.
3. Plain-language input defaults to chat; coding execution requires knowledge of slash commands and hidden repository configuration.
4. Runtime/product contracts are currently adapter-shaped rather than task-shaped.

## Reference harness audit

### DeepSeek Harness
Classification: **REFERENCE / STUDY**.
Useful for: plugin composition, loop/kernel decomposition, extensibility principles.
Risk: upstream explicitly describes itself as developer preview with compatibility-breaking changes and warns it is not production-ready/security-audited. Therefore it is unsuitable as Anvil's critical runtime dependency.

### OpenAI Codex
Classification: **REFERENCE + OPTIONAL WORKER/ADAPTER**.
Useful for: thread/session lifecycle, resume, sandbox modes, streaming/steering/interrupt semantics, coding execution behavior.
Decision: do not make Anvil's owned runtime contract Codex-specific. Codex can be one worker/provider behind Anvil contracts.

### PenguinHarness
Classification: **REFERENCE / LATER**.
Useful for: benchmark, trace, evaluation, recursive optimization, multi-model gateway patterns.
Decision: none of these are required to rescue VS-001. Study later after the primary task loop is ACCEPTED.

### Dock
Classification: **OWNED ASSET / VERIFY + SALVAGE**.
Useful for: local async coding sessions, git worktree isolation, plan approval, logs, test/diff/PR flow.
Decision: preserve its narrow role. Do not expand Dock into the general Anvil runtime.

## Phase-0 target stack

```text
Tauri 2
  |
Vue 3 + TypeScript
  |
Anvil Task UI
  |
Owned minimal contracts
  |-- Task
  |-- TaskEvent
  |-- CodingWorker
  |
Dock HTTP adapter
  |
worktree + coding engine
```

The exact coding engine behind Dock is replaceable. Anvil must not care whether the worker eventually uses Codex, Pi, Claude or another engine.

## Contract rule

Product code depends on Anvil-owned contracts. Adapters depend inward on those contracts. External harnesses/providers never define the product-domain model.

## Security baseline

For coding execution:

- default to least privilege;
- isolate repository modifications in worktrees;
- require explicit approval before destructive/high-impact actions;
- expose execution status and changed files;
- never treat a model-generated command as trusted solely because a harness produced it;
- future sandbox work should benchmark Codex-style read-only/workspace-write/full-access separation, but implement Anvil's own policy surface.

## Explicitly rejected for VS-001

- New backend framework.
- New database infrastructure.
- LangGraph or another orchestration framework merely to implement the first loop.
- DeepSeek Harness as embedded kernel.
- PenguinHarness as embedded optimizer.
- Rebuilding Dock inside Anvil.
- Multi-agent DAG.
- Training/fine-tuning subsystem.
- Plugin marketplace.

## CTAB exit gate

Implementation may begin only against the frozen VS-001 Change Contract. The first engineering milestone is not feature count; it is:

`Anvil launches without DSH/Ling/Unsloth -> repository chosen via UI -> plain-language coding task -> Dock worker -> visible events -> result/diff -> Accept/Reject`.

If this cannot be achieved without adding another infrastructure layer, stop and reopen CTAB review.
