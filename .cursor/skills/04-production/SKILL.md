---
name: 04-production
description: Promote Pagayo Workers repos to production after main-parity checks (playbook 03) and explicit Sjoerd approval in the same thread. Dispatches workflow_dispatch with deploy_mode=production-only, deploy_token from vault playbook 04 only, monitors with gh. Use when Sjoerd asks for production deploy, playbook 04, main merge readiness, or gh pr merge before prod. No git write unless explicitly ordered; never paste deploy_token in chat.
---

# Playbook 04 — Productie-deploy (+ 03 main-pariteit)

Lees dit bestand `pagayo-vault/.github/release-playbooks/README.md`. Daarna `03-main-parity.md` en `04-production.md` uitvoeren.

Je bent verantwoordelijk voor **main-pariteit (03)**, daarna **productie-promote (04)** via **`gh`** en **read-only git**. **Geen** productie op eigen initiatief.

## Leesvolgorde

1. `pagayo-vault/.github/release-playbooks/README.md` (index + harde stoplijnen)
2. `pagayo-vault/.github/release-playbooks/03-main-parity.md` (PR/merge-readiness)
3. `pagayo-vault/.github/release-playbooks/04-production.md` (productie-dispatch + deploy_token)
4. Bij stack-aannames: `pagayo-vault/STACK-MANIFEST.md`

Uitgebreide referentie: [reference.md](reference.md)

## Harde gate (niet onderhandelbaar)

- **Stop** zonder expliciete productie-opdracht van Sjoerd **in dezelfde thread** (bijv. "doe je ding", "alles naar productie", "playbook 04").
- **Geen** `production-only` of `full` zonder die zin — ook niet als CI groen is of code op `main` staat.
- **`deploy_token`:** alleen uit `04-production.md` § Deploy-token lezen; via shell env var gebruiken; **nooit** in chat, issues, commits of `pagayo-docs` plakken.
- Staging/CI/main-pariteit uit playbooks **02** en **03** moet afgevinkt zijn vóór dispatch.
- Normaal: **`deploy_mode=production-only`** — geen `full` (staging opnieuw) tenzij Sjoerd dat expliciet vraagt in dezelfde thread.

## Quick protocol

```
Task Progress:
- [ ] 0. Expliciete productie-opdracht Sjoerd in deze thread? Zo nee → STOP
- [ ] 1. Playbook 03: code op main? PR/checks groen? merge alleen op expliciete merge-opdracht
- [ ] 2. Playbook 02 afgevinkt: staging + CI success op release-SHA
- [ ] 3. Bepaal repo(s), target_ref=main (typisch), short-SHA op main
- [ ] 4. Lees deploy_token uit vault 04-production.md (niet in chat)
- [ ] 5. Dispatch production-only + gh run watch --exit-status
- [ ] 6. Post-prod smoke/health waar van toepassing
- [ ] 7. Rapporteer: repo, ref, SHA, run-URL, eindstatus (geen secrets)
```

**Eindstatussen:** alleen `success` / `failure` / `cancelled`. Geen "klaar"-melding op `queued` / `in_progress`.

---

## Fase A — Playbook 03 (main-pariteit)

### Invariant

- Iets "op staging" dat naar productie moet: **eerst op `main`** (PR mergen), **daarna** playbook 04.
- Merge naar `main` ≠ volledige productie-uitrol (storefront push-deploy op `main` kan staging-only jobs zijn).

### Verplichte check: feature branch merged naar main?

Vanuit workspace (lokale clone naast `pagayo-maintenance`):

```bash
pagayo-maintenance/scripts/verify-feature-merged-to-main.sh Pagayo/pagayo-storefront feature/<staging-branch>
```

- **Exit 0:** branch-tip is ancestor van `origin/main` → pariteit OK; ga door naar fase B (nog steeds expliciete prod-opdracht nodig).
- **Exit 1:** nog niet op `main` → **stop** met productie-claims; PR openen/mergen eerst.

**Squash-merge:** branch-tip kan géén ancestor van `main` zijn terwijl code wél op `main` zit. Controleer merge-commit op `main` handmatig. Bij twijfel: stop en vraag Sjoerd ("squash, SHA's divergeren").

### PR merge (alleen op expliciete merge-opdracht Sjoerd)

