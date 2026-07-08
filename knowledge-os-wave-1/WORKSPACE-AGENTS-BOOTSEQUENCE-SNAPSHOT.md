Knowledge OS Version: 1

# Pagayo Workspace - Agent Router

Dit bestand is de ingang voor AI-agents in deze workspace.
Doel: snelle oriëntatie, minimale ruis, geen duplicatie.

## Knowledge OS

Entrypoint (verplicht): [`pagayo-vault/knowledge-os/00-start-here/START-HERE.md`](pagayo-vault/knowledge-os/00-start-here/START-HERE.md)

## Bootsequence (verplicht)

```text
START-HERE
↓
Knowledge Constitution
↓
Canon
↓
Reference
↓
Code
```

1. **START-HERE** — [`pagayo-vault/knowledge-os/00-start-here/START-HERE.md`](pagayo-vault/knowledge-os/00-start-here/START-HERE.md)
2. **Knowledge Constitution** — [`pagayo-vault/knowledge-os/01-canon/KNOWLEDGE-CONSTITUTION.md`](pagayo-vault/knowledge-os/01-canon/KNOWLEDGE-CONSTITUTION.md)
3. **Canon** — [`pagayo-vault/knowledge-os/03-registry/canon-registry.yaml`](pagayo-vault/knowledge-os/03-registry/canon-registry.yaml) (machineleesbaar); daarna canon-bestanden geladen via registry
4. **Reference** — taak-specifieke docs via [`pagayo-vault/knowledge-os/03-registry/KNOWLEDGE-REGISTRY.md`](pagayo-vault/knowledge-os/03-registry/KNOWLEDGE-REGISTRY.md)
5. **Code** — actuele code + tests in de doelrepo

Na stap 3: lees repo-`AGENTS.md` van de doelrepo vóór Reference/Code voor repo-specifiek werk.

## Gelaagde Context (verplicht)

Volg de bootsequence hierboven. Daarna, voor repo-werk:

1. Dit bestand (workspace-router).
2. Repo `AGENTS.md` van de doelrepo.
3. Taak-specifieke Reference (router, matrix, playbook) via Knowledge Registry.
4. Code + tests.

### Commerce kernel — Order → Fulfillment

Order First (elke verkoop → Order) en Order → Fulfillment (operationele consequenties als fulfillment artifacts op `orderId`/`orderItemId`) zijn bindend. Alle nieuwe fulfillment-werk moet [ADR-0005: Order → Fulfillment Artifacts](pagayo-vault/docs/adr/0005-order-fulfillment-artifacts.md) volgen. Never Build-grenzen: `pagayo-vault/PAGAYO-NIVEAU.md` §19. Productbeslissingen toetsen aan [Pagayo Product Pillars](pagayo-vault/PAGAYO-NIVEAU.md#pagayo-product-pillars--what-we-build) (canon in `PAGAYO-NIVEAU.md`).
