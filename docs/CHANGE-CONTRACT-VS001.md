# Change Contract — Vertical Slice 001

ID: ANVIL-VS-001
Status: READY_FOR_IMPLEMENTATION
Risk: medium

## Intent

Turn Anvil from a developer-oriented multi-tool console into a founder-usable first task loop without rebuilding the whole product.

## User story

As the founder, I want to open Anvil, choose a repository, describe one coding task in plain language, watch execution, inspect the result and accept/reject it, without knowing slash commands or runtime internals.

## Current behavior

- Normal text defaults to chat.
- Coding work requires slash commands and hidden repo setup.
- App startup is coupled to optional DSH/local runtime services.
- Multiple unrelated subsystems are exposed before the first real task succeeds.

## Expected behavior

1. App shell launches even if optional model/DSH services are unavailable.
2. Primary surface asks for repository + task.
3. User selects repository through normal desktop UI.
4. User enters task in plain language and presses Run.
5. Anvil creates a Task/Session and delegates coding execution through the Dock worker boundary.
6. Plan/execution state is visible without commands.
7. Approval is a normal button/action.
8. Logs/test outcome/result are visible.
9. Changed files/diff are inspectable where available.
10. User can Accept or Reject.

## Explicitly not changing

- Brand name Anvil.
- Dock repository ownership/identity.
- Training functionality implementation.
- Penguin/DeepSeek/Codex reference policy.
- Group-wide runtime ambitions beyond what VS-001 requires.
- Existing advanced adapters except where necessary to quarantine them from the default path.

## Minimal product contracts

### Task

```ts
interface Task {
  id: string
  repoPath: string
  prompt: string
  status: 'draft' | 'planning' | 'awaiting_approval' | 'running' | 'succeeded' | 'failed' | 'accepted' | 'rejected'
  sessionId?: string
  createdAt: number
}
```

### TaskEvent

```ts
type TaskEventType =
  | 'task_created'
  | 'plan_ready'
  | 'approval_required'
  | 'execution_started'
  | 'log'
  | 'test_result'
  | 'diff_ready'
  | 'execution_succeeded'
  | 'execution_failed'
  | 'accepted'
  | 'rejected'

interface TaskEvent {
  id: string
  taskId: string
  type: TaskEventType
  timestamp: number
  payload: Record<string, unknown>
}
```

### CodingWorker

```ts
interface CodingWorker {
  health(): Promise<{ available: boolean; message: string }>
  create(task: Task): Promise<{ sessionId: string; branch?: string }>
  approve(sessionId: string): Promise<void>
  events(sessionId: string): Promise<TaskEvent[]>
  result(sessionId: string): Promise<Record<string, unknown>>
}
```

Dock should satisfy this boundary through adaptation. Anvil product code must not rely on Dock-specific slash commands.

## Allowed change zones

- `src/App.vue`
- router / primary task view
- new minimal task store/types/services
- Dock adapter/worker adaptation
- Tauri repository picker integration
- startup/sidecar initialization only as needed to make optional services lazy
- focused tests
- rescue docs/ledger

Any change outside these areas needs explicit justification in the PR.

## Forbidden changes

- adding providers/adapters;
- introducing a new runtime repository;
- rewriting Dock into a general runtime;
- implementing benchmark/evolution/training features;
- broad visual redesign unrelated to the task path;
- removing existing assets before asset classification proves they are dead;
- copying external harness code/structure as Anvil's contract.

## Acceptance criteria

### Machine verification

- frontend typecheck/build passes;
- Tauri development build can launch;
- app shell can open without optional DSH/model runtime being healthy;
- repository selection returns a valid local path;
- task submit produces a Task and visible state;
- Dock worker health failure produces a clear actionable state rather than a silent failure;
- with Dock available, create -> plan -> approve -> execute can traverse through UI;
- execution events are rendered on the task surface;
- success/failure is persisted long enough to inspect;
- existing quarantined features do not block launch.

### Founder acceptance / Kim Test

Without developer instructions, the founder can:

`Launch -> choose repo -> type real task -> Run -> see plan/status -> Approve -> see result -> Accept/Reject`

Target: <= 10 minutes for the first real task flow, excluding the coding agent's own task execution time.

## Evidence required before ACCEPTED

- build/test logs;
- launch evidence;
- one real VS-001 run with timestamps/states;
- result/diff/test evidence from that run;
- founder acceptance record.

Until all acceptance evidence exists, `ANVIL-CAP-008` must not be marked ACCEPTED.
