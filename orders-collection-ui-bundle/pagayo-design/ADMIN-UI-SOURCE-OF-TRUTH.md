# Admin UI Source of Truth

Status: active
Datum: 2026-04-05
Eigenaar: Pagayo Frontend/Design

## Doel

Dit document is de centrale bron voor admin list/workspace UI-beslissingen.
Bij conflict met oudere documentatie geldt dit document.

## Canonieke Baseline

De huidige Products workspace is de baseline voor de hele admin list/workspace taal:

- Toolbar boven content (import, export, delete, add + overige acties)
- Linkerkolom: filters, search, lijst en row-inhoud
- Rechterkolom: hero + content secties
- Rechterkolom secties: title/slug/sku/description, settings, media

Uitzondering:

- Variant matrix valt buiten deze baseline en wordt apart beheerd.
- Variant matrix in Products workspace moet visueel aansluiten op de settings-schaal (compacte controls en compacte typografie).
- Embedded variant matrix regels:
	- Geen dubbele interne sectietitel "Variant options" onder de bestaande header "Variant matrix".
	- Geen extra wrapper-border rond het option-input blok; de sectie zelf is al de container.
	- Geen extra bottom border onder variant matrix sectie in de workspace.

## Runtime Shell Baseline (Admin)

- De huidige admin shell is sidebar-first: `.admin-shell` met links `aside.admin-account-nav` en rechts `main.admin-main`.
- Er is geen actieve topnavbar in de runtime shell; layout start op `top: 0`.
- `admin-shell` gebruikt geen `--main-nav-height` compensatie meer voor hoogte of margin.
- Workspace-lock pagina's (zoals Products) gebruiken volledige viewporthoogte (`100dvh`) zonder navbar subtractie.
- Sidebar-footer contract:
	- Pagayo-brand links onderin via **`PagayoAdminWordmark`** (`placement="sidebar-brand"`) — storefront: `pagayo-storefront/src/client/components/common/PagayoAdminWordmark.tsx`; CSS: `main-nav.css` + `account-navigation.css`. Geen losse `<span class="logo-p">` markup in pagina’s.
	- Mode/menu-switch actie rechts onderin.
	- Switch is direct (geen popup/dropdown-interactie).

## Brand wordmark (tekst “Pagayo.”)

| Laag | SSoT |
|------|------|
| Markup (client) | `PagayoAdminWordmark` in `pagayo-storefront/src/client/components/common/PagayoAdminWordmark.tsx` |
| Placements | `sidebar-brand`, `navbar`, `pos-footer` — zie component JSDoc |
| Styling | `.main-nav__logo`, `.logo-p`, `.logo-dot` in `pagayo-design/src/components/navigation/main-nav.css` |
| Documentatie | `pagayo-storefront/src/client/DESIGN.md` (sectie Pagayo brand wordmark) |

Nieuwe admin-, POS- of balie-footers: component importeren; classes niet dupliceren.

## Maatvoering Baseline (Products Workspace)

- Alle admin tekst loopt via het centrale token `--admin-font-size-base` en resolveert naar 13px.
- Toolbar pill actions: 28px hoogte
- Toolbar select/date: 28px hoogte
- Search wrapper links: 34px hoogte
- Filter dropdown buttons links: 30px hoogte
- Toolbar-controls centreren tekst verticaal via flex-alignment; gebruik geen line-height-centering als primair patroon.
- Rechterkolom compacte veldcontrols: 32px hoogte
- Lijst/body typografie: 13px
- Meta/sectie labels: 13px uppercase
- Variantmatrix headings binnen cards: 13px

### Workspace formulierstack (detailkolom)

- Onder een vaste sectietitel (`products-workspace-section__title`) worden veldblokken in **`products-workspace-section__body`** gestapeld.
- **Verticale afstand tussen veldblokken** (tussen het onderste control van veld *n* en het label van veld *n+1*): `gap: var(--admin-form-field-gap)` op die body — hetzelfde token en patroon als **`products-workspace-form-block`** (nu ca. 12px via `--admin-form-field-gap`).
- **Binnen één veldblok** (`products-editor-field`): label en control staan in een kolom met `gap: var(--space-2)` tussen `.products-editor-label` en het veld; dat is het interne label→control ritme, niet het ritme tussen opeenvolgende velden.
- **Textarea in workspace**: markup `form-textarea` + `products-workspace-field`. Visueel gelijk aan single-line `form-input` + `products-workspace-field` (zelfde border-, radius- en focus-tokens); geen browser-default textarea-kader. Meerregelige hoogte via `min-height` op tokenbasis, `height: auto`, `resize: vertical` waar bewerkbaar.

