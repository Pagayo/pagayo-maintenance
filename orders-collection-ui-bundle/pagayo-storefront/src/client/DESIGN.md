# Pagayo Design System - Frontend Guidelines

> **MANDATORY:** All frontend code MUST follow these design standards.
> This ensures consistency across all Pagayo applications.

## Quick Reference

| Aspect | Standard | Reference |
|--------|----------|-----------|
| **Icons** | Lucide React | `import { IconName } from 'lucide-react'` |
| **CSS Tokens** | Pagayo Design System v2 | `@pagayo/design` (served via `/design/dist/{theme}/admin.css`) |
| **i18n** | Verplicht, geen hardcoded strings | `useI18n()` hook → `t('key')` |
| **Framework** | Preact + TypeScript | - |
| **Styling** | `@pagayo/design` — geen lokale CSS | Alle CSS via design system |
| **Pagayo wordmark (admin/POS/balie)** | `PagayoAdminWordmark` | Zie sectie hieronder — geen handmatige `logo-p` markup |
| **Admin thumbs (`/uploads/*`)** | `buildR2ImageVariantThumbSrcSet` / `AdminR2Image` | Zie subsectie hieronder; SSoT: `pagayo-design/ADMIN-UI-SOURCE-OF-TRUTH.md` |

### Admin / storefront image thumbnails (`/uploads/*`)

- **Thumb / list UI:** `buildR2ImageVariantThumbSrcSet(url, widths)` — default `src` is de kleinste variant, niet het origineel. Admin: `AdminR2Image` (`variant="thumb"`).
- **Hero / grotere preview:** `buildR2ImageVariantDisplaySrcSet` (default `src` = passende variant, niet origineel) of `AdminR2Image` (`variant="display"`). Bij ontbrekende variant: `onError` → origineel via `toUploadUrl`.
- **Upload:** server genereert varianten uit `PRODUCT_IMAGE_VARIANT_WIDTHS` (`src/lib/images/image-variant-widths.ts`).
- **Product workspace scroll na media-mutatie:** `preserve-admin-scroll.ts` + `reloadProductDetail` (geen volledige `refreshWorkspace` die `selectedProduct` null zet).
- **Workspace scroll + form hydration (admin master-detail):** `preserve-admin-scroll.ts` (`withPreservedWorkspaceDetailScroll`), `useWorkspaceFormHydration`, `useWorkspaceDetailRefresh` helpers. Anti-pattern: `refetch()` in autosave `saveFn` zonder in-place list/detail patch.

### PDP product gallery (storefront)

- **Vaste stage:** hoofdafbeelding gebruikt `--pdp-gallery-aspect-ratio` (tenant: vierkant / 4:3 / 3:4) en `--pdp-gallery-object-fit` (`contain` default, `cover` optioneel). Geen `height: auto` op de main container — voorkomt layout shift bij mixed uploads.
- **Thumbs links/rechts:** thumb-rail `flex: 0 0 auto` + vaste breedte (`--pdp-gallery-thumb-size`, 72px); niet laten shrinken in row-flex.
- **SSoT CSS:** `pagayo-design/src/contexts/webshop/product-detail.css`; resolver `src/lib/layout/product-detail-gallery-appearance.ts`; admin `/admin/products/settings` → image display.
- **Client/SSR:** `ProductGallery.tsx` + `render-product-detail-gallery-html.ts` zetten `galleryStyle` / `galleryInlineStyle` op `.product-gallery`.
- **Bytes (PDP):** stage + thumbs laden R2-varianten (`PDP_GALLERY_*` in `image-variant-widths.ts`); `src`/`srcset` via `buildR2ImageVariantDisplaySrcSet` / `buildR2ImageVariantThumbSrcSet`. Thumbs `loading="lazy"`. **Volledig origineel alleen in lightbox** (bewuste zoom). Legacy zonder varianten: `onError` → origineel (zwaar; backfill varianten is de structurele fix).
- **Lightbox:** via `createPortal(..., document.body)` en `z-index: 1100` (boven sticky storefront header); `body` scroll lock tijdens zoom.
- **SKU:** alleen in de tabel **Specificaties** (`ProductPage`), niet bij voorraad of in de variantkiezer; volgt geselecteerde variant (of product-SKU zonder varianten).
- **Koopzone (PDP):** prijsblok: aparte zichtbaarheid + typografie/kleur voor normale prijs (`.product-price-current`), oude prijs, actieprijs (`.product-price-sale`) en kortingsbadge. Admin **Productinstellingen → Storefront → Koopzone** (`/admin/products/settings/frontend/purchase`). Blokken: `price`, `stock`, `variants`, `quantity`, `addToCart` — volgorde, zichtbaarheid, typografie en kleuren via `product-detail-purchase-appearance.ts` + `ProductPurchaseStack.tsx`. Variantkiezer: Zalando-style **dropdowns** (`<select class="form-select product-variant-select">`) — per optiedimensie of één lijst zonder optiegroepen; labeltekst via `productDetailVariantChooserLabel` / `storefront.product.variantChooserLabel`; typografie op `.product-variant-label` en `.product-variant-select`. Per blok uitlijning links/midden/rechts (`productDetail*Align`). Aantal + winkelwagenknop: één rij (`.product-detail-purchase-block--cart-actions`) wanneer beide zichtbaar zijn. Geen kolom-placement (alleen rechter content-kolom). **Volgorde-UI admin:** `products-purchase-order-list` / `products-purchase-order-row` in `@pagayo/design` `contexts/admin/products.css` (compact, geen `settings-pass-field-row`).
- **Omschrijvingen (PDP, Woo/Magento-model):** 2 kolommen: gallery + productinfo (koopzone, korte omschrijving, specificaties). Daaronder full-width **`.product-detail-omschrijving`**: alleen **uitgebreide** omschrijving (+ delen). Korte omschrijving: kolom gallery/productinfo; positie boven/onder specificaties in productinfokolom. Admin **Productinstellingen → Storefront → Omschrijving**.
- **Product content blocks (PDP):** item-scoped content-block placements staan in admin **in de product-editor tussen korte en uitgebreide omschrijving**. Storefront rendert deze blokken in een vaste full-width slot **boven de uitgebreide omschrijving**. Voor nu is dit een vaste positie; zone/handmatige positionering voor item-scoped product placements hoort niet in deze flow.
- **Specificaties (PDP):** fabrikant + attributen in **`.product-detail-about-product`** (variant-select toggle; inhoud: **`.product-about-product-facts`** — vet label + waarde op één regel, Zalando-achtig). Admin: **Alles over dit product** (`showProductDetailAboutProduct`). CSS: `product-detail.css`.

## Pagayo brand wordmark (admin / POS / balie) — SSoT

De tekst-brand **“Pagayo.”** (accent op **P** en **.**) is één contract. Gebruik **altijd** de shared component; kopieer de spans niet per pagina.

| Wat | Waar |
|-----|------|
| **Component (markup SSoT)** | `src/client/components/common/PagayoAdminWordmark.tsx` |
| **CSS (kleur/typografie)** | `@pagayo/design` → `main-nav.css` (kleur/weight); **20px** via `account-navigation.css` (`.admin-account-nav__logo`) — niet de navbar-only override (`navbar.css` → `.main-nav > .main-nav__logo` = 24px) |
| **Placements** | `sidebar-brand` (admin sidebar + `/balie` footer), `navbar` (legacy topnav), `pos-footer` (POS shell) |

```tsx
import { PagayoAdminWordmark } from '../components/common/PagayoAdminWordmark';

// Admin sidebar / balie-footer
<PagayoAdminWordmark placement="sidebar-brand" href={logoHref} onClick={...} />

// POS footer
<PagayoAdminWordmark placement="pos-footer" href={`/pos/${posId}`} />
```

**Niet verwarren met:**

- `PagayoLogo` — SVG-icoon op login/forgot-password (geen tekst-wordmark).
- `PagayoWordmark` — webshop photo-upload context (`photo-upload__logo*` classes), geen admin-shell.

Server-rendered HTML (e-mail, owner pages) mag dezelfde **class-namen** (`logo-p`, `logo-dot`, `main-nav__logo`) gebruiken; nieuwe **client** admin/POS/balie UI gaat via `PagayoAdminWordmark`.

Canonieke baseline: `pagayo-design/ADMIN-UI-SOURCE-OF-TRUTH.md` (Runtime shell — brand wordmark).

## Theme vs skin (tenant webshop / POS) — 2026-05

**Doelterminologie (productrichting):**

- **Theme** — één functionele storefront/POS-baseline: dezelfde set componenten en secties; later kunnen **meerdere** themes naast elkaar bestaan (echt andere layouts/flows).
- **Skin** — visuele variant binnen één theme: `fresh`, `classic`, `revolutionary`, `aqua` (tokens, fonts, kleur, radius via `pagayo-design` theme JSON + context-CSS). Canonieke settings-keys: `shop.skin` / `shop.skin.enabledSkins`; legacy `shop.theme` blijft dual-write gelezen door middleware.

**API tijdens rollout:** het pad `GET/PUT /api/admin/settings/theme` blijft stable; de response bevat nieuwe velden (`skin`, `enabledSkins`, `functionalTheme`) naast de bestaande (`current`, `enabledThemes`, …). Zie `pagayo-storefront/docs/adr/0001-functional-theme-vs-skin-settings.md`. **Sunset en `Case` vs `functionalTheme` (optie B):** `pagayo-storefront/docs/adr/0002-case-vs-functional-theme-and-legacy-sunset.md`. **Consumer-inventaris + backfill:** `pagayo-storefront/docs/theme-skin-exit-inventory.md`, runbook `pagayo-storefront/docs/runbooks/backfill-tenant-skin-from-legacy.md`.

**`Case` vs functioneel theme:** menu/policy (`Case`) en storefront-vertical (`functionalTheme`) blijven **gescheiden assen**; geen impliciete merge in client-componenten. Details in ADR 0002.

**Agent-discipline:** canonieke playbooks en leesvolgorde staan in **`pagayo-vault/.github/design-frontend/README.md`** (niet de admin-only map `design-admin`).

**Canonieke model- en build-beschrijving:** `pagayo-design/THEME-SKIN-MODEL.md` (o.a. `build.js` `THEMES`, `portal`, skin-pariteit / inventaris-epic).

**Tenant-keuze (admin-route, wel frontend-impact):** canoniek **`/admin/design/skins`** (tab **Skin** onder **Website → Design**); body: `ThemeSettingsPage.tsx` (`ThemeSkinsSettingsContent`). Functioneel theme-overzicht: **`/admin/design/theme`**. Winkel-lettertypes (body + koppen): **`/admin/design/typography`** — preset keys `shop.fontPreset` / `shop.headingFontPreset` (SSoT `@pagayo/config/fonts`, self-hosted via `@pagayo/design`). Oud pad **`/admin/theme`** redirect client-side naar `/admin/design/skins`. Lokaal: `http://demo.localhost:3000/admin/design/skins`. Staging: `https://demo.staging.pagayo.app/admin/design/skins`.

**Pariteit:** geen storefront-feature die structureel alleen in één skin voorkomt, tenzij expliciet vastgelegd in `THEME-SKIN-MODEL.md` of dit document.

## Webshop FAQ page (2026-05-25)

Voor de publieke route `/faq` geldt één gedeeld storefront-patroon voor alle skins:

- Gebruik `StorefrontPageHero` voor de paginakop, maar met FAQ-specifieke classes uit `@pagayo/design` (`faq-page__hero-*`) zodat de hero visueel rustiger blijft dan een generieke spotlight-card.
- De inhoud eronder gebruikt een tweekoloms compositie `faq-page__layout`: links de vragenlijst, rechts een compacte help/contact-card. Op mobiel stapelt dit terug naar één kolom.
- De accordion gebruikt gedeelde markup uit `Accordion.tsx`, maar alle styling leeft in `@pagayo/design` (`contexts/webshop/faq.css`); geen inline `<style>` of lokale storefront-CSS voor FAQ-interactie.
- SSR first-paint voor FAQ/contact/partners wordt niet behouden tijdens client-render als de client de volledige pagina opnieuw opbouwt; anders ontstaat dubbele zichtbare content.

## Webshop page heroes and partners (2026-05-31)

