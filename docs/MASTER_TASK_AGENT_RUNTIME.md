# Master Task · Agent Runtime Foundation

## Objective

Turn Anvil from a unified local AI control center into a provider-agnostic Agent Runtime/Harness capable of powering sellable vertical AI employees.

## Phase 0 · Architecture lock

Deliverables:
- `AGENT_RUNTIME_ARCHITECTURE.md`
- `AGENT_PROTOCOL.md`
- `PROVIDER_ADAPTER_SPEC.md`
- `AGENT_FACTORY.md`

DoD:
- provider/model/tool boundaries defined;
- agent lifecycle defined;
- artifact completion defined;
- no new vendor-specific business logic introduced.

Status: DONE on `agent-runtime-foundation`.

## Phase 1 · Runtime contracts in code

Implement TypeScript contracts under `src/runtime/`:
- agent manifest
- run state
- events
- skills
- tools
- provider adapter
- artifacts

DoD:
- compiles with project TypeScript settings;
- unit tests cover state transitions and adapter registration;
- current UI can import contracts without vendor SDK dependencies.

## Phase 2 · Provider Registry + Router

Implement:
- provider registration;
- capability matching;
- health checks;
- fallback routing;
- local/cloud/privacy/cost policies;
- usage event emission.

Initial adapters should wrap existing Anvil integrations rather than replacing them immediately.

DoD:
- at least two providers can satisfy one compatible model capability;
- forced primary failure triggers fallback;
- workflow code has no provider-specific branch for the tested task.

## Phase 3 · Harness loop

Implement minimum loop:

```text
resolve -> assemble context -> plan -> act -> observe -> verify -> complete/retry
```

Include:
- max step guard;
- cancellation;
- approval pause state;
- run event timeline;
- deterministic completion check interface.

DoD:
- one demo task completes from request to artifact;
- one failure path retries safely;
- one risky tool call pauses for approval.

## Phase 4 · Skills

Implement Skill Registry and loader.

Compatibility goal:
- simple Markdown/instruction based skills;
- manifest-based typed skills;
- adapters for external skill conventions where useful.

DoD:
- a skill can be enabled/disabled without editing runtime code;
- the same skill can execute against two compatible model providers.

## Phase 5 · Subagents / delegation

Implement delegation contract, not vendor-specific subagents.

DoD:
- parent agent can delegate a scoped task;
- child context is bounded;
- child artifact/result returns to parent;
- loop prevents uncontrolled recursive spawning.

## Phase 6 · Computer / sandbox runtime

Create runtime capability interfaces for:
- shell;
- filesystem;
- browser/computer use;
- future cloud computer.

DoD:
- permission metadata visible before execution;
- irreversible/high-risk actions require policy check;
- runtime can swap local vs future cloud execution provider.

## Phase 7 · First sellable Agent Package

Default candidate: `Creator Chief Editor` or `Wedding Growth Director`.

DoD:
- one buyer/job/result definition;
- one-click package load;
- repeatable workflow;
- saved artifact outputs;
- cost/usage captured;
- no manual prompt engineering required by user.

## Not now

- building a universal Manus clone;
- building another desktop shell;
- marketplace before one agent proves willingness-to-pay;
- custom model training as a prerequisite;
- hard dependency on Grok/Claude/Gemini/OpenAI.

## Definition of success

Anvil succeeds when a new vertical AI employee can be created mostly from Agent Package + Skills + permissions, while the runtime remains unchanged.
