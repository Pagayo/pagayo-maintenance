/**
 * ============================================================
 * SHARED ADMIN COMPONENTS
 * Herbruikbare componenten voor consistente admin UI
 * ============================================================
 *
 * CONSISTENTIE REGELS - VERPLICHT BIJ NIEUWE ADMIN PAGINA'S:
 *
 * 1. LIJSTPAGINA'S (Blog, Pagina's, Producten, etc.):
 *    - Gebruik `admin-toolbar` class voor zoeken/filteren
 *    - Zoekbalk: `admin-search` + `admin-search-input`
 *    - Filters: `form-select` (NIET admin-filter-select!)
 *    - Teller: `admin-toolbar-count` ("X van Y items")
 *    - Acties kolom header: `<th className="actions-column">Acties</th>`
 *    - Acties buttons: `<div className="action-buttons">` wrapper
 *    - Button volgorde: Preview (👁) → Bewerken → Verwijderen
 *    - Button classes: `btn btn-secondary btn-sm` of `btn btn-danger btn-sm`
 *
 * 2. EDIT PAGINA'S:
 *    - Formulier knoppen: Annuleren links, Opslaan rechts
 *
 * 3. TEKST TAALREGELS:
 *    - Geen Engelse termen (slug → webadres, excerpt → samenvatting)
 *    - Start met werkwoord ("Pas aan", "Bekijk", "Voeg toe")
 *    - Max 8 woorden per bullet point
 *    - Test: "Snapt mijn moeder dit?"
 *
 * 4. STYLING:
 *    - Alle CSS via @pagayo/design tokens (--accent, --bg-surface, etc.)
 *    - Geen hardcoded kleuren of spacing
 *    - Zie DESIGN.md voor volledige token referentie
 *
 * ============================================================
 */

export { AdminFormActions } from "./AdminFormActions";
export { AdminListActions } from "./AdminListActions";
export { AdminToolbar } from "./AdminToolbar";
export { AdminAlert } from "./AdminAlert";
export { AdminEmptyState } from "./AdminEmptyState";
export { PolicyBanner } from "./PolicyBanner";
export { AnnouncementBanner } from "./AnnouncementBanner";
export { LimitIndicator } from "./LimitIndicator";
export { ListActions } from "./ListActions";
export type { ListAction } from "./ListActions";
export {
  Pagination,
  ADMIN_PAGE_SIZE,
  ADMIN_PAGINATION_WINDOW_SIZE,
  getVisiblePageNumbers,
  paginateItems,
} from "./Pagination";
export { ImageUploadField } from "./ImageUploadField";
export { SettingsGalleryUploadPanel } from "./SettingsGalleryUploadPanel";
export type { SettingsGalleryItem } from "./SettingsGalleryUploadPanel";
export {
  WorkspaceToolbar,
  WorkspaceToolbarLeft,
  WorkspaceToolbarRight,
  WorkspaceToolbarAction,
  WorkspaceToolbarActionGroup,
  WorkspaceToolbarSelect,
  WorkspaceToolbarDateInput,
} from "./WorkspaceToolbar";
export { WorkspaceToolbarListCount } from "./WorkspaceToolbarListCount";
export type { WorkspaceToolbarListCountProps } from "./WorkspaceToolbarListCount";
export { WorkspaceListPanel } from "./WorkspaceListPanel";
export type { WorkspaceFilterChip, WorkspaceFilterOption } from "./WorkspaceListPanel";
export { WorkspaceFilterToggleButton } from "./WorkspaceListPanel";
export { WorkspaceSearchInput } from "./WorkspaceSearchInput";
export type { WorkspaceSearchInputProps } from "./WorkspaceSearchInput";
export { WorkspaceRow } from "./WorkspaceRow";
export { WorkspaceValidityBar } from "./WorkspaceValidityBar";
export type { WorkspaceValidityBarProps } from "./WorkspaceValidityBar";
export { WorkspaceSummaryGrid } from "./WorkspaceSummaryGrid";
export type {
  WorkspaceSummaryField,
  WorkspaceSummaryGridProps,
} from "./WorkspaceSummaryGrid";
export { AdminRichContentEditor } from "./AdminRichContentEditor";
export { AdminEnabledSwitch } from "./AdminEnabledSwitch";
export type { AdminEnabledSwitchProps } from "./AdminEnabledSwitch";
export { WorkspaceDescriptionEditor } from "./WorkspaceDescriptionEditor";
export { EditorHintIcon } from "./EditorHintIcon";
export type { EditorHintIconProps, EditorHintIconTone } from "./EditorHintIcon";
export { EditorLabelWithHint } from "./EditorLabelWithHint";
export type { EditorLabelIconTone, EditorLabelWithHintProps } from "./EditorLabelWithHint";
export { AdminGlobalToolbar } from "./AdminGlobalToolbar";

export { WorkspaceCommandCenter, WorkspaceCommandOption, WorkspaceCommandField, WorkspaceCommandSelect } from "./WorkspaceCommandCenter";