### Form control recipes (gedrag, geen parallel visueel pad)

**Principe:** visueel = **`forms/_workspace-field.css`** via `form-select` / `form-input` + **`products-workspace-field`**. Gedrag (content-sized vs full-width) = modifier **`products-workspace-field--fill`**. Geen losse pixel-tokens per dropdown-breedte.

| Recipe | Markup | Visueel SSoT | Gedrag |
|--------|--------|--------------|--------|
| **Workspace select** | `form-select products-workspace-field` | `_workspace-field.css` (border, chevron, padding-right) | Content-sized (`field-sizing: content` in `products.css`) |
| **Workspace select (full row)** | `form-select products-workspace-field products-workspace-field--fill` | idem | Alleen bewuste full-width (zeldzaam voor enum/select) |
| **Workspace text input** | `form-input products-workspace-field` | idem | Content-sized default |
| **Workspace text input (full row)** | `form-input products-workspace-field products-workspace-field--fill` | idem | Lange URL, zoek in detail, bewuste full-width |
| **Workspace textarea / rich** | `form-textarea products-workspace-field` of rich editor SSoT | idem | Altijd full-width |
| **Color mode row** | `products-workspace-typography-color-row` + `products-workspace-field` select + `products-workspace-field--color` | compact swatch in design CSS | Mode + swatch naast elkaar |

**MUST NOT:** nieuwe parallelle classes (`products-workspace-select`, etc.) die `_workspace-field.css` omzeilen. **MUST NOT:** `products-workspace-field--fill` op standaard enum/dropdown-keuzes.

Zie ook `pagayo-storefront/docs/adr/0003-admin-composition-and-design-contract.md` § Form control recipes.

### Block-edit panel tiles (modal editor tabs)

**Wanneer:** `BlockEditModal` tabs (Design, Typography, …) met **2–4 onderwerpen naast elkaar** in witte tegels.

| Recipe | Markup | CSS / component |
|--------|--------|-----------------|
| **Tile grid (2 kolommen)** | `block-edit-modal__typography-groups` | Default 50/50 + `max-width: 48rem` (Typography Headings \| Body) |
| **Tile grid (2 kolommen, 1/3 + 2/3)** | `… block-edit-modal__typography-groups--cols-2-one-third-two-thirds` | `BlockDesignGroups columns={2} columnWeights="one-third-two-thirds"` — Layout smal, Design breed met inner sub-kolommen |
| **Sub-kolommen in één tegel** | `BlockDesignSection fieldsColumns={2}` + `BlockDesignSectionColumn` | Altijd combineren met `columnWeights="one-third-two-thirds"` op de parent group |
| **Tile grid (3 kolommen)** | `… block-edit-modal__typography-groups--cols-3` | Block Design (Layout \| Tiles \| Overlay) |
| **Tile grid (4 kolommen)** | `… block-edit-modal__typography-groups--cols-4` | Zeldzaam; zelfde responsive collapse |
| **Enkele tegel** | `block-edit-modal__typography-group` + `products-workspace-section__title` + `__group-fields` | Zelfde oranje titelstrip als orders/products workspace |
| **Storefront wrapper** | `BlockDesignGroups` (`columns={2\|3\|4}`) + `BlockDesignSection` (`fieldsColumns={2}` optioneel) + `BlockDesignSectionColumn` | `blocks/shared/BlockDesignSection.tsx` |
| **Veld-hint (tegel)** | `EditorLabelWithHint` + `iconTone="information"` | Geel `Info`; tooltip onder icoon in tegels |

**SSoT CSS:** `src/contexts/admin/block-edit-typography.css` (+ hint tooltip overflow in `products.css`).

