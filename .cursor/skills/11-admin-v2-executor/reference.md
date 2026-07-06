# Admin V2 Executor Reference

## Purpose

Admin V2 Executor turns an approved Operator plan into concrete work.

It is deliberately narrower than Operator.

Executor does not decide product direction, architecture, staging model, design-system ownership, domain readiness, or canon status.

After GO, Executor leads execution and owns `how` decisions inside approved scope.

## Execution Checklist

Before editing:

```markdown
□ Approved Operator plan exists.
□ Repo-specific AGENTS.md read.
□ Task-specific Admin V2 contracts read.
□ Reuse targets inspected.
□ Design-system ownership checked.
□ English baseline checked.
□ Validation plan understood.
□ Stop conditions understood.
□ Repo routing resolved via `routing-rules.v1.yaml`.
□ Approved proof packet selected.
□ Golden scenarios selected.
□ Evidence schema fields understood.
```

During implementation:

```markdown
□ Scope stays inside Operator plan.
□ Existing patterns reused where possible.
□ No local design drift.
□ No Dutch software names.
□ No external commercial references in code artifacts.
□ No admin autosave behavior in delivered Admin V2 scope.
□ No hidden runtime/domain assumptions.
□ Products-level DoD baseline met for delivered scope.
□ GO-contract scope boundaries and stop conditions respected.
□ Tests/validation added or run as required.
□ Proof packet status and notes updated.
□ Evidence records captured in schema shape.
```

Before final response:

```markdown
□ Validation results reported.
□ Files touched listed.
□ Deferred decisions named.
□ No production/deploy claim unless explicitly authorized.
□ Drift-check run when Admin V2 canon or `ai-execution/` changed.
□ Decision register status updated when decision state changed.
```

## Escalate Back To Operator When

- the approved plan is ambiguous;
- implementation reveals missing domain behavior;
- `@pagayo/design` lacks required tokens/components;
- existing admin surfaces conflict with the new direction;
- route/schema/API/database changes are needed but not planned;
- a new state, grammar, module, tenant feature, or i18n rule is needed;
- mobile/tablet behavior requires a product decision;
- Booking, multi-site, organization-program or onboarding assumptions appear.

Escalations must be product-direction (`what`) only, never technical sequencing (`how`) only.

Code artifacts must not contain external commercial references (brand/vendor names) in source, comments, tests, fixtures, route/schema names, telemetry keys, or source UI copy. Explicitly banned examples in code: `TailAdmin`, `Apple`, `Tailwind`, including typo variants (`till admin`, `till wind`).

Admin V2 execution must remove admin autosave behavior from migrated scope and replace it with explicit save interaction and clear dirty/saving/saved/error feedback.

## Final Response Shape

```markdown
## Done

## Files

## Validation

## Deferred / Needs Operator

## Packet / Evidence / Decisions
```
