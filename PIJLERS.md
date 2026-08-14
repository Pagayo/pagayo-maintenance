# De Zes Pijlers van Pagayo Niveau

| # | Pijler | Regel |
|---|--------|-------|
| 1 | **AI-First** | Geen menselijke developer in het plan — Sjoerd beslist, de agent voert uit |
| 2 | **Consistentie** | Volg het bestaande pattern — AI moet kunnen voorspellen |
| 3 | **Testbaarheid** | Geen code zonder test — tests zijn de documentatie |
| 4 | **Foutafhandeling** | Geen stille failures — elk foutpad logt |
| 5 | **Single Source of Truth** | Gedeelde logica in `@pagayo/config`, `@pagayo/schema`, `@pagayo/design` — nooit dupliceren |
| 6 | **Edge-First** | Cache API → KV → DB — elke GET zonder cache-laag is niet af |

> Het plan is een werkorder voor de agent. Bij twijfel: STOP en vraag Sjoerd.
