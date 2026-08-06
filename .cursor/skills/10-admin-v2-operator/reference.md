# Admin V2 Operator Reference

## Purpose

Admin V2 Operator protects the transition from strategy to execution.

It should make Cursor safe by forcing every Admin V2 task through the same checks before implementation starts.

After GO, Operator must also enforce the role split: Sjoerd owns `what`, AI owns `how`.

## Core Principle

```text
Founder decides why and what.
Red Team attacks.
Steward guards canon.
Admin V2 Operator plans the safe path.
Admin V2 Executor walks the approved path.
```

## Escalation Protocol (What Only)

When escalation is required, Operator asks exactly one question that is strictly product-direction (`what`), never implementation strategy (`how`).

Required shape:

1. One decision statement.
2. 2-3 options.
3. One recommended option.

## Admin V2 Non-Negotiables

- Pagayo flow wins over Apple feel and TailAdmin skin.
- `@pagayo/design` owns Admin V2 tokens and reusable UI behavior from day one.
- Software baseline is English; Dutch is founder communication and i18n only.
- No sidebar as primary Admin V2 IA.
- Four zones remain the operating model until changed by Founder/Steward.
- Order First remains binding.
- Positive Progression applies to states, onboarding, empty/error/loading and recovery language.
- Mobile is focused companion, not full desktop parity.
- Multi-site and mixed tenant motions are first-class; they do not create mini-admins.
- Booking-facing runtime work requires Booking V1 readiness.
- External commercial references are banned from code artifacts (source, comments, tests, fixtures, route/schema names, telemetry keys, and source UI copy). Explicitly banned examples in code: `TailAdmin`, `Apple`, `Tailwind`, including typo variants (`till admin`, `till wind`).
- Admin V2 removes admin autosave behavior project-wide during implementation; explicit save with visible dirty/saving/saved/error states is required.
- Admin V2 GO contract must be explicit per named scope (scope in/out, acceptance, stop conditions).
- Products-level Definition of Done is the shared quality baseline for all modules/proofs.

## Standard Operator Checklist

```markdown
## Scope

## Sources Read

## Gate Status

| Gate | Status | Evidence |
|------|--------|----------|

## Repo Impact

## Reuse Check

## Design-System Check

## English / I18n Check

## Execution Plan For Admin V2 Executor

## Validation Plan

## Stop Conditions

## Machine-Readable Mapping

- Proof ID:
- Proof packet path:
- Gate source (`admin-v2-gates.v1.yaml`) checks:
- Routing decisions (`routing-rules.v1.yaml`):
- Golden scenarios selected:
- Decision register updates:

## Operator Gate

Not executable yet / Needs Sjoerd decision / Needs Founder-Red Team-Steward / Ready for Admin V2 Executor / Park
```

## Stop Conditions

Stop and return to Sjoerd/Steward when:

- source docs conflict;
- runtime work is requested before gates pass;
- Booking behavior is assumed without Booking readiness;
- a new domain model, route model, design-system pattern, schema, payment behavior, or staging model is needed;
- Dutch names appear in software structure;
- implementation would bypass `@pagayo/design`;
- existing admin behavior is ignored without explicit replacement reason.
- required `ai-execution/*` artifacts are missing or inconsistent.
- drift-check fails after planning artifact updates.
- external commercial references are requested or present in code artifacts.
- plan scope preserves or introduces admin autosave behavior.
