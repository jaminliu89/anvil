# Anvil Code Autopsy — Rescue Phase 0

Status: evidence-based audit of the current `main` implementation.

## Executive finding

Anvil's current failure is not primarily “missing code”. The codebase already contains many adapters, views and runtime pieces. The product failure comes from **wrong default path + hidden operational knowledge + startup coupling + scope overload**.

The current implementation behaves like a developer console for many AI subsystems, while the rescue target is a founder-usable task executor.

## Finding 1 — Default user path is chat, not task execution

`TimelineView.vue` treats normal text as `chat` and sends it to the currently selected adapter. Tool/coding execution requires command parsing and explicit adapter commands.

Impact:
- A founder typing “帮我修这个问题” is routed toward conversation, not automatically into a task/workflow.
- The product's default affordance conflicts with Vertical Slice 001.

Decision: **REWRITE ENTRY BEHAVIOR behind a minimal Task contract.**

## Finding 2 — Dock exists but is not productized

`dock-adapter.ts` already implements useful owned assets: create session, plan polling, approval, status/log and PR creation over Dock API.

But it requires internal knowledge such as:

- `/dock repo <path>`
- `/dock <prompt>`
- `/dock approve <sid>`
- `/dock log <sid>`
- `/dock pr <sid>`

Impact:
- Capability exists as developer commands but fails Founder Acceptance.
- Repository selection is hidden in localStorage/command syntax instead of normal product UI.

Decision: **KEEP Dock adapter logic as SALVAGE; REMOVE slash commands from the primary path.** Slash commands may survive only as advanced/debug affordances.

## Finding 3 — UI scope is broader than the accepted product

`App.vue` exposes Timeline, Chat, Runtime, Training, Connect, Guard and Settings. Advanced mode hides some items but the information architecture still centers subsystems rather than the user's job.

Impact:
- First-run cognitive load.
- Encourages feature-by-feature development instead of one outcome loop.
- Makes “what should I do here?” ambiguous.

Decision: **NARROW rescue UI to one primary task surface.** Existing views remain quarantined; do not delete until asset audit is complete.

## Finding 4 — Every adapter is registered into the active product surface

`src/adapters/index.ts` registers Ling, Dock, Pi, Codex, Reasonix, DSH and Unsloth together.

Impact:
- Integration count becomes a false measure of product progress.
- Product behavior inherits health/configuration problems from unrelated providers.
- Default experience can drift whenever another adapter is added.

Decision: **QUARANTINE nonessential adapters from Vertical Slice 001.** They are not deleted; they simply cannot participate in acceptance scope.

## Finding 5 — Startup is coupled to DSH sidecar and local environment assumptions

Tauri startup initializes a DSH sidecar manager. The manager searches a bundled binary or Python script, probes fixed paths, assumes Python availability, uses a fixed local port, and defaults toward a local inference endpoint.

Impact:
- Opening the desktop app implicitly depends on unrelated runtime infrastructure.
- A sidecar failure can make the app feel broken before the user starts a task.
- “Launch Anvil” is not a clean product boundary.

Decision: **DECOUPLE APP BOOT FROM OPTIONAL AI SERVICES.** App shell must open successfully first. Worker/provider health is lazy and task-scoped.

## Finding 6 — Existing adapter types are useful but not the runtime contract

`src/adapters/types.ts` provides reusable result concepts (`plan`, `execution`, `diff`, `log`, `pr`, etc.) and an adapter interface. This is useful UI/translation code, but it conflates provider adapters with product/runtime semantics.

Decision: **SALVAGE result/event vocabulary; do not promote the existing Adapter interface as Anvil's sovereign runtime contract without CTAB review.**

## Asset classification

| Asset | Decision | Why |
|---|---|---|
| Tauri + Vue shell | KEEP | Existing desktop foundation |
| Timeline rendering | SALVAGE | Useful event/result presentation |
| Dock HTTP adapter | KEEP/SALVAGE | Closest existing path to real coding execution |
| Slash-command UX | QUARANTINE | Developer affordance, not founder primary path |
| Ling/DSH/Pi/Codex/Reasonix/Unsloth adapters | QUARANTINE | Outside first acceptance slice |
| DSH sidecar auto-start | REWRITE | Startup coupling violates clean launch |
| Training/Guard/Connect views | QUARANTINE | Outside rescue scope |
| Existing adapter result types | SALVAGE | Useful vocabulary, not final runtime contract |

## Shortest rescue path

Do **not** rebuild Anvil.

Use the smallest coherent change:

```text
Existing Tauri/Vue shell
  -> new primary Task surface
  -> repository picker (normal UI)
  -> plain-language task submit
  -> owned Task/Session boundary
  -> Dock worker adapter
  -> plan/events
  -> visible Approve
  -> execution/log/test result
  -> diff/result
  -> Accept / Reject
```

Everything else is outside the acceptance path.

## Phase 1 code ceiling

Allowed changes should be limited to:

1. primary route / task surface;
2. repository selection;
3. minimal Task/Session/Event contract;
4. Dock worker bridge adaptation;
5. execution status and result/diff presentation;
6. startup decoupling required for reliable launch;
7. tests/evidence for the above.

Forbidden: new providers, training, evolution, benchmark system, plugin marketplace, new runtime repository, redesigning unrelated screens.