**MUST NOT:** grijze tegelachtergrond; altijd 3 kolommen; `form-hint` onder velden waar label-info bedoeld is; parallelle tile-shell buiten bovenstaande classes.

### Media role badge (SSoT)

**Wanneer:** primaire rol op een media/thumbnail-preview (product gallery **MAIN**, shopblok **default** / **copy**).

| Recipe | Markup | Label (i18n) |
|--------|--------|----------------|
| **Role pill** | `products-workspace-role-badge` + positioner (`products-workspace-gallery-hero__badge`, `products-workspace-gallery-item__badge`, `block-library-card__badge`) | `products.workspace.gallery.mainBadge` · `admin.contentBlocks.library.badgeDefault` · `admin.contentBlocks.library.badgeCopy` |

**Visueel:** accent-blauwe pill, witte uppercase tekst (`10px`, `--admin-radius-pill`) — gedefinieerd alleen op `.products-workspace-role-badge` in `products.css`.

**SSoT CSS:** `pagayo-design/src/contexts/admin/products.css` (`.products-workspace-role-badge`).

**MUST NOT:** aparte kleurvarianten per rol (`--default` / `--copy` / grijs); parallelle badge-classes buiten bovenstaande positioners.

### Block content preview frame (SSoT)

**Wanneer:** visuele preview van block-inhoud in **BlockEditModal** sidebar én **block library grid** instance-kaarten (zelfde snapshot-logica).

| Recipe | Markup | Variant |
|--------|--------|---------|
| **Preview frame** | `BlockContentPreviewFrame` → `.block-content-preview` + `--modal` / `--library-card` | Modal sidebar, library grid, homepage layout stack (zelfde `--library-card` variant) |
| **Afbeelding** | `AdminR2Image` `variant="display"` + `.block-content-preview__image` | Hero, slider (slide 0), category banners (item 0), banner, image_text |
| **Fallback** | `.block-content-preview__fallback` + `BlockIllustration` `block-illustration--card` | Geen image; grid: edge-to-edge bleed + `clip-path` top/bottom (geen PAGE-outline lijnen) |
| **Overlay** | `.block-content-preview__overlay*` | Titel, ondertitel, CTA zoals storefront |

**SSoT logica:** `getBlockEditPreviewSnapshot` / `getBlockLibraryPreviewSnapshot` (`block-edit-preview.ts`); config-parse: `buildBlockEditPreviewInputFromStoredConfig` (`block-library-preview-config.ts`).

**SSoT CSS:** `products.css` (`.block-content-preview*`).

**MUST NOT:** aparte preview-markup in modal vs grid; legacy `.block-edit-modal__preview-*` classes.

### Block library grid card footer actions (SSoT)

**Wanneer:** instance-kaarten in de block library grid (**default** / **copy**).

| Rol | Actie | Component | Intent |
|-----|-------|-----------|--------|
| **default** | Dupliceren (links) | `WorkspaceToolbarAction` in `products-workspace-inline-actions` | `duplicate` (default tone — zelfde pill als **Create**) |
| **copy** | Verwijderen (rechts) | `WorkspaceToolbarAction` in `products-workspace-inline-actions` | `delete` (danger tone — standaard admin delete) |

**Markup:** `block-library-card__footer` + `products-workspace-inline-actions block-library-card__actions` — geen `btn btn--*` varianten.

**SSoT CSS:** `products.css` (footer alignment alleen); knopvisueel = `.products-workspace-toolbar__action` (+ `--danger` via intent).

**MUST NOT:** `btn--secondary`, `btn--destructive`, `btn--sm` of andere webshop/modal button-classes op admin workspace-acties; geen ad-hoc pill-styling.

### Block-edit Content tab (modal editor)

**Referentie:** `CategoryBannersBlockEditor` in `pagayo-storefront` — alle block Content-tabs volgen deze grammar.

