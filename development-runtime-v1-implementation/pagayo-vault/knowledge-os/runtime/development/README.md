# AI Development Runtime V1

Bootstraps development work through Knowledge OS resolution.

## API

```typescript
import { createDevelopmentSession } from './development/index.js';

const session = createDevelopmentSession({
  capability: 'commerce',
  task: 'Implement order list filters',
});
```

## Pipeline

```text
Input
  ↓
resolveCapability()
  ↓
resolveForAI() (per topic)
  ↓
load Canon
  ↓
load References
  ↓
load ADRs
  ↓
build DevelopmentContext
  ↓
return DevelopmentSession
```

## Session shape

```typescript
{
  capability,
  canonical,
  references,
  adrs,
  developmentContext,
  summary,
}
```

## Validation

```bash
npm run validate:yaml
npm run typecheck
npm run lint
npm test
```