1. `gh pr view <n> --json state,mergeable,mergeStateStatus,statusCheckRollup`
2. Vereist: `OPEN`, mergeable, geen rode rollup, geen conflicts.
3. Alleen bij groen + **expliciete merge-opdracht:** `gh pr merge <n> --squash` (of anders als Sjoerd specificeert).
4. Bij twijfel: stop en vraag Sjoerd.

**Git-write** (commit/push): playbook **00** / **01** — niet onderdeel van 03/04 tenzij expliciet opgedragen.

---

## Fase B — Playbook 04 (productie-promote)

### Voorwaarden vóór dispatch

- Expliciete productie-goedkeuring in **deze thread**.
- Code op `main` (fase A groen of handmatig bevestigd bij squash).
- CI **success** op de uit te rollen SHA op `main`.
- Staging bewezen via playbook **02** (`deploy_mode=staging-only`).
- Pre-prod guard in workflow controleert o.a. `releases/current.json` — zie repo-workflow.

### Deploy-token

1. Open `pagayo-vault/.github/release-playbooks/04-production.md` § **Deploy-token**.
2. Zet waarde **alleen** in shell env var (niet echo'en, niet in rapport plakken).
3. Gebruik token **alleen** in `gh workflow run -f deploy_token=...`.

### Storefront: productie-dispatch (typisch)

Controleer actuele inputs in `.github/workflows/deploy-cloudflare.yml`.

```bash
# DEPLOY_TOKEN: waarde uit vault 04-production.md — niet in chat
gh workflow run deploy-cloudflare.yml --repo Pagayo/pagayo-storefront \
  --ref main \
  -f deploy_mode=production-only \
  -f target_ref=main \
  -f deploy_token="$DEPLOY_TOKEN"

gh run watch <run-id> --exit-status --repo Pagayo/pagayo-storefront
```

`<run-id>` uit output van `gh workflow run` of `gh run list --repo Pagayo/pagayo-storefront --branch main --limit 3`.

**Uitzondering `full`:** alleen als Sjoerd expliciet staging opnieuw wil in dezelfde productierun.

**Andere Workers-repo's:** zelfde discipline; lees per repo `deploy-cloudflare.yml` (`deploy_token`, `target_ref`, `deploy_mode`).

| Repository | Deploy-notitie |
|------------|----------------|
| `pagayo-storefront` | Workers, `deploy-cloudflare.yml` |
| `pagayo-api-stack` | Workers |
| `pagayo-edge` | Workers |
| `pagayo-workflows` | Workers |
| `pagayo-marketing` | Pages / eigen pad |
| `pagayo-cloudflare-proxy` | Directe deploy |
| `pagayo-schema`, `pagayo-config`, `pagayo-design` | Publish only — playbook 04 **n.v.t.** voor Workers-deploy |

Documenteer per repo: branch/ref, short-SHA, CI-status, deploy-run-URL, `n.v.t.` + reden waar van toepassing.

### Na productie-deploy

- Optioneel markdown onder `pagayo-docs/github-ops-agent/`.
- Korte samenvatting voor Sjoerd: wat getriggerd, ref/SHA, run-URL, eindstatus — **zonder secrets**.
- Health/smoke volgens playbook **01** waar van toepassing (storefront headers-smoke, enz.).

## Toegestaan / verboden

**Mag (met expliciete prod-opdracht):** read-only git; `gh pr view/list`; `gh pr merge` alleen op expliciete merge-opdracht + groene checks; `gh workflow run` **production-only** (of `full` alleen op expliciete uitzondering); `gh run list/view/watch`; `gh api`.

**Mag niet:** productie zonder thread-goedkeuring; `deploy_token` in chat/issues/docs; token roteren of committen; git commit/push als onderdeel van productie (→ **00**/**01**); codewijzigingen tenzij apart opgedragen; staging-only dispatch (→ playbook **02**).

## Escalatie

| Situatie | Playbook |
|----------|----------|
| Lokaal committen / scope | `00-pre-commit.md` |
| Push, preflight, dirty workspace | `01-commit-push.md` |
| Staging dispatch, CI watch | `02-staging.md` |
| PR/merge-readiness (zonder prod) | `03-main-parity.md` |
| Architectuur | `PAGAYO-NIVEAU.md` + repo `AGENTS.md` |

## Rapportage

Markdown onder `pagayo-docs/github-ops-agent/` (bv. `YYYY-MM-DD-production-deploy-<repo>.md`).

Rapporteer aan Sjoerd: repo, `target_ref`, SHA, CI vóór dispatch, deploy-run-URL, eindstatus, smoke/health-resultaat.
