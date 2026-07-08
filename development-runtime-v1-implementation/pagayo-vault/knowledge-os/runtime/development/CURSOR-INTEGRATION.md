# Cursor Integration — AI Development Runtime V1

## Import

```typescript
import { createDevelopmentSession } from 'pagayo-vault/knowledge-os/runtime/development/index.js';
```

## Start every development task

```typescript
const session = createDevelopmentSession({
  capability: 'commerce',
  task: 'Your task description',
});

// Read in order:
session.canonical
session.references
session.adrs

// Full context:
session.developmentContext
session.summary
```

## Supported capabilities

- `commerce`
- `website`
- `bookings`
- `members`
- `ai`
- `ui-framework`
- `knowledge-os`

## Validation

```bash
cd pagayo-vault/knowledge-os/runtime
npm run validate:yaml
npm run typecheck
npm run lint
npm test
```
