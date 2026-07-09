# Orders collection UI — file bundle

Verzameld op 2026-07-08. Geen broncode gewijzigd — alleen gekopieerd uit de workspace.

## Architectuur (huidige staat)

De admin Orders UI is een **master-detail werkplek** op `/admin/orders` (`OrdersPage.tsx`), geen klassieke collection-table.

| UI-onderdeel | Status | Locatie |
|--------------|--------|---------|
| Toolbar (count, refresh, create, process/cancel) | ✅ | `WorkspaceToolbar` + `OrdersPage.tsx` |
| Channel filters (POS / Webshop) | ✅ | `OrdersChannelToolbarFilters.tsx` |
| Search | ✅ | `WorkspaceSearchInput` via inline `OrdersListCard` |
| Status filters | ✅ | `WorkspaceListPanel` filter chips in `OrdersListCard` |
| List rows | ✅ | `WorkspaceRow` |
| Pagination | ✅ | `Pagination.tsx` |
| Create order | ✅ | Toolbar `new` → `OrderCreateWorkspaceDetail.tsx` |
| Tabs | ❌ niet geïmplementeerd | — |
| List/grid view switch | ❌ niet geïmplementeerd | list-only |
| Bulk actions toolbar | ❌ niet geïmplementeerd | shift multi-select only; i18n keys aanwezig |
| Export | ❌ niet wired | `WorkspaceToolbar` kent `export` intent; Orders page gebruikt die niet |

`OrdersListCard` staat **inline** in `OrdersPage.tsx` (geen apart bestand).

## Bestanden (56 + MANIFEST)

Paden zijn relatief t.o.v. workspace-root `pagayo-reimagined-succotash/`.

### Page / route
- `pagayo-storefront/src/client/pages/admin/OrdersPage.tsx`
- `pagayo-storefront/src/client/components/admin/Router.tsx`
- `pagayo-storefront/src/client/lib/admin-navigate.ts`
- `pagayo-storefront/src/client/DESIGN.md`

### Orders components
- `pagayo-storefront/src/client/components/admin/orders/OrdersChannelToolbarFilters.tsx`
- `pagayo-storefront/src/client/components/admin/orders/OrderCreateWorkspaceDetail.tsx`
- `pagayo-storefront/src/client/components/admin/orders/orders-channel-filters.ts`

### Shared workspace shell
- `pagayo-storefront/src/client/components/admin/shared/WorkspaceToolbar.tsx`
- `pagayo-storefront/src/client/components/admin/shared/WorkspaceToolbarListCount.tsx`
- `pagayo-storefront/src/client/components/admin/shared/WorkspaceListPanel.tsx`
- `pagayo-storefront/src/client/components/admin/shared/WorkspaceSearchInput.tsx`
- `pagayo-storefront/src/client/components/admin/shared/WorkspaceRow.tsx`
- `pagayo-storefront/src/client/components/admin/shared/Pagination.tsx`
- `pagayo-storefront/src/client/components/admin/shared/index.ts`

### Supporting components / utils
- `pagayo-storefront/src/client/components/Spinner.tsx`
- `pagayo-storefront/src/client/components/index.ts`
- `pagayo-storefront/src/client/components/DateInput.tsx`
- `pagayo-storefront/src/client/components/DateTimeInput.tsx`
- `pagayo-storefront/src/client/components/admin/CustomerPicker.tsx`
- `pagayo-storefront/src/client/components/admin/ProductPicker.tsx`
- `pagayo-storefront/src/client/utils/api.ts`
- `pagayo-storefront/src/features/orders/admin-order.constants.ts`

### Hooks / state / URL
- `pagayo-storefront/src/client/hooks/useWorkspaceUrlSelection.ts`
- `pagayo-storefront/src/client/utils/adminCache.ts`
- `pagayo-storefront/src/client/utils/preserve-admin-scroll.ts`
- `pagayo-storefront/src/client/stores/uiStore.ts`
- `pagayo-storefront/src/shared/admin-workspace-pagination.ts`

### Types / i18n
- `pagayo-storefront/src/client/types/order.ts`
- `pagayo-storefront/src/client/utils/unwrapApi.ts`
- `pagayo-storefront/src/client/utils/money.ts`
- `pagayo-storefront/src/client/utils/vat-settings.ts`
- `pagayo-storefront/src/client/i18n/index.tsx`
- `pagayo-storefront/src/client/i18n/locales/{en,nl,de}/orders.json`
- `pagayo-storefront/src/client/i18n/locales/{en,nl,de}/common.json`

### CSS (@pagayo/design source)
- `pagayo-design/src/contexts/admin/order-management.css`
- `pagayo-design/src/contexts/admin/products.css`
- `pagayo-design/src/contexts/admin/workspace-shared.css`
- `pagayo-design/src/contexts/admin/tables.css`
- `pagayo-design/src/contexts/admin/pages.css`
- `pagayo-design/src/contexts/admin/_base.css`
- `pagayo-design/src/components/spinners/spinner.css`
- `pagayo-design/src/components/forms/_workspace-field.css`
- `pagayo-design/src/contexts/admin/filters.css`
- `pagayo-design/ADMIN-UI-SOURCE-OF-TRUTH.md`

### Tests
- `pagayo-storefront/src/client/__tests__/admin/OrdersPage.test.tsx`
- `pagayo-storefront/e2e/admin-orders.spec.ts`
- `pagayo-storefront/src/client/components/admin/orders/__tests__/orders-channel-filters.test.ts`
- `pagayo-storefront/src/client/hooks/__tests__/useWorkspaceUrlSelection.test.ts`
- `pagayo-storefront/src/client/components/admin/shared/__tests__/WorkspaceListPanel.test.tsx`
- `pagayo-storefront/src/client/components/admin/shared/__tests__/WorkspaceToolbarListCount.test.tsx`
- `pagayo-storefront/src/client/components/admin/shared/__tests__/WorkspaceRow.test.tsx`
- `pagayo-storefront/src/client/pages/admin/__tests__/workspace-hooks-enforcement.test.ts`

## URL / filter state

Gesynchroniseerd via `orders-channel-filters.ts` + in-page state in `OrdersPage.tsx`:

- Query: `search`, `source`, `posTerminalId`, `webshopId`, `tenant`
- Path: `/admin/orders/:id` voor selectie (`useWorkspaceUrlSelection`)
