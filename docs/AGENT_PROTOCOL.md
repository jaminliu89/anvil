# Anvil Agent Protocol

## Goal

Define the minimum stable contract between products, agents, skills, tools, providers and artifacts.

## Agent manifest

```yaml
apiVersion: anvil/v1
kind: Agent
metadata:
  id: string
  name: string
  version: string
spec:
  role: string
  objective: string
  instructions:
    system: string
    project_files: []
  skills: []
  tools: []
  memory:
    working: true
    project: true
    long_term: false
  model_policy:
    route: auto
    preferred: []
    fallback: []
  runtime_policy:
    max_steps: 20
    allow_subagents: true
    allow_computer_use: false
  permissions:
    filesystem: scoped
    shell: approval_required
    external_write: approval_required
    spending: denied
  completion:
    required_artifacts: []
    checks: []
```

## Run state

```text
QUEUED
  -> CONTEXT_ASSEMBLY
  -> PLANNING
  -> EXECUTING
  -> OBSERVING
  -> VERIFYING
  -> COMPLETED

Failure / control states:
WAITING_APPROVAL
WAITING_INPUT
RETRYING
DELEGATED
FAILED
CANCELLED
```

## Event envelope

Every runtime event must be inspectable.

```ts
export interface AgentEvent<T = unknown> {
  runId: string;
  agentId: string;
  seq: number;
  type:
    | 'run.started'
    | 'context.assembled'
    | 'plan.created'
    | 'skill.started'
    | 'skill.completed'
    | 'tool.called'
    | 'tool.result'
    | 'approval.requested'
    | 'subagent.started'
    | 'subagent.completed'
    | 'verification.result'
    | 'artifact.created'
    | 'run.completed'
    | 'run.failed';
  timestamp: string;
  payload: T;
}
```

## Skill contract

```yaml
kind: Skill
metadata:
  id: topic-mining
  version: 1.0.0
spec:
  description: Find and rank content opportunities.
  inputs: []
  outputs: []
  required_tools: []
  required_context: []
  completion_checks: []
```

Skills should encapsulate repeatable expert behavior. A Skill may use prompts internally, but a prompt string alone is not a Skill.

## Tool contract

Tools expose capabilities, risk and side-effect metadata.

```ts
interface ToolDescriptor {
  id: string;
  description: string;
  inputSchema: object;
  sideEffect: 'none' | 'reversible' | 'irreversible';
  risk: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
}
```

## Provider contract

```ts
interface ModelProvider {
  id: string;
  capabilities: string[];
  health(): Promise<ProviderHealth>;
  invoke(request: ModelRequest): Promise<ModelResponse>;
  stream?(request: ModelRequest): AsyncIterable<ModelChunk>;
}
```

Provider-specific SDK objects must not cross this boundary.

## Artifact contract

An agent run is not complete merely because the model stopped generating text.

```ts
interface Artifact {
  id: string;
  runId: string;
  type: 'text' | 'file' | 'code' | 'image' | 'video' | 'dataset' | 'action_receipt';
  title: string;
  uri?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}
```

Completion must be judged against the requested outcome / DoD.
