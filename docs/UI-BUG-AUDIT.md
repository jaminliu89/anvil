# Anvil UI Bug Audit — Rescue Phase

Status: OPEN
Principle: UI does not define the product, but UI bugs that falsify state, block the core task, or expose implementation details are product bugs.

## Severity model

- BLOCKER — user cannot trust/complete the core flow.
- HIGH — major confusion, hidden prerequisite, wrong default path, or unrecoverable state.
- MEDIUM — degraded usability with a workaround.
- COSMETIC — visual issue only; defer until product path is accepted.

## Confirmed findings

### UI-001 — approval state lies before backend success
Severity: **BLOCKER**

Current Timeline plan button mutates `entry.data.approved = true` before `approvePlan()` has successfully returned from Dock. If Dock approval fails, the UI can still hide the approval button and show an approved/executing state.

Required behavior:

`idle -> approving -> approved` only after backend success.

On failure:

`approving -> approval_failed`, keep retry available, show real error.

Rule: presentation state must be derived from acknowledged TaskEvent/backend state, not optimistic mutation for irreversible actions.

### UI-002 — default text input routes to chat, not the product's core task
Severity: **BLOCKER**

Plain text defaults to the current chat adapter (currently Ling by default). A founder who types a coding task does not naturally enter the coding task flow.

Required behavior for VS-001:

Repository + plain-language task + Run creates a Task. Chat may later exist as a secondary surface.

### UI-003 — hidden slash-command prerequisites
Severity: **BLOCKER**

Dock workflow exposes internal commands such as `/dock repo`, `/dock approve`, `/dock log`, `/dock pr`. The user must know implementation syntax to complete normal product actions.

Required behavior:

Repository picker, Approve/Reject buttons, status/event timeline, Diff and result actions are normal UI controls. Slash commands, if retained, are advanced/diagnostic only.

### UI-004 — Runtime page exposes founder machine experiments as product concepts
Severity: **HIGH**

RuntimeView labels fixed localhost targets (18080/8888) as product-facing "主力模型 / 训练工坊模型". This makes the product architecture mirror one machine's installed environment.

Required action:

Remove RuntimeView from VS-001 primary navigation/critical path. Do not repair model-switch UI now. Reassess later behind optional provider settings if the capability earns admission.

### UI-005 — mandatory DSH health/status dominates global app state
Severity: **HIGH**

The top-level app status is derived from the DSH store and startup initializes DSH-related state. A missing optional inference sidecar therefore makes Anvil appear globally "未就绪" even when the core task UI could otherwise be usable.

Required behavior:

Global readiness must represent the accepted product path. Optional provider health belongs to integration diagnostics, not the product's primary readiness badge.

### UI-006 — auto web search defaults on for plain text
Severity: **HIGH**

Timeline defaults `autoSearch` to enabled unless localStorage explicitly disables it. Every plain-text interaction may incur a hidden network call and up to a 15-second timeout before the actual model action.

Required action:

Remove automatic search from VS-001. Tool usage must be task/agent-driven or explicitly user-selected later.

### UI-007 — too many top-level destinations before one accepted capability
Severity: **HIGH / IA defect**

Current navigation surfaces Timeline, Chat, Runtime, Training, Connect, Guard and Settings while the product has zero ACCEPTED capabilities. This creates false breadth and makes the default task path ambiguous.

Required behavior during rescue:

Primary surface = Task. Secondary minimum = Settings/diagnostics only if needed for the accepted slice. Other routes remain quarantined and may stay in code without being promoted in default navigation.

### UI-008 — execution truth is represented as conversation content
Severity: **HIGH**

System commands and execution operations are appended as chat-like timeline messages (for example `/dock approve <sid>`), mixing implementation syntax with product events.

Required behavior:

Normalize to TaskEvents such as `task.created`, `plan.ready`, `approval.requested`, `approval.accepted`, `worker.started`, `test.completed`, `diff.ready`, `task.completed`, `task.failed`.

### UI-009 — app close hides to tray by default
Severity: **MEDIUM / acceptance risk**

Tauri intercepts window close and hides the app instead of exiting. For a rescue build this can confuse startup/restart testing and leave hidden processes running.

Required action:

Review for VS-001 test mode. Product behavior may later intentionally use tray mode, but it must not obscure clean-boot acceptance evidence.

## UI rescue rule

Do not perform broad visual redesign before VS-001. Fix/replace only the surfaces necessary to make execution state truthful and the primary task path obvious.

### Allowed first UI slice

1. Repository selector.
2. Task textarea/input.
3. Run button.
4. Task status/events.
5. Approval state with real backend acknowledgement.
6. Result/tests/diff placeholders only when backed by real events.
7. Accept/Reject after verified result.

## Completion gate

No UI item is complete because it renders. It must be tied to real state transitions and verified against failure cases. In particular, irreversible/important actions must never display success before backend acknowledgement.
