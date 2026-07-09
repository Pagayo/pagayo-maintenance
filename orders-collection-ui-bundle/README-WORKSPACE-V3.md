# Orders Workspace V3 implementation bundle

This bundle replaces the Orders toolbar with the first reusable Pagayo Workspace V3 Command Center.

## What changed

### New shared component
- `pagayo-storefront/src/client/components/admin/shared/WorkspaceCommandCenter.tsx`

Exports:
- `WorkspaceCommandCenter`
- `WorkspaceCommandOption`
- `WorkspaceCommandField`
- `WorkspaceCommandSelect`

### Modified shared exports
- `pagayo-storefront/src/client/components/admin/shared/index.ts`

### Modified shared list panel
- `pagayo-storefront/src/client/components/admin/shared/WorkspaceListPanel.tsx`

Adds `controlsVisibility="hidden"` so a list panel can stop rendering its own search/filter controls when Workspace V3 owns them.

### Modified Orders page
- `pagayo-storefront/src/client/pages/admin/OrdersPage.tsx`

Replaces the old toolbar with `WorkspaceCommandCenter` and moves search, channel filters, status filters, collections placeholder, view placeholder and actions into the new workspace surface.

### Modified design CSS
- `pagayo-design/src/contexts/admin/order-management.css`

Adds Workspace V3 Command Center styling, responsive behavior and focus states.

## Cursor integration

1. Copy the modified files into the matching repo paths.
2. Run formatting if your repo uses it.
3. Run:
   - `npm run typecheck` or repo equivalent
   - `npm run lint` or repo equivalent
   - the OrdersPage and WorkspaceListPanel tests
   - the admin orders E2E smoke if available
4. If tests expect old toolbar text or old list-panel search controls, update them to assert:
   - `Filter & functies` exists
   - Create/New order action is still visible
   - Search/status filters are available after opening the command center

## Intentional follow-up work

The following actions are intentionally present as disabled placeholders because the supplied source bundle did not include complete implementations for them:
- Today / Ready to pack / Pickup / Subscriptions / Main site collections
- Date/amount/payment filters
- Grid view
- CSV/PDF export
- Print packing slips / labels
- Barcode scan

This is deliberate: Workspace V3 now has the correct slots without inventing backend/query behavior.
