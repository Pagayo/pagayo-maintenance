# Knowledge Resolver V1

Runtime resolution layer for Pagayo Knowledge OS.

## API

```typescript
import { KnowledgeResolver } from './index.js';

const resolver = new KnowledgeResolver();

resolver.resolveTopic('AI');
resolver.resolveDocument('CANON-WHY-0001');
resolver.resolveForAI('Orders');
resolver.getResolveOrder();
```

## Methods

| Method | Returns |
|--------|---------|
| `resolveTopic(topic)` | `{ canonical, references, adrs, playbooks, historical }` |
| `resolveDocument(id)` | Registry entry from `canon-registry.yaml` |
| `resolveForAI(topic, options?)` | Canon → Reference → ADR only (playbooks/historical on request) |

## Validation

```bash
npm install
npm run validate:yaml
npm run typecheck
npm run lint
npm test
```

## Registry paths

Default paths resolve relative to `runtime/`:

- `../03-registry/canon-registry.yaml`
- `../03-registry/topic-registry.yaml`

Override via `new KnowledgeResolver({ canonRegistryPath, topicRegistryPath })`.

## Cache

`KnowledgeRegistry` and `TopicResolver` load YAML once per process and reuse cached entries.
