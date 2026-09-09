# Provider Adapter Specification

## Purpose

External AI systems are replaceable capability providers. Anvil owns the orchestration contract.

## Adapter categories

- `model`: GPT, Claude, Gemini, Grok, local LLMs.
- `coding_agent`: Codex, Pi, Reasonix, future coding agents.
- `runtime`: local shell, sandbox, cloud computer, browser/computer-use runtime.
- `service`: search, email, calendar, storage, media generation and other APIs.

## Required interface

```ts
export type ProviderCapability =
  | 'chat'
  | 'reasoning'
  | 'vision'
  | 'tool_calling'
  | 'code_edit'
  | 'shell'
  | 'computer_use'
  | 'background_job'
  | 'artifact_output';

export interface ProviderAdapter {
  id: string;
  category: 'model' | 'coding_agent' | 'runtime' | 'service';
  capabilities: ProviderCapability[];
  health(): Promise<{ ok: boolean; latencyMs?: number; detail?: string }>;
  estimateCost?(request: unknown): Promise<number | null>;
  invoke(request: unknown, context: AdapterContext): Promise<AdapterResult>;
  cancel?(runId: string): Promise<void>;
}
```

## Routing policy

Router decisions may consider:

1. capability fit;
2. local vs cloud requirement;
3. privacy policy;
4. expected quality;
5. latency;
6. cost / remaining quota;
7. provider health;
8. task type;
9. explicit user preference.

A workflow must never encode `if provider === ...` business rules when the difference can be represented as capability or policy.

## Benchmark registry

The CTAB benchmark registry should track external systems as reference implementations, not dependencies.

| Benchmark | Primary pattern to absorb | Status |
|---|---|---|
| Grok Build | Harness, loop, skills, hooks, MCP, subagents | Highest priority |
| Claude Code | Project context, skills, MCP, permission boundaries | Highest priority |
| Codex | Sandbox, code execution, repository workflows | Existing provider |
| Gemini | Computer-use / multimodal actions | Research + adapter target |
| Manus | Long-task runtime + artifact completion | Research |
| ChatGPT | Plugin/agent packaging + connected tools | Research |

## Anti-lock-in acceptance test

An adapter design passes only if:

- a provider can be disabled without changing agent manifests;
- the same skill can run on at least two compatible model providers;
- provider credentials and SDK types remain inside adapter modules;
- router fallback can select another provider after health/capability failure;
- usage/cost can be measured centrally.

## Future avatar/media providers

The same pattern extends beyond LLMs. LiveTalking, HeyGen and D-ID should eventually use an analogous Avatar Provider interface rather than entering Anvil core directly.
