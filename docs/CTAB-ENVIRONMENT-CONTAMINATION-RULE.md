# CTAB Environment Contamination Rule

Status: FROZEN
Scope: Anvil immediately; candidate group-wide CTAB baseline.

## Principle

**Installed != Product Fit.**

Software, models, CLIs, local ports, frameworks, services, credentials or experiments present on a developer/founder machine do not constitute product requirements and must not silently become architecture dependencies.

## Admission gates

A local/external capability may enter the default product path only when all are true:

1. It directly improves the current primary user outcome.
2. The need is represented in Product Contract / Capability Ledger, not inferred from the machine environment.
3. Existing canonical assets cannot satisfy the requirement more simply.
4. CTAB approves the dependency direction and failure mode.
5. The product can explain or automate installation/configuration for the target user.
6. Removing the dependency would materially reduce an ACCEPTED capability.
7. Startup remains deterministic and failures are visible, recoverable and isolated.

Otherwise classify as one of:

- REFERENCE — research only.
- OPTIONAL_ADAPTER — explicit opt-in integration.
- DEV_TOOL — development environment only.
- LATER — valid future candidate, not current scope.
- REJECT — no product fit.

## Forbidden patterns

- Auto-registering a tool because it happens to be installed.
- Starting unrelated sidecars/services during application boot.
- Hard-coding localhost ports as hidden product prerequisites.
- Treating a founder's experimental model stack as target-user infrastructure.
- Showing integrations in default UI before the underlying capability is ACCEPTED.
- Expanding architecture after discovering a new GitHub project or local CLI without Change Contract + Asset Gate.

## Anvil application

During VS-001:

- Dock may enter the critical path only as the coding worker required by the accepted task flow.
- DSH, Ling, Unsloth, Reasonix and other discovered local tools are not startup dependencies.
- Codex/Pi/etc. belong behind the CodingWorker boundary and are replaceable execution providers.
- New installed tools default to REFERENCE or OPTIONAL_ADAPTER until separately admitted.

## Review question

Before adding any integration, CTAB must ask:

> If this software were not installed on Kim's computer today, would we still design Anvil to require it?

If the answer is no, it must not enter the core architecture.
