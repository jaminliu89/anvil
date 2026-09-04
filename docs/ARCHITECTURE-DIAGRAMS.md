# Anvil Architecture & Sequence Diagrams

Status: Frozen direction; implementation grows only after capability acceptance.

## 1. Product architecture

```mermaid
flowchart TB
    U[Founder / User]
    UI[Anvil Product Surface]
    API[Owned Anvil Contract / API]
    ORCH[Task Orchestration]
    GOV[Governance\nDoD / Permission / Capability Ledger]
    EVT[Task Event + Evidence Store]

    U --> UI
    UI --> API
    API --> ORCH
    ORCH <--> GOV
    ORCH --> EVT

    ORCH --> CW[Coding Worker]
    ORCH --> RW[Research Worker LATER]
    ORCH --> DW[Design Worker LATER]

    CW --> DOCK[Dock]
    DOCK --> ENG[Replaceable Coding Engine]
    ENG --> WS[Isolated Workspace / Worktree]
    WS --> TEST[Test / Build / Diff]
    TEST --> EVT

    EVT --> UI
    UI -->|Accept / Reject| API
```

## 2. Dependency direction

```mermaid
flowchart LR
    UI[UI / Desktop] --> CONTRACT[Anvil Contract]
    CLI[CLI LATER] --> CONTRACT
    EXT[External Agent LATER] --> CONTRACT
    CONTRACT --> TASK[Task Runtime]
    TASK --> WORKER[Worker Interface]
    WORKER --> DOCK[Dock Adapter]
    WORKER --> OTHER[Other Adapters LATER]

    DSH[DeepSeek Harness] -. Reference .-> TASK
    CODEX[Codex] -. Reference / Provider .-> WORKER
    PENG[PenguinHarness] -. Reference .-> TASK
    OD[OpenDesign] -. Reference .-> CONTRACT
    RAK[Rakazo] -. Reference .-> WORKER
```

Dashed arrows are research influence, not runtime dependency.

## 3. VS-001 sequence

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Anvil UI
    participant RT as Anvil Task Runtime
    participant W as CodingWorker
    participant D as Dock
    participant E as Coding Engine
    participant G as Git Worktree

    U->>UI: Select repository
    U->>UI: Enter task + Run
    UI->>RT: createTask(repo, intent)
    RT-->>UI: task.created
    RT->>W: plan(task)
    W->>D: create session
    D->>G: create isolated worktree
    D->>E: request plan
    E-->>D: plan
    D-->>W: planReady
    W-->>RT: plan.ready
    RT-->>UI: Show plan + Approve/Reject

    U->>UI: Approve
    UI->>RT: approve(task)
    RT->>W: execute(task)
    W->>D: approve session
    D->>E: execute in worktree
    E-->>D: execution events
    D-->>W: logs/status
    W-->>RT: task events
    RT-->>UI: truthful running state

    D->>G: run tests / collect diff
    G-->>D: evidence
    D-->>W: result + evidence
    W-->>RT: completed(evidence)
    RT-->>UI: Tests / Diff / Result

    alt User accepts
        U->>UI: Accept
        UI->>RT: accept(task)
        RT-->>UI: ACCEPTED
    else User rejects
        U->>UI: Reject + feedback
        UI->>RT: reject(task, feedback)
        RT->>W: retry/replan
    end
```

## 4. Product state machine

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Planning: Run
    Planning --> AwaitingApproval: plan.ready
    AwaitingApproval --> Planning: Reject plan
    AwaitingApproval --> Executing: Approve succeeds
    Executing --> Verifying: execution finished
    Verifying --> Failed: verification fails
    Failed --> Planning: Retry
    Verifying --> AwaitingAcceptance: evidence ready
    AwaitingAcceptance --> Planning: Reject result + feedback
    AwaitingAcceptance --> Accepted: User Accept
    Accepted --> [*]
```

Important: UI must never transition to `Executing` before backend approval succeeds.

## 5. Future teammate model

```mermaid
flowchart TB
    ORCH[Anvil Orchestration]
    ORCH --> C[Coder Teammate]
    ORCH --> R[Research Teammate]
    ORCH --> D[Design Teammate]
    ORCH --> Q[QA Teammate]

    C --> CM[Memory / Skills / Workspace / Permissions]
    R --> RM[Memory / Skills / Workspace / Permissions]
    D --> DM[Memory / Skills / Workspace / Permissions]
    Q --> QM[Memory / Skills / Workspace / Permissions]

    C --> A[Artifacts + Evidence]
    R --> A
    D --> A
    Q --> A
    A --> HUMAN[Human Acceptance]
```

This diagram is NORTH STAR / LATER, not VS-001 scope.