| Recipe | Markup / component |
|--------|------------------|
| **Content root** | `BlockEditContentEditor` |
| **Item tabs** | `BlockEditItemNav` + `BlockEditItemTab` (`reports-section-nav__button`) |
| **Tegelgrid** | `BlockDesignGroups` + `BlockDesignSection` (meestal 3 kolommen: image \| texts \| button) |
| **Compact upload** | `SettingsGalleryUploadPanel` met `layout="compact"` |
| **Hint op label** | `EditorLabelWithHint` + `iconTone="information"` |
| **Footer** | `BlockEditContentFooter` + `products-workspace-inline-actions` (geen `form-actions` border) |

**SSoT CSS:** `src/contexts/admin/products.css` (`.block-edit-content-editor`).

**MUST NOT:** `products-workspace-section` + `products-workspace-form-grid` in block-edit Content-tab waar tile-grammar geldt.

## Verplichte Implementatieregels

- Gebruik bestaande products-workspace classes/tokens als referentie bij nieuwe list/workspace pagina's.
- Workspace toolbar-acties worden technisch afgedwongen via `WorkspaceToolbarAction` met intent-contract; geen page-specifieke losse class-combinaties voor actieknoppen. Geldt voor **alle** admin actieknoppen: pagina-toolbar, modal-footer, inline editors, **en** card-footers (bijv. block library grid). Gebruik nooit `btn btn--secondary` / `btn--destructive` waar `WorkspaceToolbarAction` bedoeld is. Producten-workspace: intent `bulkEdit` opent bulk-bewerken onder de toolbar (`products-bulk-edit-panel*`).
- Workspacepagina's kiezen acties declaratief via `WorkspaceToolbarActionGroup`; de centrale order bepaalt positie/volgorde, niet lokale knop-volgorde in pagina-JSX.
- Admin-typografie gebruikt één size-token: onderscheid komt uit weight, style, casing en kleur, niet uit font-size-variatie.
- Voeg geen nieuwe maatvarianten toe zonder update van dit document.
- Geen inline styles voor layout/spacing/typografie in admin componenten.
- Geen hardcoded maten als token of bestaande baseline class al bestaat.
- Introduceer geen nieuwe navbar-offsets (`margin-top`, `top`, `calc(100dvh - var(--main-nav-height))`) in admin shell/workspace-layouts.

### Workspace Toolbar Action Contract

- Markup voor workspace-acties: `WorkspaceToolbarAction` (shared component).
- **Icon-only acties** (`iconOnly` + Lucide-root als enige child van de knop): visuele maat en vierkante pill komen uit `pagayo-design` (`--admin-toolbar-inline-icon-size`, selectors op `.products-workspace-toolbar__action:has(> svg:only-child)` in `products.css`). Geen per-pagina `size`/`strokeWidth` voor deze toolbar — anders drift je weer van de baseline af.
- Declaratieve laadlaag: `WorkspaceToolbarActionGroup` (pagina geeft alleen benodigde acties op).
- `save` wordt alleen gerenderd wanneer de workspace in een expliciete bewerkbare state zit: create-mode of een geselecteerd detail dat direct bewerkbaar is.
- Geen disabled `save` placeholder tonen wanneer er nog geen actieve create/edit-context is.
- Intent bepaalt visuele variant centraal:
	- `delete` => danger (rode outline-pill; zelfde familie overal in admin)
	- `save` => primary
	- `new`, `duplicate`, `import`, `export` en overige standaardacties => default (witte outline-pill zoals **Create**)
- Delete-visual wordt extra hard afgedwongen via `data-workspace-action-intent='delete'`; ook disabled blijft delete visueel in dezelfde rode familie.
- Labelconventie voor toolbar-acties blijft kort en generiek:
	- `new` toont altijd **New** (geen domeinspecifieke varianten zoals "New role").
	- In create-mode gebruikt de primaire actie een domeinspecifiek create-label (bijv. "Create"), niet het standaard save-label.

### Autosave and Create Contract

- Bestaande records in edit/view-workspace volgen admin autosave-gedrag als primaire persist-strategie.
- Create-mode is expliciet geen autosave-flow:
	- Nieuwe records bewaren pas na een expliciete create-actie.
	- Create-formulier blijft in rechterkolom en gebruikt de primaire toolbar-actie voor create.
- Samengevat:
	- **Edit bestaand**: autosave.
	- **Create nieuw**: expliciet create-commando.
