# Board + CTAB + Asset Governance Decision — Anvil Rescue

Decision status: **FROZEN FOR RESCUE PHASE 0**

## Board decision

- Keep **Anvil** as the existing product/brand candidate. Do not invent an OS-suffixed replacement.
- Current Anvil is classified FAILED / NOT USABLE until founder acceptance passes.
- Product value comes before architectural breadth: first restore one visible, usable task loop.
- No third runtime repository during Rescue Phase 0.

## Asset Governance decision

### Anvil
Role candidate: human control plane + owned runtime boundary.
Action: SALVAGE / REWRITE selectively; never assume README claims are working assets.

### Dock
Role candidate: coding execution worker / asynchronous scheduler.
Action: KEEP as a separate owned asset subject to fresh verification. Do not promote Dock into a general runtime by feature creep.

### DeepSeek Harness
Role: REFERENCE — kernel/plugin/loop design study.
Action: study, benchmark, independently design; no core dependency decision in Rescue Phase 0.

### Codex
Role: REFERENCE — sandbox/session/tool/execution study and optional worker integration.
Action: study behavior and boundaries; Anvil must not become a Codex skin.

### PenguinHarness
Role: REFERENCE — benchmark/evaluation/evolution/trace study.
Action: LATER for implementation; NOW only as research input to future contracts.

## CTAB decision

### Sovereign-stack rule

External harnesses are architectural research samples, not Anvil's source of truth. Public ideas and observed capabilities may inform requirements and benchmarks. Anvil owns its contracts, naming, dependency graph, implementation, tests and product behavior. Provenance/license records remain mandatory to prevent accidental third-party code contamination and future commercial risk.

### Frozen dependency direction

```text
Anvil Product / Control Surface
          |
          v
Owned Runtime Contracts
          |
          +--> Model adapters
          +--> Tool adapters
          +--> Workers
                 |
                 +--> Dock (coding execution)
                 +--> optional external coding agents
```

Forbidden during rescue:

- Dock depending on Anvil UI internals.
- Runtime depending on Anvil presentation components.
- Product UI directly integrating every model/agent/tool independently.
- Copying an external harness's internal API/file/class structure as Anvil's contract.
- Adding a new infrastructure layer without ADR + Asset Gate.

## Runtime minimum contract freeze target

Phase 0 design work may define only the minimum concepts required by the vertical slice:

1. Task
2. Session
3. Agent/Executor boundary
4. Loop/step boundary
5. Model boundary
6. Tool/Worker boundary
7. Event
8. Checkpoint/Resume

This list is a scope ceiling, not a requirement to build eight frameworks.

## Vertical Slice 001

User outcome: the founder opens Anvil, asks it to perform one real coding task, observes execution, receives a testable result, and can accept/reject it.

Acceptance path:

```text
Launch Anvil
-> choose/open repository
-> enter task in plain language
-> Run
-> visible planning/execution state
-> isolated coding execution through Dock/worker boundary
-> tests/results returned
-> inspect changed files/diff
-> Accept or Reject
```

## Stop conditions

Stop implementation and return to architecture/asset review if:

- the slice requires a second competing Session/Task model;
- a new runtime/repository is proposed without evidence the existing boundary cannot support it;
- a feature unrelated to Vertical Slice 001 is required merely because an external harness has it;
- README/product claims get ahead of Capability Ledger evidence.

## Definition of rescue success

Anvil becomes MVP only after Vertical Slice 001 is VERIFIED and then ACCEPTED through Kim Test. Until then, product status remains FAILED / NOT USABLE.
