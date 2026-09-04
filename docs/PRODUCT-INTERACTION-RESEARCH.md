# Anvil Product Interaction Research — UI follows the job

Status: BOARD + CTAB INPUT

## Principle

UI is not the product and does not define architecture. The product job defines the minimum interaction surface. For Anvil VS-001 the job is: delegate a real repository task, supervise meaningful state, inspect evidence, accept/reject.

## External evidence reviewed

### Codex app
Observed product pattern: projects/threads, isolated worktrees, parallel agent tasks, in-thread change review/diff, editor handoff, approvals, test/terminal context. The important lesson is not its visual layout; it is that long-running agent work needs a supervision/review surface rather than a chatbot shell.

### Codelegate
Observed pattern: Tauri desktop; new-session flow includes agent selection, repository picker/recent directories, optional worktree; session panes expose agent terminal and Git diff/stage state. Useful validation that repository + task/session + execution evidence can be a coherent desktop flow without requiring a generic chat home.

### OpenCode / other agent managers
Observed recurring pattern: sessions/projects separated from provider/runtime internals; diff/terminal/editor are evidence surfaces. Provider selection can exist, but it need not be the primary user action.

## Product conclusions

1. Anvil home should represent **work to be done**, not installed AI inventory.
2. Repository is task context, not a slash command or settings secret.
3. Plain-language task is the primary intent input.
4. Run creates a Task/Session; it does not mean "send a chat message".
5. Timeline is useful only when it represents durable TaskEvents: planning, approval, execution, tests, changed files, failure, completion.
6. Diff/test/log are evidence, not decorative developer panels.
7. Provider/model/tool selection belongs behind defaults or advanced controls unless the task requires user choice.
8. Approval must appear at the decision point, not require memorizing session IDs.
9. Worktree isolation is an execution property surfaced only enough for trust/recovery.
10. UI may change radically later without changing Task/CodingWorker/Event contracts.

## VS-001 interaction contract

```text
Open Anvil
  -> Select repository
  -> Describe desired change
  -> Run
  -> Task created
  -> Plan visible
  -> Approve / Reject
  -> Execution events
  -> Tests + changed files + diff
  -> Accept / Reject result
```

## Minimum screen model

This is an information hierarchy, NOT a visual design mandate:

- Context: current repository
- Intent: task description
- Primary action: Run
- State: queued/planning/waiting approval/running/testing/completed/failed
- Evidence: plan, logs when useful, tests, changed files, diff
- Decision: approve/reject plan; accept/reject result

## Explicitly rejected UI-driven decisions

- Rebuilding the product because another agent app has a prettier sidebar.
- Copying Codex/OpenCode visual structure.
- Keeping chat as home merely because current code already has CommandBar/Timeline.
- Exposing every adapter/provider because it exists in code.
- Adding terminals/editors/browser panels before VS-001 evidence shows they are needed.

## Later research questions

After VS-001 acceptance only:
- Multi-task / multi-agent supervision
- Resume/checkpoint UX
- Remote/mobile approvals
- Skill/tool management
- Rich artifact review
- Benchmark/evaluation/evolution surfaces

These are LATER and cannot expand current implementation scope.
