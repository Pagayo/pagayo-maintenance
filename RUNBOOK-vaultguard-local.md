# VaultGuard lokaal (optie A)

`pagayo-vault` blijft **LOCAL ONLY**: geen GitHub (ook niet private), geen cloud-sync van vault-inhoud.

Deze runbook staat in `pagayo-maintenance` (wel op GitHub) en beschrijft alleen **hoe** je lokaal installeert. Geen vault-secrets, geen vault-bestanden.

## Eenmalige installatie (Mac)

```bash
cd /Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance
./scripts/setup-vaultguard-local.sh
```

Het script schrijft **alleen lokaal** naar:

| Bestand | Locatie |
|---------|---------|
| Multi-root workspace | `my-vscode-workspace/pagayo.code-workspace` |
| Dagelijks script | `pagayo-vault/scripts/vaultguard-daily-delta.sh` |
| LOCAL-ONLY policy | `pagayo-vault/LOCAL-ONLY.policy` |
| launchd plist | `~/Library/LaunchAgents/com.pagayo.vaultguard.plist` |
| Runbook | `pagayo-vault/Vault Guard/LOCAL-AUTOMATION.md` |

Niets uit `pagayo-vault` wordt naar GitHub gepusht door dit script.

## API key (lokaal)

```bash
cp pagayo-vault/.local/cursor-api-key.env.example pagayo-vault/.local/cursor-api-key.env
# Vul CURSOR_API_KEY in — bestand blijft op je Mac
```

## Test

```bash
pagayo-vault/scripts/vaultguard-daily-delta.sh
```

Logs: `pagayo-vault/vaultguard/YYYY-MM-DD-launchd.log`

## Handmatig in Cursor

1. Open `pagayo.code-workspace`
2. Agent-chat: `@pagayo-vault/.github/agents/VaultGuard.agent.md — dagelijkse delta-modus`

Of dubbelklik `pagayo-vault/VaultGuard Local.command`.

## Cloud-automation uitzetten

De cron op [cursor.com/automations](https://cursor.com/automations) draait op een VM **zonder** `pagayo-vault`. Pauzeer of verwijder die automation.

## Guards

- `pagayo-vault/scripts/vaultguard-assert-local-only.sh` — faalt bij git-remote in vault
- `pagayo-vault/LOCAL-ONLY.policy` — bindend beleid op schijf

## Waarom niet optie B (private GitHub)?

Vault bevat playbooks, agenda, mogelijk gevoelige notities. Policy: **nooit online**, ook niet private.
