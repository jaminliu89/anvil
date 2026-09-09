# Agent Factory

## Definition

Agent Factory is the product layer above Anvil Runtime. It packages reusable AI employees from configuration and assets instead of forking runtime code.

## Composition model

```text
Agent = Identity + Objective + Skills + Tools + Memory + Permissions + Model Policy + Deliverables + Commerce Policy
```

## User-facing creation flow

Do not expose model engineering first. Start from the job to be done.

```text
What employee do you want?
        ↓
Describe role + desired result
        ↓
Factory proposes capabilities
        ↓
Skills / tools / memory / permissions are assembled
        ↓
Run sandbox test task
        ↓
Check deliverables and cost
        ↓
Publish privately / to team / marketplace
```

## Initial vertical agents

### 1. Creator Chief Editor
- competitor research
- topic mining
- hook and outline generation
- script writing
- production planning
- performance review

### 2. Wedding Growth Director
- local competitor research
- high-performing topic extraction
- offer / buying-point mapping
- scripts
- sales follow-up plans

### 3. AI Product Manager
- evidence collection
- competitor capture
- PRD
- architecture
- master task
- QA / DoD review

### 4. Documentary Director
- character research
- relationship graph
- story beats
- interview questions
- shot list
- edit structure

## Package example

```yaml
apiVersion: anvil/v1
kind: AgentPackage
metadata:
  id: creator-chief-editor
  name: 短视频总编
  version: 0.1.0
spec:
  agent_manifest: ./agent.yaml
  skills:
    - creator.topic-mining
    - creator.script
    - creator.production-plan
  default_tools:
    - web.search
    - files.read
    - files.write
  pricing:
    mode: subscription
    meter: usage
```

## Marketplace-ready requirements

A package must provide:
- clear job and buyer;
- repeatable output;
- measurable DoD;
- isolated user/project data;
- permission declaration;
- cost ceiling or budget policy;
- provider-independent skills where possible;
- upgrade and rollback path;

## Product principle

The customer should buy a result-producing employee, not configure prompts, temperature, MCP servers and provider SDKs.