- Deze regel geldt voor workspace-entiteiten zoals staff en roles, naast bestaande products-achtige workspaces.
- **HeaderFooterPage / Header menu** (`selectedSection=headerLinks`) is de expliciete config-page uitzondering: bestaande items openen inline onder de aangeklikte rij, `new` voegt eerst een concept-rij in dezelfde lijst toe en categorie-import blijft eveneens inline in de rechterkolom. Geen modal/popup voor edit/create/import in dit paneel.

## Content-area Contract (Products detailzijde)

- Workspace content gebruikt een vaste 2-kolomshell: links list card, rechts detail card binnen `products-master-detail`.
- Detailpanelen volgen dezelfde basisvolgorde: hero eerst, daarna summary/overview, daarna domeinsecties/modules.
- Inhoudssecties gebruiken de products section-taal (`products-workspace-section*`) en niet een pagina-eigen parallel card-hiërarchie.
- Collapsible headers blijven uniform: 1 regel, label links, plus/min rechts, zonder extra interne titel direct eronder.
- Expanded collapsible body start zonder extra divider-lijn direct onder de header (geen extra border-top tussen header en body).
- Expanded body-typografie volgt de products body-schaal: waarden en numerieke cells op `--admin-products-list-font` (13px).
- Verschillende functionaliteiten binnen dezelfde collapsible body worden verticaal als aparte modules gestapeld; geen side-by-side function blocks in de detailkolom.
- Collapsible default-state na harde refresh is dicht (`false`), tenzij een expliciete SSoT-uitzondering per pagina anders definieert.
- Loading/error/empty states in detail of lijst gebruiken de bestaande pane-state patronen; geen losse ad-hoc state-layouts.
- Domeinfeatures mogen inhoudelijk verschillen, maar niet van de visuele contentgrammatica afwijken.
- Voor `HeaderFooterPage`-rijen in het rechterpaneel geldt: rij-acties gebruiken dezelfde action-tokens als workspaces (geen losse ad-hoc icon-strip), en de rij toont ook niet-edit state zoals linktype en `new tab`/`same tab`.

### Settings Checkbox Chips (Products detailzijde)

Naamgeving voor dit patroon (zoals bij Sales channels en Featured):

- **Checkbox chips**

Contract:

- Markup: `label.form-checkbox-wrapper.products-workspace-checkbox-chip > input.form-checkbox + span.form-checkbox-label`
- Binnen `products-workspace-controls-grid` renderen checkbox chips als compacte pill/chip controls.
- Visuele baseline: inline uitlijning, minimale hoogte 28px, horizontale chip-padding, subtiele border en afgeronde hoeken.
- Typografie van chip-labels volgt de detailzijde-token `--admin-workspace-detail-font` (13px schaal).
- Gebruik hiervoor de bestaande Products selectorfamilie rond `.products-workspace-checkbox-chip`, geen parallel toggle-pattern introduceren.
- **Chip + veld op één regel** (bijv. homepage hero titel/subtitel): container `.products-workspace-chip-field-rows` met als directe kinderen afwisselend chip en `input.form-input.products-workspace-field` (2×2 grid). Geen losse `form-row-flex` + `flex-1` per pagina; chips en inputs op `--admin-control-field` hoogte, rijafstand `--admin-form-field-gap`, kolom 2 even breed.

## Scroll Contract (Workspace)

- Beide kolommen scrollen onafhankelijk: list card en detail card hebben elk een eigen verticale scroll.
- Scroll mag niet op de volledige pagina terugvallen bij workspace-routes; viewport-lock + card-scroll is leidend.
- Shell-keten moet `min-height: 0` doorgeven (page -> grid -> kolom -> card) zodat card-scroll technisch kan werken.
- Vermijd class-mix met andere paginafamilies als die `overflow` of `min-height` contracts van products-cards overrulen.

### Mutation Scroll Contract (Workspace)

