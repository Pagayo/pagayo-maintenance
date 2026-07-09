/** @jsxImportSource preact */

import { ComponentChildren, FunctionalComponent, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { ChevronDown, ChevronUp, Package, XCircle } from 'lucide-react';
import { Spinner } from '../../../components/Spinner';
import { WorkspaceSearchInput } from './WorkspaceSearchInput';

export interface WorkspaceFilterOption {
  key: string;
  label: string;
}

export interface WorkspaceFilterChip {
  key: string;
  label: string;
  group?: string;
}

export interface WorkspaceSortOption {
  key: string;
  label: string;
}

export interface WorkspaceListPanelProps {
  count: number;
  loading: boolean;
  error: string | null;
  loadingText: string;
  children: ComponentChildren;
  searchValue: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchInputId: string;
  filterLabel: string;
  filterGroupLabel: string;
  filters: WorkspaceFilterOption[];
  activeFilterKeys: Set<string>;
  onSearchChange: (value: string) => void;
  onToggleFilter: (key: string) => void;
  /** Optional second chip row inside the search/filter dropdown (e.g. print next to lifecycle). */
  secondaryFilters?: WorkspaceFilterOption[];
  activeSecondaryFilterKeys?: Set<string>;
  onToggleSecondaryFilter?: (key: string) => void;
  secondaryFilterLabel?: string;
  className?: string;
  emptyText: string;
  noResultsText?: string;
  hasActiveCriteria?: boolean;
  filterMode?: 'dropdown' | 'chips';
  filterChips?: WorkspaceFilterChip[];
  activeChipKeys?: Set<string>;
  onToggleChip?: (key: string) => void;
  sortOptions?: WorkspaceSortOption[];
  activeSortKey?: string;
  onSortChange?: (key: string) => void;
  countLabel?: string;
  /** Zoekveld in dropdown (default) of vast in de header. */
  searchPlacement?: 'dropdown' | 'inline';
  /** Status-/printfilters in dropdown-paneel of als vaste chiprij (`filterMode="chips"`). */
  filterPlacement?: 'dropdown' | 'inline';
  /** Verberg de ingebouwde lijst-controls wanneer een bovenliggende Workspace V3 de tools overneemt. */
  controlsVisibility?: 'visible' | 'hidden';
}

interface WorkspaceFilterToggleButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'children' | 'type'> {
  children: ComponentChildren;
  intent: string;
  isActive?: boolean;
}

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

/**
 * WorkspaceFilterToggleButton
 * Gedeelde dropdown-toggle knop voor workspace filters/search met vaste styling.
 */
export const WorkspaceFilterToggleButton: FunctionalComponent<WorkspaceFilterToggleButtonProps> = ({
  intent,
  isActive = false,
  className,
  children,
  ...buttonProps
}) => {
  return (
    <button
      type="button"
      className={joinClasses('products-control-dropdown-btn', isActive ? 'active' : '', className)}
      data-workspace-filter-intent={intent}
      {...buttonProps}
    >
      {children}
    </button>
  );
};

/**
 * WorkspaceListPanel
 * Standaard links-paneel met filter- en zoekdropdowns voor admin workspaces.
 */
export const WorkspaceListPanel: FunctionalComponent<WorkspaceListPanelProps> = ({
  count,
  loading,
  error,
  loadingText,
  children,
  searchValue,
  searchLabel,
  searchPlaceholder,
  searchInputId,
  filterLabel,
  filterGroupLabel: _filterGroupLabel,
  filters,
  activeFilterKeys,
  onSearchChange,
  onToggleFilter,
  secondaryFilters,
  activeSecondaryFilterKeys,
  onToggleSecondaryFilter,
  secondaryFilterLabel,
  className,
  emptyText,
  noResultsText,
  hasActiveCriteria = false,
  filterMode,
  filterChips,
  activeChipKeys,
  onToggleChip,
  sortOptions,
  activeSortKey,
  onSortChange,
  countLabel: _countLabel,
  searchPlacement = 'dropdown',
  filterPlacement = 'dropdown',
  controlsVisibility = 'visible',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasFilters = filters.length > 0;
  const hasSecondaryFilters = Boolean(secondaryFilters && secondaryFilters.length > 0);
  const emptyMessage = hasActiveCriteria && noResultsText ? noResultsText : emptyText;

  const searchInDropdown = searchPlacement === 'dropdown';
  const filtersInDropdown = filterPlacement === 'dropdown';
  const showFilterToggle = searchInDropdown || (filtersInDropdown && (hasFilters || hasSecondaryFilters));
  const toggleLabel = searchInDropdown ? searchLabel : (filterLabel || searchLabel);
  const panelHasSearch = searchInDropdown;
  const panelHasFilters = filtersInDropdown && (hasFilters || hasSecondaryFilters);

  const inlineSearch = !searchInDropdown && (
    <WorkspaceSearchInput
      id={searchInputId}
      value={searchValue}
      placeholder={searchPlaceholder}
      onInput={onSearchChange}
    />
  );

  return (
    <section className={joinClasses('products-card products-list-card', className)}>
      {controlsVisibility === 'visible' ? (
      <div className="products-card-header products-card-header--controls">
        <div className={joinClasses(
          'products-list-controls-row',
          searchPlacement === 'inline' ? 'products-list-controls-row--with-inline-search' : undefined,
        )}
        >
          {searchPlacement === 'inline' ? inlineSearch : null}
          {showFilterToggle && (
            <WorkspaceFilterToggleButton
              intent="search"
              isActive={isOpen}
              onClick={() => setIsOpen((prev) => !prev)}
            >
              {toggleLabel}
              {isOpen
                ? <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
                : <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
              }
            </WorkspaceFilterToggleButton>
          )}
        </div>
      </div>
      ) : null}

      {controlsVisibility === 'visible' && isOpen && (panelHasSearch || panelHasFilters) && (
        <div className="products-control-dropdown-panel">
          {panelHasSearch && (
            <WorkspaceSearchInput
              id={searchInputId}
              value={searchValue}
              placeholder={searchPlaceholder}
              onInput={onSearchChange}
              inlineHeader={false}
            />
          )}
          {panelHasFilters && hasFilters && (
            <div className="products-filter-chips products-filter-chips--panel">
              {filterLabel && (
                <span className="products-filter-chips-label">{filterLabel}</span>
              )}
              {filters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={joinClasses('workspace-filter-chip', activeFilterKeys.has(filter.key) ? 'workspace-filter-chip--active' : undefined)}
                  onClick={() => onToggleFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
          {panelHasFilters && hasSecondaryFilters && secondaryFilters && onToggleSecondaryFilter && activeSecondaryFilterKeys && (
            <div className="products-filter-chips products-filter-chips--panel">
              {secondaryFilterLabel && (
                <span className="products-filter-chips-label">{secondaryFilterLabel}</span>
              )}
              {secondaryFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={joinClasses(
                    'workspace-filter-chip',
                    activeSecondaryFilterKeys.has(filter.key) ? 'workspace-filter-chip--active' : undefined,
                  )}
                  onClick={() => onToggleSecondaryFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filterMode === 'chips' && filterChips && filterChips.length > 0 && (
        <div className="workspace-filter-chips">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className={joinClasses(
                'workspace-filter-chip',
                activeChipKeys?.has(chip.key) ? 'workspace-filter-chip--active' : undefined,
              )}
              onClick={() => onToggleChip?.(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {sortOptions && sortOptions.length > 0 && (
        <div className="workspace-sort-row">
          <select
            className="workspace-sort-select"
            value={activeSortKey}
            onChange={(event) => onSortChange?.((event.target as HTMLSelectElement).value)}
          >
            {sortOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="products-list-body">
        {loading ? (
          <div className="products-pane-state">
            <Spinner size="md" />
            <p>{loadingText}</p>
          </div>
        ) : error ? (
          <div className="products-pane-state products-pane-state--error">
            <XCircle size={20} strokeWidth={1.5} aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : count === 0 ? (
          <div className="products-pane-state">
            <Package size={24} strokeWidth={1.5} aria-hidden="true" />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
};
