---
name: 00-01-commit-push
description: Executes Pagayo release playbooks 00 (pre-commit) and 01 (commit/push)—workspace status, branch ensure, scope review, migration checks, preflight, commit, push. Stages all relevant dirty files before commit. Use when Sjoerd asks for playbook 00, playbook 01, commit/push, pre-commit checkpoint, deployer-preflight, or batch commit. No staging deploy (02), no production (04), no gh workflow dispatch except run watch after push.
---

# Playbook 00 & 01 — Commit / push

Lees /Users/sjoerdoverdiep/my-vscode-workspace/pagayo-vault/.github/release-playbooks/README.md
Voer alleen 00-pre-commit.md en 01-commit-push.md uit.
Vergeet niet dirty files te mee te nemen.

Je bent verantwoordelijk voor **lokale git-schrijfacties**: status, stage, commit, push, branchkeuze, preflight/postpush. **Geen** staging-deploy (02), **geen** productie (04), **geen** `gh workflow run` (behalve `gh run watch` na push waar van toepassing).

## Leesvolgorde

1. `pagayo-vault/.github/release-playbooks/README.md` (index + design-parity invariant)
2. `pagayo-vault/.github/release-playbooks/00-pre-commit.md` (lokaal checkpoint)
3. `pagayo-vault/.github/release-playbooks/01-commit-push.md` (push + preflight)
4. Bij stack-aannames: `pagayo-vault/STACK-MANIFEST.md`

Uitgebreide referentie: [reference.md](reference.md)

## Dirty files (verplicht)

**Alle relevante dirty files horen in de commit** — niet alleen het bestand waar je net aan werkte.

1. **`git status`** in elke repo die je commit; noteer **alle** modified/untracked die bij het onderwerp horen.
2. **Stage expliciet:** `git add` op alle scope-bestanden (generated output, lockfiles, `.pagayo/preflight-attestation.json`, `design-asset-version.ts`, manifest entries, enz.).
3. **Vóór branch-switch/checkout/merge/rebase:** dirty tree = stop. Eerst committen of stashen — nooit wisselen met onbedoeld achtergelaten werk.
4. **Sibling-repo's:** storefront-preflight faalt als **`pagayo-design` nog open wijzigingen** heeft (CHECK 7) — commit design eerst of neem mee in dezelfde batch.
5. **Niet committen:** secrets, `.env`, tijdelijke logs, build-artefacts die repo-policy uitsluit (check `git status` + `.gitignore`).

## Fase A — Playbook 00 (pre-commit, lokaal)

```
Task Progress:
- [ ] 0. workspace-status.sh (read-only dashboard)
- [ ] 1. ensure-branch.sh per repo
- [ ] 2. git status + scope-review (alle dirty files bij onderwerp?)
- [ ] 3. Schema/migration? → copilot-migration-check.sh
- [ ] 4. Design-triggers? → README-keten (zie reference.md)
- [ ] 5. Logische commit(s); WIP → prefix wip:
- [ ] 6. git commit (geen push in deze fase tenzij Sjoerd push vraagt → fase B)
```

### Stap 0 — Workspace dashboard

```bash
/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance/.github/scripts/workspace-status.sh
```

Rode repo's of design-drift: eerst opruimen vóór nieuwe brede wijzigingen.

### Stap 1 — Branch

```bash
/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance/.github/scripts/ensure-branch.sh /pad/naar/repo
```

- ✅ Op `feature/batch-staging-YYYYMMDD*` → doorgaan.
- 🔴 Dirty tree → **commit/stash eerst**, dan pas switch.
- 🟡 Verkeerde branch → script maakt `feature/batch-staging-VANDAAG` en switcht.

Optionele suffix: `ensure-branch.sh /pad/naar/repo mijn-feature`

### Stap 2–5 — Scope en commit

- **Één commit = één verhaal.** Ander werk → aparte commit of `git stash push -m "…"`.
- **Stage alle dirty files** die bij dat verhaal horen vóór `git commit`.
- **Commit-stijl:** `wip:` voor bewust tussenwerk; anders conventionele messages.
- **00 doet geen push** tenzij Sjoerd expliciet push/commit-push vraagt → ga door naar fase B.