- Background refresh (autosave, list refetch, image/variant mutatie) **unmountt** de detailkaart niet: geen full-pane spinner als er al content gemount is.
- Form state hydrate **alleen** bij selectie-wissel (`mode` / `id`), niet bij elke list-patch — gebruik `useWorkspaceFormHydration` in storefront.
- Na mutaties die layout kunnen verschuiven: `withPreservedWorkspaceDetailScroll` op `.products-detail-card`.
- Autosave `saveFn` roept geen full `refetch()` aan die form state reset; patch list + detail in-place (Products/Announcements-pariteit).

## List Selection Contract (Workspace)

- Lijstselectie volgt Products-gedrag: shift-click range selectie met consistente selected-state op rows.
- Actieve detailselectie en multi-selectie mogen tegelijk bestaan (active row + selected set), maar blijven deterministisch.
- Bij filter/search/paginatie worden geselecteerde ids die niet meer zichtbaar zijn opgeschoond.
- Selected count wordt zichtbaar gemaakt waar de pagina selectiestatus functioneel inzet.

## Products Workspace Collapsible Header (SSoT)

- Header bestaat uit exact 1 regel met label links en plus/min rechts.
- Labelstijl: 13px uppercase, letter-spacing 0.04em, muted color (zelfde als settings labels).
- Geen extra interne titel direct onder de sectieheader (geen dubbele titels).
- Expanded body begint zonder extra scheidslijn onder de header voor variant matrix.
- Variant matrix-sectie heeft geen extra bottom border in de workspace flow.

## Canonieke Selectors (Products)

- `.products-workspace-toolbar__action`
- `.products-workspace-toolbar__action--danger`
- `.products-workspace-toolbar__action--primary`
- `.products-workspace-toolbar__select`
- `.products-workspace-toolbar__date`
- `.products-search-input-wrapper`
- `.products-control-dropdown-btn`
- `.products-workspace-field` (workspace control SSoT — visueel via `_workspace-field.css`; content-sized default; opt-in full width via `.products-workspace-field--fill`)
- `.date-time-input` (workspace pair; segments content-sized; opt-in `.date-time-input--fill`)
- `--admin-control-inline-padding` (12px — shared horizontal inset for inline controls)
- `.product-workspace-row__title`
- `.product-workspace-row__price`
- `.products-workspace-section__title`
- `.products-editor-label`
- `.products-workspace-hero`
- `.products-workspace-summary-grid`
- `.products-workspace-section`
- `.products-workspace-collapsible-header`
- `.products-detail-card`
- `.block-edit-modal__typography-groups` / `--cols-3` / `--cols-4` (panel tile grid in modal tabs)
- `.block-edit-modal__typography-group` (single white panel tile — block-edit Design/Typography)

## Upload image variants (thumbnails)

R2-afbeeldingen onder `/uploads/*` hebben vaste breedte-varianten: `{baseKey}-{width}.{ext}` (origineel = `{baseKey}.{ext}`).

| Regel | Detail |
|-------|--------|
| **Weergave** | Lijst-, grid- en thumb-`<img>` in admin/POS/webshop gebruiken `buildR2ImageVariantThumbSrcSet` (of `AdminR2Image` met `variant="thumb"`). Nooit het volledige origineel als default `src` voor kleine UI. |
| **Hero / display** | Grotere preview: `buildR2ImageVariantSrcSet` of `AdminR2Image` met `variant="display"`. `onError` → fallback naar origineel (`toUploadUrl`). |
| **Upload** | Bij elke nieuwe upload naar R2 worden `PRODUCT_IMAGE_VARIANT_WIDTHS` (of domein-specifieke subset uit `src/lib/images/image-variant-widths.ts`) gegenereerd — server-side best-effort; gallery-upload zonder varianten is niet af. |
| **Breedtes SSoT** | `pagayo-storefront/src/lib/images/image-variant-widths.ts` |
| **Backfill** | Bestaande assets: `pagayo-storefront/scripts/backfill-upload-image-variants.ts` |
| **Component** | `pagayo-storefront/src/client/components/admin/shared/AdminR2Image.tsx` |

## Rollout

1. Nieuwe list/workspace pagina's: direct deze baseline toepassen.
2. Bestaande admin pagina's: gefaseerd migreren naar dezelfde control heights, typography en spacing.
3. Documentatie in storefront moet naar dit document verwijzen als design bron.
