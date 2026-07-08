---
id: KNOW-RESOLUTION-RULES-0001
type: canon
status: active
owner: knowledge-os
ai_priority: critical
---

# Knowledge Resolution Rules

AI must resolve documentation through the registry — never by browsing loose Markdown.

## Resolution order

Search in this order. Stop as soon as sufficient information is found for the task.

```text
Canon
  ↓
Reference
  ↓
ADR
  ↓
Playbook
  ↓
Historical
```

This matches the machine-readable `resolve-order` in `topic-registry.yaml`.

## How to resolve

1. Identify the task topic in `topic-registry.yaml`.
2. Load registry IDs from the topic in order: `canonical` → `references` → `adrs` → `playbooks` → `historical`.
3. Resolve each ID to its path via `canon-registry.yaml`.
4. Read documents in that order until the task is answerable.
5. Use code as implementation truth when documentation and code disagree.

## Stop rule

Stop descending the resolution order when:

- the Canon and Reference layers already answer the task, or
- an active ADR explicitly decides the question, or
- a Playbook defines the required operational steps.

Do not load Historical unless Canon, Reference, ADR, and Playbook are insufficient.

## Prohibited behavior

- Do not search the workspace for random `.md` files first.
- Do not treat unregistered documents as truth.
- Do not skip the topic registry when a matching topic exists.
- Do not load Historical or Archive to override Canon or active ADR.

## Registry authority

- Topics reference registry IDs only — never direct Markdown paths.
- Paths live exclusively in `canon-registry.yaml`.
- Topic mappings live exclusively in `topic-registry.yaml`.
