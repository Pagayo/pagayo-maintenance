# Cursor Integration — Knowledge Resolver V1

## Import path

```typescript
import { KnowledgeResolver } from 'pagayo-vault/knowledge-os/runtime/index.js';
```

Workspace-relative path:

```text
pagayo-vault/knowledge-os/runtime/
```

## Usage in agent flows

1. Identify task topic (`Orders`, `AI`, `TOPIC-DEPLOYMENT`, etc.).
2. Call `resolveForAI(topic)` before reading Markdown.
3. Load returned documents in order: canonical → references → adrs.
4. Call `resolveTopic(topic)` when playbooks or historical are explicitly required.
5. Call `resolveDocument(id)` for direct registry lookups.

## Example

```typescript
const resolver = new KnowledgeResolver();
const aiDocs = resolver.resolveForAI('Stripe');

for (const doc of aiDocs.documents) {
  // read doc.path from workspace root
}
```

## Explicit layers

```typescript
resolver.resolveForAI('Deployment', { includePlaybooks: true });
resolver.resolveForAI('Security', {
  includePlaybooks: true,
  includeHistorical: true,
});
```

## Rules source

Resolution order follows:

- `pagayo-vault/knowledge-os/03-registry/RESOLUTION-RULES.md`
- `pagayo-vault/knowledge-os/03-registry/topic-registry.yaml` (`resolve-order`)

## Validation from runtime package

```bash
cd pagayo-vault/knowledge-os/runtime
npm install
npm run validate:yaml
npm run typecheck
npm run lint
npm test
```