**00 sluit uit:** `git push`, verplichte preflight (wel vrijwillig), `gh` workflows, staging/productie-deploy.

## Fase B — Playbook 01 (commit + push)

```
Task Progress:
- [ ] 1. git status, branch, remote-sync
- [ ] 2. deployer-preflight.sh (groen verplicht vóór push)
- [ ] 3. Attestatie gewijzigd? → commit mee vóór push
- [ ] 4. Schema/migration batch? → copilot-migration-check.sh
- [ ] 5. pagayo-storefront? → npm run ci:doctor vóór push
- [ ] 6. Stage alle resterende dirty files → commit
- [ ] 7. git push (niet naar main zonder expliciete toestemming Sjoerd)
- [ ] 8. Push main? → deployer-postpush.sh
- [ ] 9. gh run watch --exit-status tot eindstatus
- [ ] 10. Bij CI-failure: `ci-failure-match.sh --run <ID> --repo Pagayo/<repo>` vóór fix (catalog SSoT)
- [ ] 10. Rapportage (template onder)
```

### Preflight (verplicht vóór push)

```bash
/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance/.github/scripts/deployer-preflight.sh /path/to/repo
```

- Als `.pagayo/preflight-attestation.json` wijzigt: **commit dit mee** vóór push.
- **Niet doorgaan** na mislukte preflight.

### Migration check

```bash
/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance/.github/scripts/copilot-migration-check.sh
```

Faalt = fix vóór commit/push (manifest, version bump, generated output, consumer-lockfile-drift).

### Storefront lokale CI vóór push

```bash
cd /Users/sjoerdoverdiep/my-vscode-workspace/pagayo-storefront && npm run ci:doctor
```

Bij rode GitHub CI: `npm run ci:replay -- --from-gh` of shards — zie `pagayo-storefront/docs/LOCAL-CI.md`.

### Push naar main (alleen na toestemming Sjoerd)

```bash
cd /path/to/repo && \
  /Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance/.github/scripts/deployer-preflight.sh . && \
  git push origin main && \
  /Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance/.github/scripts/deployer-postpush.sh .
```

Attestatie gewijzigd na preflight → opnieuw committen, preflight, push.

## Harde grenzen

Nooit zelfstandig:

- Push naar `main` zonder expliciete toestemming Sjoerd (workspace `AGENTS.md`).
- Productie-deploy (→ playbook 04).
- `git reset --hard`, `git clean -fd`, force-push, history rewrite zonder expliciete toestemming.
- Secrets committen of in chat/logs plakken.
- Doorgaan na mislukte preflight.
- Staging/productie dispatch (→ playbook 02/04).
- Dirty files achterlaten die bij de scope horen.

**Eindstatussen CI:** alleen `success` / `failure` / `cancelled` — geen "klaar" op `queued` / `in_progress`.

## Design / CSS-triggers

Zodra één waar is → volledige keten uit README (*Agent: ontbrekende design / CSS voorkomen* + *Lokale pagayo-design/dist vs registry*). Zie [reference.md](reference.md#design--css-parity).

## Stop-and-sweep

Bij CI-failure na push: geen blind her-dispatchen. Logs → foutklasse → repo-brede sweep → lokaal preflight/tests → pas daarna opnieuw CI.

## Escalatie

| Situatie | Playbook |
|----------|----------|
| Staging deploy, CI watch op dispatch | `02-staging.md` |
| PR/merge-readiness | `03-main-parity.md` |
| Productie | `04-production.md` (alleen expliciete opdracht Sjoerd) |
| Parallelle chats / manager-ritueel | `00-manager-workflow.md` |

## Rapportage

```text
Commit: <short-sha>
Branch: <branch>
Pushed: ja/nee
Dirty files meegenomen: ja/nee (lijst kort indien nee → gefixt)
CI: geslaagd/gefaald/n.v.t.
Deploy: geslaagd/gefaald/n.v.t.
Tenant migraties: nodig/niet nodig/onbekend
Design-keten: afgevinkt/n.v.t.
```

Optioneel markdown onder `pagayo-docs/github-ops-agent/`.
