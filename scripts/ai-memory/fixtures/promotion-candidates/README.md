# Promotion Candidates

Gestructueerde voorstellen om kennis van L3/L4 naar L1 of L2 te tillen.

## Proces

```text
TRIGGER
→ DRAFT candidate
→ SUBMIT
→ REVIEW
→ APPLY canon
→ GENERATE mirrors
→ VERIFY
→ CLOSE
```

## Regels

| Regel | Detail |
|-------|--------|
| Agents | Mogen alleen **draft** candidates aanmaken — geen submit/approve |
| PR-merge | Promoveert **niets** automatisch naar L1/L2 |
| L1 beslisser | **Sjoerd alleen** — geen delegatie |
| L2 beslisser | Repo maintainer (repo-scoped) of Sjoerd (workspace) |
| Default | Geen promotie — PR reviews, chat, werkvoorbereidingen blijven L3 |
| Queue hygiene | `submitted` candidates ouder dan **14 dagen** blokkeren go-live (G10) |

## Bestandsnaam

`YYYY-MM-DD-{slug}.md` — gebruik [`TEMPLATE.md`](TEMPLATE.md).

## Na approval

1. Edit canon (`AI-OPERATING-CONTEXT.md` voor L1, of repo `AGENTS.md` voor L2) — **niet** mirrors
2. `npm run ai-memory:generate` (L1 wijzigingen)
3. `npm run ai-memory:verify`
4. Candidate status → `applied`

## Queue index

Handmatig bijhouden: telling open `submitted` candidates. Geen submitted > 14 dagen bij go-live.