- Publieke pagina's gebruiken standaard `StorefrontPageHero` met gedeelde `storefront-page__hero-*` classes uit `@pagayo/design` (`contexts/webshop/content.css`). Dit voorkomt smalle hero-tekst door generieke `.page-content` / `.section-subtitle` beperkingen.
- Partners-logo's en sponsor-cards blijven één gedeeld BEM-blok (`partners-card`, `partners-grid`, `partners-slider`) uit `@pagayo/design` (`contexts/webshop/partners.css`). Geen lokale CSS in storefront voor card-spacing of logo-afmetingen.
- De homepage-slider leest `homepageConfig.sections.partners`. `maxItems = 0` betekent alle actieve partners tonen; een positief getal begrenst de slider. Dit veld is bewerkbaar via Homepage én Partners settings en wordt genormaliseerd via `src/lib/partners-homepage-settings.ts`.
- **Homepage hero-afbeelding (weergave):** inhoud (`imageUrl`, titels, CTA's) blijft in `homepageConfig` op `/admin/homepage`. Overlay, fit, verhouding, positie en rand staan in tenant JSON `homepageWorkspaceFrontendSettings` (publiek). Admin: tandwiel op homepage-workspace → `/admin/homepage/settings/frontend/image` (zelfde shell als producten: Storefront | Beheer). Resolver: `src/lib/layout/homepage-hero-appearance.ts`; overlay-helpers: `src/lib/hero-overlay.ts`. Legacy `sections.hero.overlayColor` / `overlayStrength` blijven fallback tot workspace-overlay expliciet afwijkt van default.

## Admin SSoT (2026-04-05)

Dit document is opgeschoond met een harde bronvolgorde voor admin UI.

1. **Primary SSoT voor admin list/workspace layout:** huidige Products workspace implementatie
  - Linkerkolom (filters/search/list) + rechterkolom contentpaneel
  - Toolbar rij bovenin (import/export/delete/new/save + overige acties)
  - Secties boven variantmatrix: hero, title/slug/sku/description, settings, specifications, media
2. **Uitzondering:** variantmatrix (inhoud en UI) valt buiten deze baseline en wordt apart beheerd.
  - Binnen de products-workspace moet variantmatrix dezelfde uniforme admin-typografie gebruiken (13px headings/body/labels via tokens).
  - Binnen de products-workspace: geen dubbele titel "Variant options", geen extra nested border om het option-input blok, en geen extra bottom-border onder de variantmatrix-sectie.
  - Products-workspace collapsible headers: 1 regel (label links, plus/min rechts), label op 13px uppercase schaal, zonder extra interne sectietitels direct eronder.
3. **Conflictregel:** als een oudere richtlijn in dit document afwijkt van bovenstaande baseline, dan is die oudere richtlijn vervallen.

Canonieke referentie (design package):
- `/pagayo-design/ADMIN-UI-SOURCE-OF-TRUTH.md`
- **Admin Interface Matrix v1 (AI guardrails):** `docs/ADMIN-INTERFACE-MATRIX.md` — paginatype-router, primitives, verboden patronen; Cursor-rule: workspace-root `.cursor/rules/pagayo-admin-interface-matrix.mdc`
- **Admin Composition & Design Contract:** `docs/adr/0003-admin-composition-and-design-contract.md` — bindend contract voor tenant-admin workspace-, modal-, tabs-, form-, section- en preview/usage-keuzes.
- **Form control recipes:** `pagayo-design/ADMIN-UI-SOURCE-OF-TRUTH.md` § Form control recipes — visueel via `_workspace-field.css` + `products-workspace-field`; gedrag via `--fill` en content-sizing.
- **Block-edit panel tiles:** ADR 0003 § Block-edit panel tiles + `ADMIN-UI-SOURCE-OF-TRUTH.md` § Block-edit panel tiles — witte tegels, 2–4 kolommen, `BlockDesignGroups` / `BlockDesignSection`.
- **Admin UI Learnings:** `docs/admin-ui/ADMIN-UI-LEARNINGS.md` — self-learning log voor structurele correcties van Sjoerd; lokale fix + herbruikbare les, periodiek consolideren naar het compositiecontract.

### Canonieke admin-URL’s (`Router.tsx`)

De admin-SPA gebruikt **workspace-paden** als enige waarheid voor producten, categorieën, kortingscodes en blog. Oude URL’s met `/edit` worden client-side genormaliseerd (`replaceState` + `popstate`) naar het pad zonder `/edit`.

| Domein | Canonic | Legacy (redirect) |
|--------|---------|-------------------|
| Producten | `/admin/products`, `/admin/products/new`, `/admin/products/:id` | `/admin/products/:id/edit` |
| Categorieën | `/admin/categories`, `/admin/categories/new`, `/admin/categories/:id` | `/admin/categories/:id/edit` |
| Kortingscodes | `/admin/coupons`, `/admin/coupons/new`, `/admin/coupons/:id` | `/admin/coupons/:id/edit` |
| Blog | `/admin/blog`, `/admin/blog/new`, `/admin/blog/:id` | `/admin/blog/:id/edit` |
| CMS-pagina’s | `/admin/pages`, `/admin/pages/new`, `/admin/pages/:id` | `/admin/pages/:id/edit` |

**Component-SSoT:** `ProductsPage`, `CategoriesPage`, `CouponsPage`, `BlogPage`, `PagesPage` voor workspace CRUD (inclusief CMS-pagina’s: rich content en content blocks in de rechterkolom).

### Verplichte Workspace Components (Storefront)

Voor admin workspaces met master-detail patroon zijn deze componenten verplicht:

- `WorkspaceToolbar` + `WorkspaceToolbarLeft` + `WorkspaceToolbarRight`
- `WorkspaceToolbarAction` (intent-gedreven toolbar knop)
- `WorkspaceToolbarActionGroup` (declaratieve actie-set met centrale render-volgorde)
- `WorkspaceToolbarSelect` (toolbar select-control)
- `WorkspaceToolbarDateInput` (toolbar datum-control)
- `WorkspaceListPanel`
- `WorkspaceFilterToggleButton` (filter/search dropdown toggle)
- `WorkspaceRow`

Locatie:
- `src/client/components/admin/shared/WorkspaceToolbar.tsx`
- `src/client/components/admin/shared/WorkspaceListPanel.tsx`
- `src/client/components/admin/shared/WorkspaceRow.tsx`

Regel:
- Nieuwe admin workspaces mogen dit patroon niet lokaal heruitvinden met losse markup.
- Products is de functionele referentie; andere pagina's leveren alleen domeinspecifieke acties, filters en rijdata aan.

### Admin Data Registry (Search + Assistent SSoT)

Tenant-admin data die retailers terug moeten kunnen vinden (orders, klanten, producten, straks tickets/verhuur/shipments) hoort in **`src/features/admin-data/`** — niet in losse AI- of search-logica.

| Wat | Waar |
|-----|------|
| Registry + dispatch | `src/features/admin-data/admin-data.registry.ts`, `admin-data.service.ts` |
| Module manifest | `src/features/admin-data/providers/<module>/admin-data.manifest.ts` |
| Module provider | `src/features/admin-data/providers/<module>/*-admin-data.provider.ts` |
| Omni-search adapter | `src/features/search/admin-search.service.ts` → `runAdminFind` |
| Assistent tools | `admin_find`, `admin_query` in `src/features/ai/admin-ai-chat.service.ts` |
| Guardrail | `npm run check:admin-data-manifests` (CI **fail** on missing manifest) |
| Entity inventory | `docs/admin-data/ENTITY-INVENTORY.md` |
| Scaffold | `npm run scaffold:admin-data -- entity=<id>` |

**Definition of Done — nieuwe admin workspace met lijst/detail:**

1. Manifest met `entity`, `adminBasePath`, `feature`, `menuAccessKey`, `capabilities`.
2. Provider implementeert minimaal `search` (tekst) en waar relevant `list_recent` / `list_filtered` / `count`.
3. Zoekvelden aligned met wat de workspace-lijst toont (bijv. klantnaam uit shipping + user).
4. Registratie in `admin-data.registry.ts` (of via module `registerProvider` helper).
5. Geen aparte AI-tool per entiteit — Assistent gebruikt generieke `admin_find` / `admin_query`.

Modules zonder vindbare records documenteren expliciet waarom (`kind: "report"` / geen provider) in manifest of playbook.

Template: `src/features/admin-data/providers/_template/` (manifest example + README checklist).

### Workspace Hooks (verplicht)

Alle admin list/workspace pagina's MOETEN deze hooks gebruiken voor selectie en bulk acties:

| Hook | Doel | Import |
|------|------|--------|
| `useWorkspaceSelection<TId>` | Multi-select met click/shift-range/cmd-toggle | `src/client/hooks/useWorkspaceSelection` |
| `useBulkAction<TId>` | Sequentiële bulk operaties met progress tracking | `src/client/hooks/useBulkAction` |

**Selectie-patroon:**
```tsx
const selection = useWorkspaceSelection<number>();
// In WorkspaceRow:
<WorkspaceRow
  isSelected={selection.isSelected(item.id)}
  onClick={(e) => {
    selection.handleRowClick(item.id, index, e);
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
      setSelectedItemId(item.id); // voor detail panel
    }
  }}
/>
```

**Bulk actie patroon:**
```tsx
const bulkAction = useBulkAction<number>();
const handleBulkDelete = async () => {
  const result = await bulkAction.execute(
    Array.from(selection.selectedIds),
    async (id) => { /* single item actie */ }
  );
  if (result.succeeded.length > 0) {
    selection.clearSelection();
    refetch();
  }
};
```

**❌ VERBODEN:** Eigen `useState<Set<...>>` voor selectie. Gebruik ALTIJD de hook.

### WorkspaceRow Status & Type Props

WorkspaceRow ondersteunt optionele status badges en type chips:

| Prop | Waarden | CSS class |
|------|---------|-----------|
| `statusVariant` | `'active'` \| `'expired'` \| `'paused'` \| `'expiring'` | `.workspace-badge--{variant}` |
| `statusLabel` | Gelokaliseerde tekst | — |
| `typeVariant` | `'individual'` \| `'family'` | `.workspace-type-chip--{variant}` |
| `typeLabel` | Gelokaliseerde tekst | — |

### WorkspaceListPanel Filter Modes

WorkspaceListPanel ondersteunt twee filter modes:

| Mode | Gebruik | Props |
|------|---------|-------|
| `dropdown` (default) | Checkbox filters in dropdown | `filters`, `activeFilterKeys`, `onToggleFilter` |
| `chips` | Horizontale filter chips | `filterChips`, `activeChipKeys`, `onToggleChip` |

Optioneel in **dropdown**-modus: tweede chiprij in hetzelfde paneel (naast zoekveld) via `secondaryFilters`, `activeSecondaryFilterKeys`, `onToggleSecondaryFilter`, `secondaryFilterLabel` — bijv. printstatus naast lifecycle (MembersBaliePage). Gebruik **geen** `filterMode="chips"` als die chips onder de header horen te staan; chips-modus blijft voor horizontale rijen buiten het paneel (zoals SubscriptionsPage).

Optioneel: sort dropdown via `sortOptions`, `activeSortKey`, `onSortChange`.

### Balie-pagina Referenties

| Pagina | Type | Referentie voor |
|--------|------|-----------------|
| MembersBaliePage | Scan/opzoek | Balie-hero, binaire geldigheid, bezoekgeschiedenis |
| SubscriptionsPage | Beheer | Filter chips, sort, bulk acties, events timeline |
| ProductsPage | Beheer | Baseline workspace patroon, toolbar, master-detail |

Aanvullende afdwinging:
- Searchveld, result-count en selectiecount horen niet in de top-toolbar van workspacepagina's; deze horen in de linkerkolom/list-panel flow.
- Delete-acties moeten functioneel parity hebben met de Products-referentie; geen pagina-specifieke ad-hoc variant zonder expliciete reden.
- Workspace toolbar-knoppen gebruiken verplicht `WorkspaceToolbarAction` met `intent` mapping (bijv. `delete` => danger, `save` => primary, `bulkEdit` => default); geen losse class-combinaties per pagina.
- Pagina's laden toolbar-acties declaratief via `WorkspaceToolbarActionGroup`; de knopvolgorde komt uit de centrale order in shared toolbar code (niet uit lokale JSX-volgorde).
- Workspace toolbar selects en datumvelden gebruiken verplicht `WorkspaceToolbarSelect` en `WorkspaceToolbarDateInput`; geen losse `products-workspace-toolbar__select/date` markup per pagina.
- **Datum/tijd invoer:** geen native `type="date"` of `type="datetime-local"` in UI. Gebruik `DateInput` / `DateTimeInput` (`src/client/components/`); waarde naar parent blijft ISO (`YYYY-MM-DD` of `YYYY-MM-DDTHH:mm`). Locale: land van de winkel (`__TENANT__.storeAddressCountry`), anders shop-taal — zie `src/client/utils/datetime.ts` en `useDateLocale()`.
- **Workspace inline controls — content-sized (SSoT):** in admin-workspace formulieren (`products-editor-field`, block-edit modal, workspace detail) zijn **tekst-`input` en `select` met `products-workspace-field`** niet full-width. Breedte volgt ingevulde waarde; leeg veld volgt placeholder (CSS `field-sizing: content`). Inline padding = **`--admin-control-inline-padding` (12px)** — zelfde ritme als tabs/chips/buttons. **Uitgesloten:** `textarea`, TipTap/rich editor (`AdminRichContentEditor`), lijst-zoek (`products-workspace-search-field`), kleur/range, bulk-edit paneel, chip+veld rijen. **Full-width alleen expliciet:** class **`products-workspace-field--fill`** op het veld, of **`date-time-input--fill`** op datetime-wrapper. CSS SSoT: `pagayo-design/src/contexts/admin/products.css` (blok “Workspace inline controls”) + token in `_base.css`. Toolbar-datetime (`products-workspace-toolbar__datetime`) blijft buiten workspace-form regel.
- Filter/search dropdown toggles gebruiken verplicht `WorkspaceFilterToggleButton`; geen losse `products-control-dropdown-btn` knoppen in pagina-implementaties.
- Delete-opmaak wordt in de designlaag ook afgedwongen via `data-workspace-action-intent='delete'`, zodat disabled/active delete in alle workspaces dezelfde visuele taal blijft houden.
- Bij soft-delete endpoints: altijd deterministische UI-sync (refresh of equivalent), geen state-illusie waarbij soft-deleted records als hard-deleted verdwijnen.
- Lijstselectie volgt Products-parity: shift-range multi-select, consistente selected-state op rows en opgeschoonde selectie bij filter/search/paginatie.
- **Products bulk bewerken**: bij multi-select opent een optioneel paneel direct onder de workspace-toolbar (`products-bulk-edit-panel*` in `@pagayo/design`). Geen aparte paneeltitel in de UI; `aria-label` op het paneel. Velden: `products-workspace-form-block` + `form-input` / `form-select` + `products-workspace-field`. API: `PUT /api/admin/products/bulk-status`, `bulk-category`, `bulk-stock` (eenvoudige producten; varianten server-side overgeslagen). Na toepassen: selectie wissen + `refreshWorkspace`.

Workspace interactiecontract (verplicht voor list/detail workspaces):
- Klik op een row opent direct een bewerkbare detail-editor in het rechterpaneel; geen read-only tussenlaag als primaire flow.
- `Create` in de rechter toolbar start inline create-modus in het bestaande rechterpaneel; geen route-navigatie naar een aparte create-pagina.
- Rechter toolbar volgorde blijft `Create` gevolgd door `Save`.
- Labelconventie voor workspace-acties: gebruik korte labels (`Create`, `Save`, `Delete`) in plaats van langere varianten zoals `Create coupon` of `Delete selected`.
- Lifecycle/destructieve acties (`Archive`/`Restore`, `Delete`) horen in de top-toolbar; plaats deze niet nogmaals als losse iconknoppen in de detail-hero.
- Geen `Select all` actieknop in de top-toolbar; selectie blijft row-gedreven (single, cmd/ctrl multi, shift-range).

### Contentdeel SSoT (Products als bron)

Voor admin workspaces geldt naast toolbar/list ook een vaste contentgrammatica aan de rechterkant:

- Shell: `products-master-detail` met links `products-list-card` en rechts detail (`products-workspace-detail-card` of `products-detail-card` voor state-only views).
- State handling in beide panelen via uniforme pane-state patronen (loading, error, empty), geen pagina-specifieke losse stateblokken.
- **Producten workspace detail** (`ProductWorkspaceDetail`): 2-koloms layout via `order-create-columns` + twee `products-card order-create-column` (zelfde grid als orders detail/create). Wrapper `products-workspace-detail-card` (transparant, geen dubbele card-border). **Links:** Algemeen (hero in sectie met `products-workspace-hero--in-section`), Samenvatting, Categorie, Specificaties, Prijs & voorraad, Media, variantmatrix, SEO. **Rechts:** Status (`common.status`: kanalen + Featured; publicatiestatus alleen via toolbar Draft/Published), Instellingen (type/BTW/abonnement), EU-fabrikant, Tags. Geen aparte overview-sectie “Product & verkoop”.
- Detail hero typografie gebruikt één centrale schaal: titel + meta op 13px via `--admin-workspace-detail-font`; titel blijft nadrukkelijk (`var(--font-semibold)` of sterker).
- Detail form-controls (`form-input`, `form-select`, `form-textarea`) gebruiken dezelfde 13px schaal via `--admin-workspace-detail-font`.
- **Typ-velden met zoekicoon (leading)** in het rechter workspace-detailpaneel gebruiken het SSoT-blok `products-detail-form` → `products-workspace-form-block` → `products-workspace-search-field` met `Search` in `products-workspace-search-field__icon` en het `<input>` als `form-input products-workspace-field products-workspace-search-field__input`. Gebruik **niet** de oude combinatie `product-search-wrapper` + absoluut gepositioneerd `product-search-icon` + `product-search-input` (icoon overlapte placeholder/tekst en wijkde visueel af van andere velden). CSS: `pagayo-design/src/contexts/admin/products.css` (`.products-workspace-search-field*`). Toepassing o.a. `CustomerPicker`, `ProductPicker`, order-item zoek in order-edit flows.
- **Staff — POS- en check-in-toegang** (`StaffPosAccessSection`, `StaffCheckInAccessSection`): subsectionkop `products-workspace-section__title`; inhoud in `products-detail-form` met `products-editor-field` + `products-editor-label` + `form-select`/`form-input` + `products-workspace-field` + `products-editor-hint`; restrictie/toegestane terminals via `products-workspace-checkbox-chip` (en kolom `products-workspace-checkbox-column` waar meerdere terminals). Geen `form-section` / `form-label` / `form-hint` voor dit blok — zelfde taal als overige staff-workspacevelden.
- **Workspace linkerkolom-zoek** (`WorkspaceListPanel`, `products-search-input-wrapper` + icoon + input): input **`flex: 1 1 auto; min-width: 0`** (geen `width: 100%` dat tekst en icoon laat overlappen). Border/radius/typografie volgen `products.css` (zelfde tokenfamilie als overige admin-velden). Bij aanpassen van order-/product-/staff-lijst: **altijd** dit gedeelde component controleren, niet alleen pagina-specifieke markup rechts.
- **Ingesloten subformulieren in workspace-detail** (bijv. `CustomerPicker` modus “nieuwe klant”): zelfde stack als detailvelden — `products-detail-form` + `products-workspace-form-grid` + `products-editor-field` + `products-editor-label` + `form-input products-workspace-field` + `products-editor-hint`; i18n onder `orders.create.*` (of domein-JSON), geen hardcoded NL/EN in de component.
- **Orders workspace detail — gestapelde formulieren** (`orders-workspace-detail-card`, o.a. handmatige order aanmaak → Payment): `products-detail-form` als flex-kolom met **`gap: var(--space-5)`** tussen directe kinderen (grid, hints, kortingscode); top-level `products-editor-hint` in die stack **`line-height: var(--leading-relaxed)`**. CSS: `pagayo-design/src/contexts/admin/order-management.css` (`.orders-workspace-detail-card .products-detail-form`).
- **Korting aanpassen op bestaande order** (`OrderCouponInput` in `OrdersPage` totalen-sectie + `OrderDetailPage`): wrapper **`orders-admin-coupon-stack`** (optioneel met `products-detail-form` in workspace); titel/hint/veld gestapeld met token-`gap`; couponregel **input + knop op één rij** (`flex-wrap: nowrap`). Het invoerveld gebruikt **`form-input products-workspace-field`** (zelfde **`--admin-control-field`** hoogte als overige workspace-velden); apply-knop **`btn` + `size="sm"`** (32px, gelijk aan control). Checkout-`.coupon-input*`-CSS zit alleen in webshop-context — admin-regels staan in **`order-management.css`** (`.orders-workspace-totals-body` + `.orders-admin-coupon-stack`).
- **Producten — categorieën (workspace):** eigen collapsible met gele sectietitel `products.workspace.sections.category` in de **linker** detailkolom (tussen Samenvatting en Specificaties). Inhoud: `products-workspace-category-panel` → intro `products-editor-hint`, daarna twee kolommen `products-workspace-category-columns` (links alle cataloguscategorieën met checkboxen, rechts hoofdcategorie met radio’s of leesbare staat). Bij **meer dan vijf** categorieën in de tenant: filterveld `products-workspace-search-field` boven de linkerkolom én scrollbare lijst `products-workspace-category-scroll` (zelfde patroon rechts bij >5 geselecteerde items voor lange keuzelijsten). CSS: `pagayo-design/src/contexts/admin/products.css` (`.products-workspace-category*`).
- Collapsible contract: 1-regel header (label links, plus/min rechts), label op 13px uppercase schaal, geen dubbele interne titels direct eronder.
- Expanded body start zonder extra divider-lijn direct onder de collapsible header (geen extra border-top tussen header en body).
- Expanded content-typografie volgt Products body-scale: values en numerieke cells op 13px token (`--admin-products-list-font`).
- Settings boolean controls in de detailkolom volgen het **checkbox chips** patroon (zoals Sales channels en Featured): `label.form-checkbox-wrapper.products-workspace-checkbox-chip > input.form-checkbox + span.form-checkbox-label`.
- Checkbox chips in `products-workspace-controls-grid` blijven compact (28px min-height/pill look) met label-typografie op `--admin-workspace-detail-font` (13px).
- Binnen één collapsible body worden verschillende functionaliteiten onder elkaar gestapeld als losse modules; geen parallelle side-by-side function blocks in de detailkolom.
- Workspace collapsibles openen standaard dicht na harde refresh (default `false`) tenzij een expliciete pagina-SSOT uitzondering dit overschrijft.
- Layout- en typografieschaal volgen `products.css` selectors/tokens; geen parallel grid- of card-systeem introduceren.
- Scroll-contract is verplicht: list en detail hebben onafhankelijke verticale scrollbars (`overflow-y: auto`) binnen dezelfde viewport-lock keten. Detail-scrollcontainer: `.products-detail-card` — na image-mutaties scroll herstellen via `preserve-admin-scroll.ts`.
- Shell-contract voor scroll: `min-height: 0` doorgeven op page/grid/kolom wrappers; geen class-combinaties gebruiken die card-scroll overschrijven.
- **Domein-workspace instellingen** (producten/categorieën/homepage, `/admin/products/settings/*`, `/admin/categories/settings/*`, `/admin/homepage/settings/*`): **verticale stack = Reports Overview (SSoT, niet Reports POS)** — (1) `reports-page-header` met eerst `reports-page-header__nav` / `reports-section-nav__button` (Storefront | Beheer), daarna **binnen dezelfde header** `WorkspaceToolbar` met `products-workspace-toolbar` (terug, count, opslaan); **nooit** toolbar vóór de header. Tussen tabs en toolbar: `var(--admin-toolbar-gap)` via `.reports-page-header__nav + .products-workspace-toolbar` in `reports.css`. Tussen headerblok en inhoud: `gap: var(--space-6)` op `.members-workspace-settings-page` (zelfde ritme als `.reports-page` / `.reports-page-content`). (2) Per tab `products-master-detail` met linker `WorkspaceRow`-onderwerpen en rechter detail (`products-workspace-section`, geen `settings-section`). Lijstkolom-zichtbaarheid is een **Beheer**-onderwerp (niet een peer-tab). Shell: `WorkspaceDomainSettingsLayout` in `src/client/components/admin/settings/`.

Belangrijk:
- Producten is hier de SSoT voor content-ritme; functionele verschillen per pagina zijn toegestaan zolang de inhoud dezelfde layouttaal blijft spreken.

### HTML-backed Admin Velden — TipTap SSoT (2026-04-19)

**HTML-backed admin contentvelden gebruiken gedeelde TipTap SSoT componenten.**

| Component | Locatie | Doel |
|-----------|---------|------|
| `AdminRichContentEditor` | `shared/AdminRichContentEditor.tsx` | **SSoT** voor full rich-content velden met HTML storage |
| `WorkspaceDescriptionEditor` | `shared/WorkspaceDescriptionEditor.tsx` | **SSoT** voor compacte description velden in workspace detail-panelen |
| `ProductDescriptionEditor` | `products/ProductDescriptionEditor.tsx` | Backward-compatible alias → verwijst naar `WorkspaceDescriptionEditor` |

Regels:
- ✅ Gebruik `AdminRichContentEditor` voor HTML-backed admin contentvelden zoals page content, FAQ answers, announcement bodies, footer shop description en email template body.
- ✅ Gebruik `WorkspaceDescriptionEditor` voor compacte description velden in workspace detail-panelen.
- ✅ Beide editors leveren HTML output; een lege editor levert een lege string.
- ✅ Nieuwe HTML-backed admin contentvelden krijgen geen page-specifieke TipTap wrapper; gebruik altijd een gedeelde SSoT component uit `shared/`.
- ❌ GEEN `<textarea>` voor HTML-backed admin contentvelden.
- ❌ GEEN nieuwe losse `RichTextEditor` instanties direct in pagina's of admin componenten voor deze velden.

Expliciet buiten scope:
- Plain-text velden zoals partner descriptions, season notes, order notes/reasons, role descriptions, newsletter text en soortgelijke render-risico velden.
- SEO meta descriptions en andere korte plain-text SEO velden.
- Markdown editors, readonly/code velden en andere niet-HTML storage contracten.

Workspace detail descriptions met TipTap:
- ProductsPage (via `ProductDescriptionEditor` alias)
- CategoriesPage (via `WorkspaceDescriptionEditor`)
- CouponsPage (via `WorkspaceDescriptionEditor`)

**Omschrijving-assistent (#86, 2026-06):**
- TipTap toolbars tonen een gouden assistent-knop wanneer `contentAssistantContext` is meegegeven via `AdminRichContentEditor` / `WorkspaceDescriptionEditor`.
- Modal: `AdminContentAssistantModal` + `AdminContentAssistantPanel` — zelfde gold grammar als sidebar-assistent (#69), maar aparte chat/API/storage.
- **Layout (2026-06 redesign):** master-detail workspace in de modal — links actiekaarten (quick prompts), rechts invoer/voorstel/controle/footer; beide kolommen scrollen onafhankelijk (`admin-content-assistant-panel__left` / `__right`). Introkaarten links en rechts zijn permanent inklapbaar via `admin-content-assistant-intro-storage.ts` (localStorage, per tenant/gebruiker).
- Styling: `@pagayo/design` → `contexts/admin/account-navigation.css` (`.modal--content-assistant`, `.admin-content-assistant-panel__*`).
- Toepassen vervangt alleen het veld na expliciete bevestiging; geen autosave vanuit de assistent.
- Tier-gating via policy feature `AI_CONTENT` (PROFESSIONAL+); enforcement via `AI_CONTENT_POLICY_ENFORCED` in `admin-content-assistant.constants.ts`.
- **Product-SEO-skelet:** bij SEO-intent op `product.description` / `shortDescription` injecteert de API het vaste HTML-skelet (`content-assistant-product-seo-template.ts`: min. 2× `<h2>`, `<ul>`, geen `<h1>`). Quick prompt **SEO-structuur** gebruikt per-locale i18n-berichten (`promptSeoStructureMessage` in nl/en/de).
- **Autosave scroll:** na product-autosave blijft het detailformulier gemount (geen `detailLoading`-spinner); form state wordt niet overschreven door server-refetch — pariteit met categories-workspace.

**Admin workspace modal shell (SSoT, 2026-06):**
- Vaste shell voor grote admin-workspace-dialogen: **1280px breed** (max), **720px hoog** (max), beide viewport-clamped via `--admin-workspace-modal-*` in `@pagayo/design` `contexts/admin/_base.css`.
- Class: `modal--admin-workspace` (`account-navigation.css`). Nieuwe consumers: altijd deze class op `Modal` + eigen inhoudsvariant; geen ad-hoc `width`/`height` in feature-CSS.
- Gebruikers: `AdminAssistantModal`, `BlockEditModal` (`modal--block-edit`), `AdminPagayoIdeasModal` (`modal--pagayo-ideas`).
- **Uitzondering:** `AdminContentAssistantModal` (`modal--content-assistant`) — veld-assistent; grotere hoogte (860px), niet de workspace-shell.

**Assistant workspace (#69, 2026-06):**
- Sidebar **Assistent**-knop opent `AdminAssistantModal` (`modal--assistant modal--assistant-workspace modal--admin-workspace`) — vier kolommen: **A modules** (`AdminAssistantModuleNav`) · **B composeren** · **C gesprek** · **D preview & toepassen`.
- Modules: Assistent (default) · Openingstijden (link **Basisrooster beheren** → `/admin/opening-hours`) · Mededelingen (link → `/admin/announcements`). Chatgeschiedenis per module (`admin-assistant-chat-storage.ts`).
- Mutaties OH/mededelingen: workspace-tools + bevestiging in kolom D via `POST /api/admin/ai/workspace-apply`.
- **Ideeën & vragen:** Pagayo-wordmark linksonder → `AdminPagayoIdeasModal` (`modal--admin-workspace`) + `AdminPagayoIdeasPanel`.
- Dashboard: `DashboardAssistantShortcuts` i.p.v. OH/announcements-widgets; panel-id `dashboardAssistantShortcuts`.

### Reports Controls SSoT

Voor reports subpagina's (`/admin/reports/*`) geldt een gekoppelde SSoT voor de header-controls:

- UI via `ReportsPageHeader` (gedeelde component)
- Toolbarstructuur via `WorkspaceToolbar` + `WorkspaceToolbarLeft` + `WorkspaceToolbarRight`
- Periodebron via `REPORT_PERIOD_OPTIONS` (`src/client/pages/admin/reports/reports.period-options.ts`)
- Geen inline styles in reports componenten; styling uitsluitend via `@pagayo/design` (`contexts/admin/reports.css`)
- **Analytics-layout** (`ReportsPageHeader` zonder `layout="workspace"`): de period/export-toolbar staat **binnen** `<header class="reports-page-header">`, direct onder `reports-page-header__nav`. Ruimte tot de tabs: `.reports-page-header__nav + .products-workspace-toolbar` → `margin-top: var(--admin-toolbar-gap)`.
- **Workspace-layout** (`layout="workspace"`, o.a. POS dagafsluitingen): alleen tab-nav in de header; de paginatoolbar staat **als volgende sibling** na `</header>`. Dezelfde verticale afstand tot de tabs: `.reports-page-header + .products-workspace-toolbar` in `reports.css` (zelfde token `--admin-toolbar-gap` als hierboven).
- **Reports + master-detail (POS)**: de rechter detailkolom volgt hetzelfde bordered-card patroon als de Orders workspace — `products-card products-detail-card` (en bestaande workspace-detail-hulpklassen), niet alleen `products-detail-card` zonder `products-card`.

---

## 🏗️ Admin Shell — Volledige Layout Structuur

**Dit is het fundament. ELKE admin pagina rendert binnen deze structuur.**

### Component Hiërarchie

```
AdminApp.tsx
└── I18nProvider
    └── AdminLayout.tsx          ← Auth check + shell
        ├── AdminSidebar.tsx     ← Persistente accountnavigatie links
        └── <main.admin-main>
            ├── InstallAppBanner + AnnouncementBanner
            └── Router.tsx       ← Pagina content (children)
```

### HTML Structuur (wat de browser ziet)

```html
<div class="admin-shell">                       ← AdminLayout
  <aside class="admin-account-nav">             ← AdminSidebar (desktop)
    <div class="admin-account-nav__panel">...</div>
  </aside>

  <main class="admin-main">
    <div class="install-app-banner">...</div>
    <div class="announcement-banner">...</div>

    <div class="admin-page">                    ← Pagina component
      <header class="admin-page-header">...</header>
      <div class="admin-page-content">...</div>
    </div>
  </main>
</div>
```

### Bestanden & Verantwoordelijkheden

| Component | Bestand | CSS | Verantwoordelijkheid |
|-----------|---------|-----|----------------------|
| `AdminApp` | `admin/AdminApp.tsx` | — | Mount point, I18nProvider wrapper |
| `AdminLayout` | `admin/AdminLayout.tsx` | — | Auth check, rendert shell (sidebar + main) |
| `AdminSidebar` | `admin/AdminSidebar.tsx` | `@pagayo/design` → `contexts/admin/account-navigation.css` | Desktop accountnavigatie |
| `AdminNavbar` | `admin/AdminNavbar.tsx` | `@pagayo/design` → `contexts/admin/navbar.css` | Legacy component (momenteel niet gemount in shell) |
| `AdminFooter` | `admin/AdminFooter.tsx` | `@pagayo/design` → `contexts/admin/footer.css` | Legacy component (momenteel niet gemount in shell) |
| `Router` | `admin/Router.tsx` | — | URL → pagina component mapping |

Huidige runtime-shell (2026-04-05): `AdminLayout` mount `AdminSidebar` + `main.admin-main`, zonder vaste topnavbar-offset.

### CSS Pipeline

```
pagayo-design/src/contexts/admin/*.css
    ↓ node build.js
pagayo-design/dist/revolutionary/admin.css
    ↓ npm link @pagayo/design (dev) of npm install (CI)
    ↓ npm run copy-design
pagayo-storefront/public/design/dist/revolutionary/admin.css
    ↓ Vite :5173 of serve :5500 (dev) of Cloudflare Pages (prod); `npm run dev` start Vite + Wrangler
Browser laadt via <link rel="stylesheet" href="/design/dist/revolutionary/admin.css">
```

### ⛔ HARDE REGELS VOOR DE ADMIN SHELL

| Regel | Waarom |
|-------|--------|
| **GEEN inline `<style>` in componenten** | Alle CSS hoort in `pagayo-design/src/contexts/admin/*.css` |
| **GEEN lokale CSS bestanden in storefront** | Eén bron: `@pagayo/design` |
| **GEEN hardcoded kleuren/spacing** | Altijd design tokens (`var(--accent)`, `var(--space-4)`) |
| **GEEN wijzigingen aan de shell zonder overleg** | AdminLayout, AdminSidebar en admin-main spacing-contract zijn structureel |
| **GEEN nieuwe CSS classes verzinnen** | Check eerst of er al een class bestaat in de design system |

### Nieuwe CSS toevoegen (de juiste manier)

1. Maak/bewerk CSS in `pagayo-design/src/contexts/admin/{naam}.css`
2. Gebruik `@layer contexts` (automatisch via build.js)
3. Build: `cd pagayo-design && node build.js`
4. Storefront pakt het op via `npm run copy-design` of `npm run dev`

**NOOIT:** CSS direct in een `.tsx` component zetten (inline of `<style>` tag)

### Design System Uitbreiden (VERPLICHT bij ontbrekende tokens)

**Het design system is een LEVEND document.** Als een feature een waarde nodig heeft die nog geen token is:

| Situatie | Actie | Bestand |
|----------|-------|---------|
| Nieuwe spacing nodig (bijv. 6px) | Token toevoegen aan spacing scale | `pagayo-design/src/tokens/_base.css` |
| Nieuwe font-size nodig (bijv. 10px) | Token toevoegen aan typography scale | `pagayo-design/src/tokens/_base.css` |
| Nieuwe semantic kleur nodig | Token toevoegen aan theme JSON + generator | `pagayo-design/src/themes/*.json` + `generate-tokens.js` |
| Nieuwe feature kleur (bijv. member/indigo) | Token toevoegen aan theme JSON als semantic set | `pagayo-design/src/themes/*.json` |

**Harde regels:**
- ❌ NOOIT een hardcoded waarde gebruiken omdat er "geen token is" — **voeg de token toe**
- ❌ NOOIT een token toevoegen zonder het door te trekken naar ALLE plekken in het project die dezelfde waarde hardcoded gebruiken
- ✅ Nieuwe token? → Zoek met `grep` of dezelfde hardcoded waarde elders voorkomt en vervang die ook
- ✅ Nieuwe token in `_base.css`? → Rebuild: `cd pagayo-design && node build.js`
- ✅ Nieuwe theme kleur of skin-token? → Toevoegen / spiegelen in **alle** theme JSON-bestanden onder `pagayo-design/src/themes/` die bij horen bij consumer-skins (`fresh`, `classic`, `revolutionary`, `aqua`) en zo nodig `portal` — zie `pagayo-design/THEME-SKIN-MODEL.md`.
- ✅ Update dit DESIGN.md document als er structurele tokens bijkomen

**Voorbeeld workflow:**
```bash
# 1. Je hebt font-size: 10px nodig maar --text-2xs bestaat niet
# 2. Voeg --text-2xs toe aan pagayo-design/src/tokens/_base.css
# 3. Grep alle CSS: grep -rn 'font-size:\s*10px' pagayo-design/src/
# 4. Vervang ALLE hits met var(--text-2xs)
# 5. Rebuild: cd pagayo-design && node build.js
# 6. Klaar: één bron, overal consistent
```

## Icon Library: Lucide React

**ALWAYS use Lucide icons. NEVER use other icon libraries.**

```tsx
// ✅ CORRECT
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';

// ❌ FORBIDDEN
import { FaSearch } from 'react-icons/fa';  // NO!
import { MdAdd } from 'react-icons/md';      // NO!
```

### Common Icons Reference

| Action | Icon | Import |
|--------|------|--------|
| Save | Save | `import { Save } from 'lucide-react'` |
| Back | ArrowLeft | `import { ArrowLeft } from 'lucide-react'` |
| Edit | Pencil | `import { Pencil } from 'lucide-react'` |
| Delete | Trash2 | `import { Trash2 } from 'lucide-react'` |
| Add/Create | Plus | `import { Plus } from 'lucide-react'` |
| Duplicate | Copy | `import { Copy } from 'lucide-react'` |
| Search | Search | `import { Search } from 'lucide-react'` |
| View | Eye | `import { Eye } from 'lucide-react'` |
| Settings | Settings | `import { Settings } from 'lucide-react'` |
| Close | X | `import { X } from 'lucide-react'` |
| Warning | AlertTriangle | `import { AlertTriangle } from 'lucide-react'` |
| Success | CheckCircle | `import { CheckCircle } from 'lucide-react'` |
| Info | Info | `import { Info } from 'lucide-react'` |
| Download | Download | `import { Download } from 'lucide-react'` |
| Upload | Upload | `import { Upload } from 'lucide-react'` |

### ActionButton Component (Preferred)

For admin page actions, use `ActionButton` from `@/components/ActionButton`:

```tsx
import { ActionButton, ActionButtonGroup } from '../../components/ActionButton';

// Available actions:
// save, back, edit, delete, view, duplicate, archive, restore, download, new, export, ship, cancel, print, invoice

// As button:
<ActionButton action="save" onClick={handleSave} title="Opslaan" />
<ActionButton action="delete" onClick={handleDelete} disabled={saving} />

// As link (for downloads/external):
<ActionButton action="print" href="/api/orders/123/packing-slip" target="_blank" title="Pakbon" />
```

### Icon Sizing Standard

**ALTIJD:** `size={20} strokeWidth={1.5}` voor ALLE icons in admin tabellen.

Dit geldt voor:
- ActionButton (row actions: view, edit, delete, duplicate, save, cancel, etc.)
- Chevrons (expand/collapse)
- Alle andere interactieve icons

| Context | Size | StrokeWidth | Notes |
|---------|------|-------------|-------|
| ActionButton icons | 20 | 1.5 | Alle row/form actions |
| Chevrons | 20 | 1.5 | Expand/collapse |
| Status indicators | 14 | 1.5 | Kleine inline icons (voorraad warnings) |
| Menu icons | 20 | 1.5 | Sidebar menu |

**VERBODEN:**
```tsx
// ❌ NOOIT size={24} of andere waarden voor actie icons
<Save size={24} />     // FOUT
<Trash2 size={16} />   // FOUT

// ✅ ALTIJD size={20}
<Save size={20} strokeWidth={1.5} />     // GOED
// Of beter: gebruik ActionButton component
<ActionButton action="save" onClick={...} />  // BESTE
```

### Icon Styling Consistency

All icons must use the same color: `var(--text-secondary, #666)`

This applies to:
- Header action buttons (ActionButton component)
- Row action buttons (ActionButton component)
- Sidebar info section icons
- PDF/print action icons
- Any other UI icons

### PDF/Print Actions

PDF download and print buttons must be icon-only, positioned in the header actions area.

**Icons to use:**
| Action | Icon | Import |
|--------|------|--------|
| Print (Packing Slip) | Printer | `import { Printer } from 'lucide-react'` |
| PDF (Invoice) | FileText | `import { FileText } from 'lucide-react'` |

**Structure (bij voorkeur ActionButton):**
```tsx
{/* Gebruik ActionButton voor consistente sizing */}
<ActionButton action="print" href={pdfUrl} target="_blank" title="Pakbon printen" />
<ActionButton action="invoice" href={invoiceUrl} target="_blank" title="Factuur downloaden" />
```

**Rules:**
- Icon-only (NO text labels like "Printen" or "Afdrukken PDF")
- Position: RIGHT side in `admin-header-actions`
- Use `title` attribute for tooltip
- Size: 20px, strokeWidth: 1.5 (via ActionButton — zelfde als alle andere icons)
- Color: `var(--text-secondary, #666)` (via ActionButton)

## CSS Design Tokens

**ALWAYS use CSS custom properties from `@pagayo/design`. NEVER hardcode colors or spacing.**

> **BELANGRIJK:** Storefront bevat GEEN lokale CSS bestanden. Alle styling komt uit `@pagayo/design`
> (geladen via `<link>` tag: `/design/dist/{theme}/admin.css` voor admin pagina's).

### Control Sizing — Products Workspace Baseline

Voor admin list/workspace pagina's is de Products workspace nu de maatgevende baseline.

| Elementgroep | Baseline maat | Referentie |
|-------|-------|---------|
| Toolbar pill buttons | 28px hoogte | `.products-workspace-toolbar__action` |
| Toolbar icon-only pill (Lucide als enig kind van de knop) | glyph 16×16px, knoop vierkant 28×28px | `--admin-toolbar-inline-icon-size` + `products.css` (`:has(> svg:only-child)`) — geen losse `size=` op pagina’s |
| Toolbar select/date | 28px hoogte | `.products-workspace-toolbar__select`, `.products-workspace-toolbar__date` |
| Linkerkolom search input wrap | 34px hoogte | `.products-search-input-wrapper` |
| Linkerkolom filter controls | 30px hoogte | `.products-control-dropdown-btn` |
| Rechterkolom compacte velden (title/slug/settings/media) | 32px hoogte | `.products-workspace-field` |
| Rechterkolom zoekveld met leading icoon (detailpaneel) | Zelfde chrome/hoogte als typ-velden | `.products-workspace-search-field` + `__icon` + `__input` (zie Contentdeel SSoT) |
| Rechterkolom typografie body + hero | 13px | `--admin-workspace-detail-font` (afgeleid van `--admin-products-list-font`) |
| Sectie/meta labels | 13px uppercase | `.products-workspace-section__title`, `.products-editor-label` |

Regels:
- Gebruik bestaande products-workspace classes en tokens als primaire bron.
- Voeg geen alternatieve maatvoering toe op andere list/workspace pagina's zonder expliciete wijziging van deze SSoT.
- Als input en button binnen dezelfde controlgroep staan, gebruik dezelfde hoogte-token of dezelfde baseline class.

---

### Standaard Knop-model — Admin én POS (SSoT)

**Het admin toolbar-knopmodel is het universele standaard voor alle compact interactive controls in admin én POS.**

De referentie-implementatie is `.products-workspace-toolbar__action` in `pagayo-design/src/contexts/admin/products.css`.

#### Visuele waarden (hardcoded in toolbar-baseline, niet via generieke tokens)

| Eigenschap | Waarde | Token |
|---|---|---|
| `height` | 28px | `var(--admin-control-compact)` |
| `border-radius` | 999px (pill) | `var(--admin-radius-pill)` |
| `border` | `1px solid #cfd5de` | — |
| `background` | `#ffffff` | — |
| `color` | `#4a5568` | — |
| `font-size` | 13px | `var(--admin-list-toolbar-control-font)` |
| `font-weight` | 500 | — |
| `padding` | `0 14px` | `var(--admin-list-row-padding-x)` |

#### States

| State | Border | Background | Color |
|---|---|---|---|
| Default | `#cfd5de` | `#ffffff` | `#4a5568` |
| Hover | `#b8c2d0` | `#ffffff` | `#2d3748` |
| Active/selected | `var(--accent)` | `var(--accent-subtle)` | `var(--accent)`, fw 600 |
| Danger | — | — | `#e53935` |
| Danger hover | `#efc3bf` | `#fdf0ef` | `#d93025` |
| Primary | `#2e63e5` | `#2f66ea` | `#ffffff` |
| Disabled | `#d8dee8` | `#eef2f6` | `#9aa3af` |

#### Toepassing in POS

- **Categorie-rij** (`.pos-categories`): zelfde rij-maat als `.products-workspace-toolbar` — `min-height: var(--admin-control-compact, 28px)`, `padding: 0`, `margin: 0 0 var(--space-3)`, `gap: 8px`, achtergrond `#ffffff`, geen onderrand; geen extra verticale padding rond de pills.
- **Categorie-filterpills** (`.pos-category-pill`): exact dit model, actief = accent-state.
- **Numpad quick-amount chips** (`.pos-numpad__quick-btn`): zelfde pill-shape/28px, actief = accent.
- **POS-specifieke spec**: `pagayo-docs/pos-mockup.html` is de visuele referentie voor de kassa-layout.
- **Numpad layout**: telefoon/pinpad volgorde (1 bovenaan, 7 onderaan) — NIET calculator-volgorde.
- **Cash-flow knoppen**: primaire actie (groen/success) altijd links, annuleren (outline) rechts.
- **Keukenwerkbon (POS)**: na geslaagde betaling (`POSPaymentModal` → `handleSuccess`) printt de kassa een **werkbon** (orderregels, geen totalen/BTW) via `GET /api/pos/orders/:orderId/kitchen-ticket` + **verborgen iframe** + `contentWindow.print()` — **geen** nieuw tabblad (anders dan pas-PDF-print). HTML gebruikt `@pagayo/design` `pos/receipt.css` met modifier `.pos-receipt--kitchen`. Instelling `posKitchenTicketSettings.autoPrint` in admin Print-instellingen én POS-tandwielpaneel; bij `false` knop “Werkbon printen” op success. Fiscale kassabon is een apart open punt.

#### Regels

- ❌ NOOIT een nieuwe button-stijl introduceren die afwijkt van het toolbar-model zonder expliciete SSoT-wijziging hier.
- ❌ NOOIT `border-radius: var(--radius-md)` of `var(--radius-sm)` voor compact admin/POS controls — gebruik `var(--admin-radius-pill)`.
- ✅ Gebruik de `Button`-component voor grote CTA's; gebruik het toolbar-model voor compacte filter/actie-controls.

---

### Page Title Sizing — UNIVERSEEL

| Token | Value | Gebruik |
|-------|-------|---------|
| `--page-title-size` | 13px in admin | Elke admin pagina h1 |
| `--page-title-weight` | 600 | Elke pagina h1 |
| `--section-title-size` | 13px in admin | Sectie headers binnen admin pagina's |
| `--section-title-weight` | 600 | Sectie headers |
| `--card-title-size` | 13px in admin | Card/form section headers |
| `--card-title-weight` | 500 | Card/form section headers |

```css
/* ✅ CORRECT — universele titels */
h1 { font-size: var(--page-title-size); font-weight: var(--page-title-weight); }

/* ❌ VERBODEN — hardcoded font sizes voor titels */
h1 { font-size: 1.75rem; }   /* Gebruik --page-title-size */
h1 { font-size: 28px; }      /* Gebruik --page-title-size */
```

### Colors

```css
/* ✅ CORRECT — v2 tokens */
color: var(--accent);
background: var(--bg-surface);
color: var(--text-primary);
border: 1px solid var(--border);

/* ❌ FORBIDDEN — v1 tokens (verouderd) */
color: var(--pagayo-primary-600);  /* Gebruik --accent */
background: var(--pagayo-neutral-100);  /* Gebruik --bg-surface */

/* ❌ FORBIDDEN — hardcoded */
color: #2563eb;
background: #f3f4f6;
```

### Color Scale (v2 tokens)

| Token | Usage |
|-------|-------|
| `--accent` | Primary actions, links, active states |
| `--accent-light` | Hover state for primary actions |
| `--accent-dim` | Subtle primary backgrounds |
| `--bg-deep` | Page background |
| `--bg-surface` | Card/section backgrounds |
| `--bg-elevated` | Elevated elements (modals, dropdowns) |
| `--bg-hover` | Hover state backgrounds |
| `--text-primary` | Main text |
| `--text-secondary` | Secondary/supporting text |
| `--text-muted` | Disabled/placeholder text |
| `--success` / `--success-dim` | Success states |
| `--error` / `--error-dim` | Error states |
| `--warning` / `--warning-dim` | Warning states |
| `--info` / `--info-dim` | Info states |
| `--border` | Default borders |

### Spacing (4px Grid)

```css
/* ✅ CORRECT — v2 tokens */
padding: var(--space-4);  /* 16px */
margin: var(--space-2);   /* 8px */
gap: var(--space-6);      /* 24px */

/* ❌ FORBIDDEN */
padding: 15px;  /* NO! Use 16px (space-4) */
margin: 10px;   /* NO! Use 8px (space-2) or 12px (space-3) */
```

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tiny gaps |
| `--space-2` | 8px | Small gaps, tight padding |
| `--space-3` | 12px | Medium gaps |
| `--space-4` | 16px | Standard padding |
| `--space-5` | 20px | Medium-large spacing |
| `--space-6` | 24px | Section spacing |
| `--space-8` | 32px | Large section spacing |

### Typography

Storefront tenant fonts use preset keys (`shop.fontPreset`, `shop.headingFontPreset`) resolved to `--tenant-font-main` / `--tenant-font-heading` at SSR. Admin: **Design → Typografie** (`/admin/design/typography`). Catalog SSoT: `@pagayo/config/fonts`; `@font-face` + woff2: `@pagayo/design` (`src/tokens/fonts.css`). Header/footer per-target typography uses the same preset keys (`fontPreset` on `TypographyStyleSettings`).

```css
font-size: var(--text-base);  /* 16px */
font-weight: var(--font-medium);  /* 500 */
font-size: var(--text-sm);  /* 13px */
font-size: var(--text-lg);  /* 18px */
```

### Shadows & Borders

```css
box-shadow: var(--shadow-md);
border-radius: var(--radius-lg);  /* 12px */
border-radius: var(--radius-md);  /* 8px */
```

### Golden Controls — Radio Buttons, Checkboxes, Selects

**Golden accent-styling voor form primitives is gedeeld** (o.a. `components/forms/_base.css` in `@pagayo/design`) en wordt in **elke** context-bundle geladen — voor de tenant-gekozen **skin** (`fresh`, `classic`, `revolutionary`, `aqua`) in webshop-, POS- en admin-CSS. Het merk-accent (golden) is in implementatie niet “alleen revolutionary”: alle skins gebruiken dezelfde gedeelde formule binnen hun bundle.

#### Single Source of Truth

De golden form overrides staan in **`components/forms/_base.css`** (gedeelde laag).
Ze worden automatisch geladen door ALLE context bundles (admin.css, webshop.css, pos.css).

- ❌ NOOIT golden overrides dupliceren in context CSS (forms-admin.css, checkout.css)
- ❌ NOOIT `--border-subtle` of `--border-default` voor form controls
- ✅ Eén plek: `components/forms/_base.css` → overal consistent

#### Kleurwaarden (consistent in alle contexten)

| State | Border | Background | Gebruik |
|-------|--------|------------|---------|
| **Default** | `rgb(245 166 35 / 0.35)` | transparant | Niet-geselecteerde radio/checkbox |
| **Hover** | `rgb(245 166 35 / 0.5)` | `rgb(245 166 35 / 0.03)` | Hover over optie |
| **Selected** | `var(--accent)` | `rgb(245 166 35 / 0.08)` | Geselecteerde optie |
| **Selected ring** | `var(--accent)` | `rgb(245 166 35 / 0.1)` | De radio circle/checkbox zelf |

#### Selects (dropdowns) — via `_base.css`

```css
/* Default state */
background-color: rgb(245 166 35 / 0.08);
border-color: rgb(245 166 35 / 0.15);

/* Hover */
border-color: rgb(245 166 35 / 0.3);

/* Focus */
background-color: rgb(245 166 35 / 0.12);
```

#### Radio Buttons (shipping/payment option cards)

```css
/* Radio circle — default */
border: 2px solid rgb(245 166 35 / 0.35);

/* Radio circle — hover */
border-color: rgb(245 166 35 / 0.5);

/* Radio circle — selected */
border-color: var(--accent);
background: rgb(245 166 35 / 0.1);

/* Option card — default border */
border: 1px solid rgb(245 166 35 / 0.15);

/* Option card — selected */
border-color: var(--accent);
background: rgb(245 166 35 / 0.08);
```

#### Checkboxes

```css
accent-color: var(--accent);  /* Browser-native golden checkbox */
```

**Regel:** radiobuttons, checkboxes en selects moeten visueel herkenbaar zijn als golden controls.
NOOIT `--border-subtle` of `--border-default` voor deze controls — altijd de golden `rgb(245 166 35 / *)` schaal.

---

### Scrollbar Behavior

**KRITIEK:** Gebruik `overflow-y: scroll` i.p.v. `auto` voor de main content area.

Dit voorkomt layout shift wanneer sommige pagina's wel/niet een scrollbar nodig hebben.

```css
/* ✅ CORRECT - scrollbar neemt altijd ruimte in */
.admin-main {
  overflow-y: scroll;
}

/* ❌ FOUT - layout verspringt tussen pagina's */
.admin-main {
  overflow-y: auto;
}
```

## Component Patterns

### Admin Pages

All admin pages MUST use these CSS classes from `@pagayo/design` admin context:

```tsx
<div className="admin-page">
  <div className="admin-page-header">
    <h1>Page Title</h1>
  </div>
  <div className="admin-page-content">
    {/* Content */}
  </div>
</div>
```

### CSV import in workspace (SSoT)

**Products** and **partners** open import in the **right detail panel** (zelfde shell als master-detail):

- Pagina: `admin-page products-page` (+ `partners-page` waar van toepassing).
- Toolbar: `WorkspaceToolbar` / `products-workspace-toolbar` (witte balk, pill-acties).
- Detail: `ProductImportWorkspaceDetail` / `PartnerImportWorkspaceDetail` — hergebruikt `products-import-*` layout (hero, summary grid, upload panel, preview list, primary import knop).
- Sluiten: `common.cancel` in de hero (geen losse `admin-page-header` + `ActionButton`).
- Uitleg (B1, design-admin): ingeklapt onderaan via `<details>` (`admin.partners.import.help.expand`), niet boven de upload.

Route `/admin/partners/import` rendert nog steeds `PartnersPage` in import-modus (diep link + toolbar Import).

**Legacy standalone** (nog niet workspace): `CouponImportPage`, `ProductImportPage` — geen grijze losse pagina toevoegen; nieuwe import hoort in workspace-detail.

### Two-Column Form Layout (Detail/Edit Pages)

Edit pages met meerdere secties gebruiken `settings-two-col` voor een twee-kolommen layout.
Responsive: op ≤768px worden kolommen automatisch gestapeld.

```tsx
<div className="admin-page-content">
  <form onSubmit={handleSubmit}>
    <div className="settings-two-col">
      {/* LEFT COLUMN */}
      <div className="settings-col">
        <div className="form-section">
          <h3 className="form-section-title">Basisinformatie</h3>
          {/* Primary fields: naam, slug, beschrijving, etc. */}
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="settings-col">
        <div className="form-section">
          <h3 className="form-section-title">SEO</h3>
          {/* Secondary fields: meta titel, meta beschrijving */}
        </div>
        <div className="form-section">
          <h3 className="form-section-title">Afbeelding</h3>
          {/* Image upload */}
        </div>
      </div>
    </div>
  </form>
</div>
```

**CSS classes (uit `@pagayo/design` → `contexts/admin/settings.css`):**

| Class | Doel |
|-------|------|
| `.settings-two-col` | Grid container: `1fr 1fr`, gap `--space-8` |
| `.settings-col` | Kolom wrapper: flex column |
| `.form-section` | Card met gradient border, padding `--space-8` |
| `.form-section-title` | Card header, `--card-title-size` (13px in admin) |

**Vuistregel voor kolom-verdeling:**

| Linker kolom | Rechter kolom |
|-------------|---------------|
| Basisinformatie (naam, slug, status) | SEO (meta titel, beschrijving) |
| Beschrijving / content | Afbeelding / media |
| Organisatie / relaties | Prijzen / voorraad |

**Pagina's die dit pattern gebruiken:**
- `ProductsPage` workspace (detailkolom + form-section cards waar van toepassing)
- `CategoriesPage`, `CouponsPage`, `BlogPage` workspaces
- `PagesPage` workspace (CMS-pagina’s: rich content + content blocks in de rechterkolom; zie canonieke admin-URL’s). **Blok toevoegen:** `btn btn--secondary btn--sm gap-05` met leading Lucide-icoon (`Plus` / `Mail`) — zelfde patroon als workspace-sectie-acties (bijv. `BlogPage` preview, `OpeningHoursPage` add-exception); geen plain-text knoppen zonder icoon/border-affordance.

---

## Autosave Pattern

Edit pages gebruiken de `useAutosave` hook voor automatisch opslaan na wijzigingen.

### Hoe het werkt

Delay-SSoT: [`src/client/lib/autosave-config.ts`](lib/autosave-config.ts) (`AUTOSAVE_DEBOUNCE_MS` = 1200).

```
Tekst/rich editor → scheduleDebounced(formData) → 1200ms debounce → flush → API → uiStore
Toggle/select    → scheduleImmediate(formData) → direct flush → API → uiStore
```

`schedule` is een alias voor `scheduleDebounced` (backward compat). Bij logout/navigation: [`autosave-registry`](lib/autosave-registry.ts) flusht pending werk.

Status wordt bijgehouden in `uiStore` en geconsumeerd door pagina-UI (bijv. Save-knop state in Products workspace):
- **saving** → lopende autosave state
- **saved** → tijdelijke successtate met terug-animatie
- **error** → foutstatus voor zichtbare feedback

### Veldtype-matrix (intent)

| Intent | API | Voorbeelden |
|--------|-----|-------------|
| **debounced** | `scheduleDebounced` | `<input type="text">`, textarea, `AdminRichContentEditor`, slug |
| **immediate** | `scheduleImmediate` | checkbox, switch, `<select>`, `datetime-local`, published/pinned |
| **geen autosave** | — | create-flow (`enabled: false`), connect/disconnect, order-status |

Helper: [`autosave-schedule.ts`](lib/autosave-schedule.ts) — `scheduleAutosaveForField`, `autosaveFieldKindForValue`.

### Gebruik

```tsx
import { useAutosave } from '../../hooks/useAutosave';
import { scheduleAutosaveForField, autosaveFieldKindForValue } from '../../lib/autosave-schedule';

const { scheduleDebounced, scheduleImmediate } = useAutosave(persistData, { enabled: !isNew });
const schedulers = { debounced: scheduleDebounced, immediate: scheduleImmediate };

const handleTextChange = (name: string, value: string) => {
  setFormData(prev => {
    const updated = { ...prev, [name]: value };
    scheduleDebounced(updated);
    return updated;
  });
};

const handleToggle = (name: string, checked: boolean) => {
  setFormData(prev => {
    const updated = { ...prev, [name]: checked };
    scheduleImmediate(updated);
    return updated;
  });
};

// Of voor string | boolean in één handler:
scheduleAutosaveForField(schedulers, next, autosaveFieldKindForValue(value));
```

### Regels

| Regel | Waarom |
|-------|--------|
| `enabled: !isNew` | Nieuwe items bestaan nog niet in DB — handmatige submit vereist |
| `useCallback` voor persistFn | Voorkomt onnodige re-renders |
| Schedule NA state update | Zodat latest data wordt gepersist |
| Toggles/selects → `scheduleImmediate` | Directe feedback; geen debounce op klik |
| Tekst → `scheduleDebounced` | Minder API-ruis tijdens typen |

### Autosave Scope Matrix (Admin)

Gebruik deze classificatie bij nieuwe of bestaande admin-forms:

| Classificatie | Toepassen op | Reden |
|---------------|--------------|-------|
| `autosave-safe` | Tekst/config-velden zonder side effects (bijv. FAQ content/config, algemene settings tabs) | Debounced save voorkomt dataverlies en veroorzaakt geen operationele acties |
| `manual-save-required` | Flows met operationele impact (bijv. order-status mutaties, connect/disconnect acties) | Bewuste, expliciete commit vereist voor auditbaarheid en voorspelbaarheid |
| `hybrid` | UI die direct per actie persist (bijv. integratie toggles) + expliciete acties voor gevoelige stappen | Niet alles is geschikt voor debounce; combineer immediate save met expliciete knoppen |

### Bekende pagina-classificatie

- `autosave-safe`: `FaqPage` (`faq-edit`, `intro-config`, `contact-config`), `SettingsPage` tabs (`general`, `shipping`, `payments`, `invoicing`, `checkout`, `stock`, `email`).
- `manual-save-required`: `FaqPage` `faq-create` (nieuw item eerst expliciet aanmaken), `DomainSettings` (custom-domain mutaties), `OrderEditPage` en vergelijkbare statusflows.
- `hybrid`: `IntegrationsPage` detail-editors zoals `IntegrationStripePage` en `IntegrationMolliePage` (directe toggles/API calls + expliciete connect/test/disconnect acties).

---

## Admin Data Caching

Alle admin list pages en het dashboard gebruiken een in-memory SPA cache.

### Strategie

| Data type | Cache duur | Invalidatie |
|-----------|-----------|-------------|
| **Admin-only** (products, categories, blog, pages, settings) | Onbeperkt (tot page refresh) | Eigen mutatie (create/edit/delete) |
| **Extern gemuteerd** (orders, customers, dashboard) | Onbeperkt | Background version check via KV |

### Hoe het werkt

```
1. Page mount → getCached(key) → HIT? → toon data direct
2. MISS? → fetch API → setCache(key, data) → toon data
3. Na cache hit: background checkVersionStale(resource)
4. Stale? → invalidateResource(resource) → refetch
5. Na eigen mutatie: invalidateResource(resource)
```

### Gebruik in een page hook

```tsx
import {
  getCached, setCache, invalidateResource,
  buildCacheKey, checkVersionStale, isExternallyMutated,
} from '../../utils/adminCache';

// In fetch functie:
const cacheKey = buildCacheKey('/api/admin/orders', { page, limit, status });
const cached = getCached<OrdersResponse>(cacheKey);

if (cached) {
  setData(cached);
  // Background version check voor extern gemuteerde resources
  if (isExternallyMutated('orders')) {
    checkVersionStale('orders').then(stale => {
      if (stale) {
        invalidateResource('orders');
        refetch(); // Haal verse data op
      }
    });
  }
  return;
}

// Geen cache hit — fetch van API
const response = await fetch(url);
const data = await response.json();
setCache(cacheKey, data, 'orders');
```

### API: `adminCache.ts` functies

| Functie | Doel |
|---------|------|
| `getCached<T>(key)` | Data uit cache ophalen (of null) |
| `setCache(key, data, resource)` | Data in cache opslaan |
| `invalidateResource(resource)` | Alle cache entries voor resource type wissen |
| `invalidateAll()` | Volledige cache wissen (bijv. bij logout) |
| `buildCacheKey(path, params)` | Deterministische cache key bouwen |
| `checkVersionStale(resource)` | Background version check via server |
| `isExternallyMutated(resource)` | Of resource extern gemuteerd kan worden |

### Server-side: Auto-bump middleware

Alle admin `POST/PUT/DELETE/PATCH` requests op `/api/admin/*` bumpen automatisch
de cache version in KV. Geen handmatige versie-updates nodig per route.

---

### JSDoc Header Template

Every TSX component should include design references:

```tsx
/**
 * ComponentName
 * Brief description of the component.
 * 
 * @design
 * - Icons: Lucide React only
 * - Tokens: /pagayo-design/src/tokens/ (base + themes)
 * - i18n: VERPLICHT — useI18n() hook, NOOIT hardcoded strings
 * - Layout: Uses .admin-page classes (if admin component)
 */
```

## File References

### Styling
- **Design System:** `@pagayo/design` (alle CSS via design package)
- **Design Tokens:** `/pagayo-design/src/tokens/` (base + theme tokens)
- **Admin CSS bundle:** `/design/dist/{theme}/admin.css` (geladen via `<link>` tag)

### Components
- **Action Buttons:** `src/client/components/ActionButton.tsx`
- **Shared Components:** `src/client/components/admin/shared/`
- **Admin Shell:** `src/client/components/admin/` (AdminApp, AdminLayout, AdminSidebar, Router)
- **Legacy (niet gemount in huidige shell):** `src/client/components/admin/AdminNavbar.tsx`, `src/client/components/admin/AdminFooter.tsx`

### Stores (Zustand)
- **Auth:** `src/client/stores/adminAuthStore.ts` — admin sessie, login/logout, persist to localStorage
- **Cart:** `src/client/stores/cartStore.ts` — winkelwagen state
- **Checkout:** `src/client/stores/checkoutStore.ts` — checkout flow
- **POS:** `src/client/stores/posStore.ts` — kassasysteem state
- **UI:** `src/client/stores/uiStore.ts` — autosave status, UI flags

### Hooks
- **useAutosave:** `src/client/hooks/useAutosave.ts` — debounced autosave voor edit pages
- **useDashboardData:** `src/client/hooks/useDashboardData.ts` — dashboard data + caching
- **useDashboardWorkspaceSettings:** `src/client/hooks/useDashboardWorkspaceSettings.ts` — per-user dashboard widget toggles (`/api/admin/me/dashboard-workspace-settings`)

### Dashboard workspace widgets (2026-05)

Optionele panels op `/admin` via `DASHBOARD_WIDGET_REGISTRY` (`src/lib/dashboard/dashboard-widget-registry.ts`) en `useDashboardWorkspaceSettings`. Widget zichtbaar als `menuAccessKey` eligible is en `widgets[key] !== false`.

**Indeling:** lijst-item `dashboardLayout` (`DASHBOARD_LAYOUT_LIST_KEY`) staat altijd eerst op `/admin/dashboard/settings`; `layout.columns` ∈ {2,3,4} in dezelfde per-user setting. Dashboard past `dashboard-panels dashboard-panels--cols-{N}` toe (CSS in `dashboard-ext.css`; responsive: 4→2 onder 1280px, alles 1 kolom onder 1024px).

**Widgetvolgorde:** lijst-item `dashboardPanelOrder` (`DASHBOARD_PANEL_ORDER_LIST_KEY`) direct na Indeling; `panelOrder: string[]` in dezelfde setting (SSoT ids in `dashboard-panel-catalog.ts`: `menuAnnouncements`, `recentOrders`, `actionRequired`, `recentProfileChanges`, `recentMemberNotes`). Settings: ↑↓ via `product-workspace-row__reorder` (zelfde patroon als homepage-secties). Render op `/admin`: `DashboardPanels` mapt `panelOrder` → DOM-volgorde in `.dashboard-panels` (grid auto-placement: volgorde × kolommen bepaalt positie). Registry-panel alleen als `isWidgetEnabled`; builtin-panel altijd; uitgeschakelde registry neemt geen grid-cel in.

**Mededelingen (`DashboardAnnouncementsWidget`):** `dashboard-panel` shell; lijst `dashboard-order-list` met `dashboard-order-row--with-actions`: klikbaar blok `dashboard-order-row__main` (titel/meta links, pill+datum rechts), acties in `dashboard-order-row__actions` (rechts uitgelijnd, o.a. `WorkspaceToolbarAction` `intent="delete"`); type-badge `dashboard-pill` (`--info` / `--warning` / `--urgent` in `dashboard-ext.css`); verwijderen via `DELETE /api/admin/announcements/:id` + `admin.announcements.deleteConfirm`; snel aanmaken in `products-workspace-section--in-panel` met `products-workspace-form-grid`, `products-editor-field`, `products-editor-label`, `form-input`/`form-select` + `products-workspace-field`, fouten `admin-alert admin-alert--error`, submit in `form-actions` met `products-workspace-toolbar__action--primary`. Geen losse `form-label`, `btn btn--primary`, of widget-specifieke CSS in de storefront.

**Openingstijden (`DashboardOpeningHoursWidget`, `menuOpeningHours`):** alleen **tijdelijke aanpassingen** (`exceptions` in `pool.openingHours`) — overrulen per datum het basisrooster van `/admin/opening-hours`. Geen weeklijst en geen zichtbaarheid op dashboard. UI: `dashboard-panel__subsection-title` (geen losse `products-workspace-section__title` — die strip hoort alleen in `products-workspace-section`); hint `dashboard-panel__base-hint`; lijst `dashboard-order-row--with-actions` met `dashboard-pill--warning` bij gesloten; formulier in `products-workspace-section--in-panel` met `DateInput useNativePicker`, gesloten-checkbox, `dashboard-exception-form__times` voor open/sluit. Link **Basisrooster beheren** → `/admin/opening-hours`. CSS in `dashboard-ext.css`.
- **useOrganization:** `src/client/hooks/useOrganization.ts` — organization data
- **usePermission:** `src/client/hooks/usePermission.ts` — RBAC permission checks
- **useAIConfig:** `src/client/hooks/useAIConfig.ts` — AI configuratie

### Utilities
- **Admin Cache:** `src/client/utils/adminCache.ts` — in-memory SPA cache met version checking
- **CSRF:** `src/client/utils/csrf.ts` — CSRF token helpers
- **API:** `src/client/utils/api.ts` — fetch wrappers
- **Endpoints:** `src/client/utils/endpoints.ts` — URL builders met tenant param

> **BELANGRIJK:** Er zijn GEEN lokale CSS bestanden in storefront.
> Alle styling wordt geleverd door `@pagayo/design`.

---

## Page Layout Patterns

Admin pages follow strict layout patterns for consistency. Use the correct pattern based on page type.

### Page Type Classification

| Type | Examples | Back Button | Pattern |
|------|----------|-------------|---------|
| **Dashboard** | DashboardPage | No | Unique layout (twee-kolommen); optionele widgets via `dashboard-widget-registry` |
| **List Page** | ProductsPage, CategoriesPage, CouponsPage, BlogPage, OrdersPage, CustomersPage, PagesPage, StaffPage, RolesPage | No | Pattern 1 |
| **Detail/Edit Page** | OrderDetailPage, OrderEditPage, OrdersPage (nieuwe order in workspace), CustomerDetailPage, EditStaffPage | Yes (LEFT) | Pattern 2 |
| **Tabbed Page** | SettingsPage | No | Pattern 3 |
| **Configuration Page** | HomepageLayoutPage, HeaderFooterPage | Yes (LEFT) | Pattern 2 + toggles |
| **Integration Page** | IntegrationsPage, IntegrationMolliePage, IntegrationStripePage, IntegrationAnalyticsPage, IntegrationBolcomPage, IntegrationAmazonPage | Varies | Pattern 2/3 |
| **Special** | InviteStaffPage, AcceptInvitePage, AIOnboardingPage | Varies | Custom |

---

### Pattern 1: LIST PAGE

For overview/listing pages. No back button (already at top level).

```
┌─────────────────────────────────────────────────────────┐
│ Producten                                [+ Create] [Export]│
├─────────────────────────────────────────────────────────┤
│ [Search...] [Filter ▼] [Filter ▼]                       │
└─────────────────────────────────────────────────────────┘
```

**Structure:**
```tsx
<header className="admin-page-header">
  <div className="admin-header-row">
    <div>
      <h1>Producten</h1>
    </div>
    <div className="admin-header-actions">
      <ActionButton action="new" onClick={handleNew} />
      <ActionButton action="download" onClick={handleImport} title="Importeren" />
      <ActionButton action="export" onClick={handleExport} />
    </div>
  </div>
</header>
```

**Rules:**
- Title ONLY (geen subtitel): LEFT
- Action buttons: RIGHT (in `admin-header-actions`)
- Action button order: Create → Import → Export (consistent volgorde)
- NO back button
- NO inline styles
- NO `<p>` tags in header

---

### Pattern 2: DETAIL/EDIT PAGE

For individual item pages (view or edit mode).

```
┌─────────────────────────────────────────────────────────┐
│ [←]  Product Name                    [💾] [📋] [🗑️]     │
└─────────────────────────────────────────────────────────┘
```

**Structure:**
```tsx
<header className="admin-page-header">
  <div className="admin-header-row">
    <div className="admin-header-left">
      <ActionButton action="back" onClick={handleCancel} title="Terug naar overzicht" />
      <div>
        <h1>{isNew ? 'Nieuw product' : formData.title || 'Product'}</h1>
      </div>
    </div>
    <div className="admin-header-actions">
      <ActionButton action="save" onClick={() => formRef.current?.requestSubmit()} disabled={saving} title="Opslaan" />
      {!isNew && <ActionButton action="duplicate" onClick={handleDuplicate} title="Dupliceren" />}
      {!isNew && <ActionButton action="delete" onClick={handleDelete} disabled={saving} />}
    </div>
  </div>
</header>
```

**Rules:**
- Back button: LEFT, icon-only (use `ActionButton action="back"`)
- Title: LEFT, direct item name (NO "Product bewerken" prefix)
- NO subtitle needed (item name is enough)
- Action buttons: RIGHT, order: **Save → Duplicate → Delete**
- Save button: ALWAYS first in actions (most important)
- Delete button: ALWAYS last in actions (destructive)
- All buttons: icon-only via ActionButton component
- NO inline styles

**Applies to:**
- OrderDetailPage, CustomerDetailPage
- Any page that drills down from a list with a dedicated full-page header (niet de products/categories/coupons/blog workspace)

---

### Pattern 3: TABBED PAGE (Settings)

For settings and configuration pages with tabs.

```
┌─────────────────────────────────────────────────────────┐
│ Settings                                        [Save]  │
├─────────────────────────────────────────────────────────┤
│ [General] [Shipping] [Payment] [Email] [Other]          │
└─────────────────────────────────────────────────────────┘
```

**Structure:**
```tsx
<header className="admin-page-header">
  <div className="admin-header-row">
    <div>
      <h1>Settings</h1>
    </div>
    <div className="admin-header-actions">
      <button className="btn btn-primary" onClick={handleSave}>
        Save Changes
      </button>
    </div>
  </div>
  <nav className="admin-tabs">
    {/* Tab navigation */}
  </nav>
</header>
```

**Rules:**
- Title: LEFT
- Primary action (Save): RIGHT
- Tabs: Below title row
- NO back button (tabs handle navigation)

---

### Configuration Pages (Pattern 2 variant)

For pages that configure feature sections (e.g. homepage, navigation). Uses Pattern 2 header (back button + title) with `form-section` cards per configurable section.

```tsx
<div className="admin-page-content">
  {/* Pattern 2 header */}
  <div className="admin-header-row mb-6">
    <div className="admin-header-left">
      <ActionButton action="back" onClick={() => navigate('/admin')} />
      <div className="admin-header-title">
        <h1>{t('page.title')}</h1>
        <span className="admin-header-subtitle">{t('page.subtitle')}</span>
      </div>
    </div>
  </div>

  {/* Configurable sections — each is a form-section card */}
  {sections.map((section) => (
    <div className="form-section">
      <div className="admin-header-row">
        <div className="admin-header-left">
          {/* Optional reorder buttons */}
          <h3 className="form-section-title admin-section-title-reset">{section.title}</h3>
        </div>
        <div className="admin-header-actions">
          {/* Toggle checkbox */}
          <div className="form-checkbox-wrapper">
            <input type="checkbox" className="form-checkbox" />
            <label className="form-checkbox-label">Enabled</label>
          </div>
        </div>
      </div>
      {/* Section content: form-group + form-label + form-input */}
    </div>
  ))}
</div>
```

**Rules:**
- Uses `form-section` cards (same as products workspace detail)
- Uses `form-group` + `form-label` + `form-input` for fields (same as products workspace detail)
- Uses `form-checkbox-wrapper` for toggles (NOT settings-toggle)
- Section titles: `form-section-title` (h3)
- Auto-save via `useAutosave` hook of manual `scheduleAutoSave`

**Applies to:**
- HomepageLayoutPage + ContentBlocksPage ✅ (referentie-implementatie)
- HeaderFooterPage (header/footer configuratie)
  - Sectie **Header onderdelen** (`selectedSection=headerElements`): zichtbaarheid (zoeken/account/winkelwagen), **sticky chrome-rij** (`headerChromeSticky`, onafhankelijk van menu-sticky), kleuren (chrome-rij, hover, zoek-/account-panel, winkelwagen-drawer) en typografie (`headerSearchText`, `headerAccountLabel`, `headerCartAction`) via `header-footer-elements-section.tsx`. Storefront: full-width `.storefront-header-chrome` shell met `data-storefront-header-chrome-row` (inhoud in `.container.storefront-header-chrome__inner` > `.navbar-content`); CSS-vars in `@pagayo/design` `layout.css` + `cart.css`; client via `header-chrome-theme.ts` / `header-chrome-sticky.ts`.
  - Sectie **Header menu** (`selectedSection=headerLinks`): `new`, rij-`edit` en categorie-`import` blijven **inline in de rechterkolom**. `new` voegt eerst een concept-rij toe in dezelfde lijst; `edit` opent direct onder de aangeklikte rij; categorie-import gebruikt een inline preview/configuratieblok in plaats van een modal. Menubeperking: max. twee niveaus; diepere categorieën worden afgevlakt onder level-1-voorouder (server + preview tonen `flattened`).
  - Lijstregels in **Header menu** tonen naast type ook expliciet de linkmodus (`Open in a new tab` vs `Open in the same tab`), zodat gedrag zichtbaar blijft zonder de editor te openen.
  - Storefront header-pariteit: dezelfde 2-level navigatiehiërarchie moet op mobiel **en desktop** zichtbaar zijn. Als `navigation[i].children.length > 0`, renderen zowel SSR als client desktop `nav-dropdown` + `nav-dropdown-menu`; desktop mag niet terugvallen naar alleen root-links terwijl mobiel wel children toont.
  - Sectie **Typografie** (`selectedSection=typography`) blijft binnen dezelfde left-list/right-detail workspacegrammatica. Storefront-doelen worden opgeslagen in publieke JSON-setting `headerFooterTypography`; login-typografie blijft onder `loginUiSettings.typography`. Lege velden of een geresette kleur betekenen: theme/default styling behouden.
  - Typografie-doelen binnen één sectie-body gebruiken **bordered embedded subcards**: `products-workspace-subsection-card` + `products-workspace-subsection-card__title` + `products-workspace-subsection-card__body`. Gebruik dit alleen wanneer meerdere compacte instellingen anders visueel door elkaar gaan lopen; geen losse pagina-specifieke border-wrapper of inline border-styles.
  - Niet elke onderwerp-rij in de linker `WorkspaceRow` krijgt een actief/inactief-pill. Voor puur organisatorische configuraties zoals **Typografie** blijft de status leeg; toon alleen een pill als er echt een betekenisvolle active/inactive-state bestaat.

---

### CSS Classes Reference

| Class | Purpose |
|-------|---------|
| `.admin-page-header` | Header wrapper |
| `.admin-header-row` | Flex row: space-between |
| `.admin-header-left` | Left section with back + title (Pattern 2) |
| `.admin-header-actions` | Right-aligned action buttons |
| `.btn-back` | Back button styling |
| `.admin-tabs` | Tab navigation container |

### ⚠️ FORBIDDEN

```tsx
// ❌ NEVER use inline styles for layout
<div style={{ display: 'flex', justifyContent: 'space-between' }}>

// ❌ NEVER put back button in different positions
// Pattern 2: Back is ALWAYS left
// Pattern 1 & 3: NO back button

// ❌ NEVER mix patterns
// A list page should not have a back button
// A detail page MUST have a back button

// ❌ NEVER use generic titles like "Product bewerken" or "Edit Product"
<h1>Product bewerken</h1>  // NO!
<h1>{product.title}</h1>   // YES! Direct item name

// ❌ NEVER add subtitles in detail/edit page headers
<h1>Product bewerken</h1>
<p>Bewerk: {product.title}</p>  // NO! Redundant
```

### Title Rules

| Page Type | Title Format | Subtitel | Example |
|-----------|--------------|----------|---------|
| List | Plural noun | ❌ NOOIT | "Producten", "Bestellingen" |
| Detail/Edit (existing) | Direct item name | ❌ NOOIT | "Yoga Mat Pro", "Bestelling #12345" |
| Detail/Edit (new) | "Nieuw" + singular | ❌ NOOIT | "Nieuw product", "Nieuwe categorie" |

**VERBODEN:** `<p>` tags onder de `<h1>` in de header. Alleen titel, geen beschrijving.

---

## List Page Content Section (Pattern 1)

After the header, list pages have a standardized content section:

### Toolbar Structure

```
┌────────────────────────────────────────────────────────────────────┐
│ [🔍 Zoeken...]  [Filter ▼] [Filter ▼]           5 van 12 producten │
└────────────────────────────────────────────────────────────────────┘
```

**Layout:** Search LEFT, filters CENTER, count RIGHT

```tsx
<div className="admin-toolbar">
  <div className="admin-search">
    <SearchIcon />
    <input placeholder="Zoek..." value={searchQuery} onInput={...} />
  </div>
  <div className="admin-filter">
    <select>{/* filter options */}</select>
  </div>
  <div className="admin-toolbar-count">
    {filtered.length} van {total.length} items
  </div>
</div>
```

### Bulk Actions Bar

Appears when items are selected. Position: AFTER toolbar, BEFORE table.

Gebruik altijd design classes; inline styles zijn ook voor deze bar verboden.

```tsx
{selectedItems.size > 0 && (
  <div className="admin-bulk-actions">
    <span>{selectedItems.size} geselecteerd</span>
    <div className="admin-filter">
      <select onChange={handleBulkAction} title="Bulk acties">
        <option value="">Bulk acties...</option>
        {/* entity-specific options */}
      </select>
    </div>
  </div>
)}
```

**Bulk Options per Entity:**
| Entity | Bulk Options |
|--------|-------------|
| Products | Activeren, Archiveren, Verwijderen |
| Categories | Verwijderen |
| Blog Posts | Publiceren, Concept maken, Verwijderen |
| Pages | Publiceren, Concept maken, Verwijderen |
| Customers | Exporteren |
| Orders | (geen bulk acties) |

**VERBODEN:** Deselecteren knop. Gebruikers begrijpen dat checkbox opnieuw klikken deselecteert.

### Row Actions Order

**STANDAARD VOLGORDE:** View → Duplicate → Edit → Delete (Eye → Copy → Pencil → Trash)

```tsx
<ActionButtonGroup>
  <ActionButton action="view" onClick={...} />
  <ActionButton action="duplicate" onClick={...} />
  <ActionButton action="edit" onClick={...} />
  <ActionButton action="delete" onClick={...} />
</ActionButtonGroup>
```

**Actions per Entity:**
| Entity | Actions | Notes |
|--------|---------|-------|
| Products | view, duplicate, edit | delete via bulk only |
| Categories | view, edit, delete | no duplicate (uniek) |
| Blog | view, duplicate, edit, delete | all 4 |
| Pages | view, duplicate, edit, delete | all 4 |
| Customers | view, edit | no delete (archiveren), no duplicate |
| Orders | view only | immutable, pakbon/factuur links apart |

### Table Structure with Selection

```tsx
<table className="admin-table">
  <thead>
    <tr>
      <th style={{ width: '40px' }}>
        <input type="checkbox" onChange={toggleSelectAll} />
      </th>
      <th>Naam</th>
      <th>Status</th>
      {/* ... */}
      <th className="actions-column">Acties</th>
    </tr>
  </thead>
  <tbody>
    {items.map(item => (
      <tr key={item.id}>
        <td>
          <input
            type="checkbox"
            checked={selected.has(item.id)}
            onChange={() => toggle(item.id)}
            onClick={e => e.stopPropagation()}
          />
        </td>
        {/* ... */}
        <td>
          <ActionButtonGroup>...</ActionButtonGroup>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**KRITIEK:** Checkbox onClick MOET `e.stopPropagation()` hebben om row click niet te triggeren.

---

## Checklist: Before Creating a New Page

1. ☐ What type is this page? (List / Detail-Edit / Tabbed)
2. ☐ Use the correct pattern from above
3. ☐ Use CSS classes, NOT inline styles
4. ☐ Back button in correct position (or absent)
5. ☐ Actions in `admin-header-actions`
6. ☐ GEEN subtitel onder de h1
7. ☐ List pages: bulk actions aanwezig
8. ☐ Row actions in juiste volgorde: View → Duplicate → Edit → Delete

---

**Remember:** Consistency is more important than perfection. When in doubt, check existing components for patterns.

---

## i18n — VERPLICHT

**NOOIT hardcoded strings in UI componenten. Altijd het i18n-systeem gebruiken.**

### Gebruik

```tsx
import { useI18n } from '../../i18n';

const { t, locale, setLocale } = useI18n();

// In JSX
<h1>{t('products.title')}</h1>
<p>{t('common.welcome', { name: 'Sjoerd' })}</p>
```

### Regels

| Regel | Voorbeeld |
|-------|----------|
| Nieuwe key? Toevoegen aan EN + NL + DE | Alle 3 talen in dezelfde actie |
| Key naming | `namespace.section.key` (bijv. `orders.status.pending`) |
| Placeholders | `{variableName}` syntax |
| Engels is master | Altijd compleet, NL/DE vallen terug op EN |
| Check bestaande keys | Hergebruik waar mogelijk |

### Bestandslocaties

```
src/client/i18n/
├── index.tsx                # Core: I18nProvider, useI18n(), translate()
└── locales/
    ├── en/                  # Engels (MASTER)
    │   ├── common.json      # Buttons, labels, states
    │   ├── admin.json       # Nav, dashboard, tips
    │   ├── orders.json      # Statussen, filters, acties
    │   ├── products.json    # Product management
    │   └── ...              # 12 namespaces totaal
    ├── nl/                  # Nederlands (zelfde structuur)
    └── de/                  # Duits (zelfde structuur)
```

### VERBODEN

```tsx
// ❌ NOOIT hardcoded tekst
<h1>Producten</h1>
<button>Opslaan</button>
<p>Geen resultaten gevonden</p>

// ✅ ALTIJD via i18n
<h1>{t('products.title')}</h1>
<button>{t('common.save')}</button>
<p>{t('common.noResults')}</p>
```
