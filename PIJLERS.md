# De Vijf Pijlers van Pagayo Niveau

| # | Pijler | Regel |
|---|--------|-------|
| 1 | **Consistentie** | Volg het bestaande pattern — AI moet kunnen voorspellen |
| 2 | **Testbaarheid** | Geen code zonder test — tests zijn de documentatie |
| 3 | **Foutafhandeling** | Geen stille failures — elk foutpad logt |
| 4 | **Single Source of Truth** | Gedeelde logica in `@pagayo/config`, `@pagayo/schema`, `@pagayo/design` — nooit dupliceren |
| 5 | **Edge-First** | Cache API → KV → DB — elke GET zonder cache-laag is niet af |

> Bij twijfel: STOP en vraag Sjoerd.
