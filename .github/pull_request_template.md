## Context

`Type wijziging:` `<feature|fix|chore|refactor|infra|docs>`

`Scope:` `<welke onderdelen raken we>`

`Issue/werkplan:` `<link of n.v.t.>`

## Blocking Checklist

- [ ] Ik werk vanuit een branch (niet direct op `main`)
- [ ] Wijziging volgt bestaand pattern in deze repo
- [ ] Nieuwe/gewijzigde paden hebben tests waar nodig
- [ ] `npm run lint` is groen
- [ ] `npm run typecheck` is groen
- [ ] `npm run test` is groen
- [ ] Geen `.skip`/`xit` toegevoegd
- [ ] Errors blijven gestructureerd (`code`, `message`, `details`)
- [ ] Geen secrets toegevoegd in code, logs of config
- [ ] Ik heb impact op `pagayo-maintenance`-smokes beoordeeld en bijgewerkt waar nodig

## Staging/Production Gate

- [ ] Merge naar `main` is bedoeld voor staging-validatie
- [ ] Productie gebeurt alleen via `workflow_dispatch` met `deploy_mode=full|production-only`
- [ ] Voor productie is `target_ref` expliciet
- [ ] Voor productie is `deploy_token` vereist
- [ ] `preprod-guard` moet slagen tegen `releases/current.json`

## Verificatiebewijs

Plak hier de kernoutput (kort):

```text
lint:
typecheck:
tests:
smoke (indien van toepassing):
```

## Risico en Rollback

`Risico:` `<laag|middel|hoog> + korte toelichting`

`Rollback:` `<concrete stappen>`

## Notitie voor eenpitter-flow

Human approval is niet de primaire gate. De technische gates in CI en deze checklist zijn leidend voor merge/deploy.
