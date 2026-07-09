/** @jsxImportSource preact */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { WorkspaceListPanel } from '../WorkspaceListPanel';
import type { WorkspaceFilterChip, WorkspaceSortOption } from '../WorkspaceListPanel';

// ===========================================
// MOCKS
// ===========================================

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronUp: () => <span data-testid="icon-chevron-up" />,
  Package: () => <span data-testid="icon-package" />,
  Search: () => <span data-testid="icon-search" />,
  XCircle: () => <span data-testid="icon-x-circle" />,
}));

// ===========================================
// HELPERS
// ===========================================

const baseProps = {
  count: 5,
  loading: false,
  error: null,
  loadingText: 'Loading…',
  searchValue: '',
  searchLabel: 'Search',
  searchPlaceholder: 'Type to search',
  searchInputId: 'test-search',
  filterLabel: 'Filters',
  filterGroupLabel: 'Status',
  filters: [
    { key: 'active', label: 'Active' },
    { key: 'paused', label: 'Paused' },
  ],
  activeFilterKeys: new Set<string>(),
  onSearchChange: vi.fn(),
  onToggleFilter: vi.fn(),
  emptyText: 'No items',
} as const;

// ===========================================
// COMBINED SEARCH + FILTER PANEL
// ===========================================

describe('WorkspaceListPanel', () => {
  describe('combined search + filter panel', () => {
    it('renders ONE toggle button with searchLabel text', () => {
      render(
        <WorkspaceListPanel {...baseProps}>
          <div>child content</div>
        </WorkspaceListPanel>,
      );

      // ONE button with the searchLabel
      const button = screen.getByText('Search');
      expect(button).toBeInTheDocument();
    });

    it('does not render count badge in panel header (count lives in toolbar)', () => {
      const { container } = render(
        <WorkspaceListPanel {...baseProps}>
          <div>child content</div>
        </WorkspaceListPanel>,
      );

      expect(container.querySelector('.products-card-header .products-count-badge')).toBeNull();
      expect(screen.getByText('child content')).toBeInTheDocument();
      expect(container.querySelector('.workspace-filter-chips')).toBeNull();
      expect(container.querySelector('.workspace-sort-row')).toBeNull();
    });

    it('panel is closed by default', () => {
      const { container } = render(
        <WorkspaceListPanel {...baseProps}>
          <div>items</div>
        </WorkspaceListPanel>,
      );

      expect(container.querySelector('.products-control-dropdown-panel')).toBeNull();
    });

    it('opens combined panel on button click and shows search input', () => {
      const { container } = render(
        <WorkspaceListPanel {...baseProps}>
          <div>items</div>
        </WorkspaceListPanel>,
      );

      fireEvent.click(screen.getByText('Search'));

      expect(container.querySelector('.products-control-dropdown-panel')).not.toBeNull();
      expect(container.querySelector('input[type="text"]')).not.toBeNull();
    });

    it('shows filter chips inside panel when filters are present', () => {
      const { container } = render(
        <WorkspaceListPanel {...baseProps}>
          <div>items</div>
        </WorkspaceListPanel>,
      );

      fireEvent.click(screen.getByText('Search'));

      const panel = container.querySelector('.products-control-dropdown-panel');
      expect(panel).not.toBeNull();
      // Chip buttons for Active and Paused
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });

    it('does not show checkboxes in panel (chip-based UI)', () => {
      const { container } = render(
        <WorkspaceListPanel {...baseProps}>
          <div>items</div>
        </WorkspaceListPanel>,
      );

      fireEvent.click(screen.getByText('Search'));

      expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    });

    it('active filter chip has workspace-filter-chip--active class', () => {
      const { container } = render(
        <WorkspaceListPanel {...baseProps} activeFilterKeys={new Set(['active'])}>
          <div>items</div>
        </WorkspaceListPanel>,
      );

      fireEvent.click(screen.getByText('Search'));

      const activeChip = container.querySelector('.workspace-filter-chip--active');
      expect(activeChip).not.toBeNull();
      expect(activeChip?.textContent).toBe('Active');
    });

    it('calls onToggleFilter when filter chip is clicked in panel', () => {
      const onToggleFilter = vi.fn();
      render(
        <WorkspaceListPanel {...baseProps} onToggleFilter={onToggleFilter}>
          <div>items</div>
        </WorkspaceListPanel>,
      );

      fireEvent.click(screen.getByText('Search'));
      fireEvent.click(screen.getByText('Paused'));

      expect(onToggleFilter).toHaveBeenCalledWith('paused');
    });

    it('does not show filter chips section when filters array is empty', () => {
      const { container } = render(
        <WorkspaceListPanel {...baseProps} filters={[]}>
          <div>items</div>
        </WorkspaceListPanel>,
      );

      fireEvent.click(screen.getByText('Search'));

      expect(container.querySelector('.products-filter-chips--panel')).toBeNull();
    });

    it('shows filterLabel as section header above chips when provided', () => {
      render(
        <WorkspaceListPanel {...baseProps}>
          <div>items</div>
        </WorkspaceListPanel>,
      );

      fireEvent.click(screen.getByText('Search'));

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('shows secondary filter chips inside the same panel when secondaryFilters are provided', () => {
      const onToggleSecondaryFilter = vi.fn();
      render(
        <WorkspaceListPanel
          {...baseProps}
          secondaryFilterLabel="Print"
          secondaryFilters={[
            { key: 'printed', label: 'Printed' },
            { key: 'not_printed', label: 'Not printed' },
          ]}
          activeSecondaryFilterKeys={new Set(['printed'])}
          onToggleSecondaryFilter={onToggleSecondaryFilter}
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      fireEvent.click(screen.getByText('Search'));

      expect(screen.getByText('Print')).toBeInTheDocument();
      expect(screen.getByText('Printed')).toBeInTheDocument();
      expect(screen.getByText('Not printed')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Not printed'));
      expect(onToggleSecondaryFilter).toHaveBeenCalledWith('not_printed');
    });

    it('closes panel on second button click', () => {
      const { container } = render(
        <WorkspaceListPanel {...baseProps}>
          <div>items</div>
        </WorkspaceListPanel>,
      );

      fireEvent.click(screen.getByText('Search'));
      expect(container.querySelector('.products-control-dropdown-panel')).not.toBeNull();

      fireEvent.click(screen.getByText('Search'));
      expect(container.querySelector('.products-control-dropdown-panel')).toBeNull();
    });

    it('renders with filterMode="dropdown" same as default (no always-visible chips)', () => {
      const { container } = render(
        <WorkspaceListPanel {...baseProps} filterMode="dropdown">
          <div>items</div>
        </WorkspaceListPanel>,
      );

      expect(container.querySelector('.workspace-filter-chips')).toBeNull();
    });
  });

  // ===========================================
  // FILTER CHIPS
  // ===========================================

  describe('filterMode="chips"', () => {
    const chips: WorkspaceFilterChip[] = [
      { key: 'all', label: 'Alle' },
      { key: 'active', label: 'Actief' },
      { key: 'expired', label: 'Verlopen' },
    ];

    it('renders .workspace-filter-chips container', () => {
      const { container } = render(
        <WorkspaceListPanel
          {...baseProps}
          filterMode="chips"
          filterChips={chips}
          activeChipKeys={new Set<string>()}
          onToggleChip={vi.fn()}
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      expect(container.querySelector('.workspace-filter-chips')).not.toBeNull();
    });

    it('renders all chip buttons', () => {
      render(
        <WorkspaceListPanel
          {...baseProps}
          filterMode="chips"
          filterChips={chips}
          activeChipKeys={new Set<string>()}
          onToggleChip={vi.fn()}
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      expect(screen.getByText('Alle')).toBeInTheDocument();
      expect(screen.getByText('Actief')).toBeInTheDocument();
      expect(screen.getByText('Verlopen')).toBeInTheDocument();
    });

    it('active chip has .workspace-filter-chip--active class', () => {
      const { container } = render(
        <WorkspaceListPanel
          {...baseProps}
          filterMode="chips"
          filterChips={chips}
          activeChipKeys={new Set(['active'])}
          onToggleChip={vi.fn()}
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      const activeChip = container.querySelector('.workspace-filter-chip--active');
      expect(activeChip).not.toBeNull();
      expect(activeChip?.textContent).toBe('Actief');
    });

    it('calls onToggleChip when chip is clicked', () => {
      const onToggleChip = vi.fn();
      render(
        <WorkspaceListPanel
          {...baseProps}
          filterMode="chips"
          filterChips={chips}
          activeChipKeys={new Set<string>()}
          onToggleChip={onToggleChip}
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      fireEvent.click(screen.getByText('Actief'));
      expect(onToggleChip).toHaveBeenCalledWith('active');
    });

    it('does not render chips when filterChips is empty', () => {
      const { container } = render(
        <WorkspaceListPanel
          {...baseProps}
          filterMode="chips"
          filterChips={[]}
          activeChipKeys={new Set<string>()}
          onToggleChip={vi.fn()}
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      expect(container.querySelector('.workspace-filter-chips')).toBeNull();
    });
  });

  // ===========================================
  // SORT OPTIONS
  // ===========================================

  describe('searchPlacement and filterPlacement', () => {
    it('searchPlacement inline shows search input in header without opening dropdown', () => {
      const onSearchChange = vi.fn();
      const { container } = render(
        <WorkspaceListPanel
          {...baseProps}
          searchPlacement="inline"
          filters={[]}
          onSearchChange={onSearchChange}
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      expect(container.querySelector('.products-search-panel--inline-header')).not.toBeNull();
      const input = screen.getByPlaceholderText('Type to search') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      fireEvent.input(input, { target: { value: 'abc' } });
      expect(onSearchChange).toHaveBeenCalledWith('abc');
      expect(screen.queryByText('Search')).toBeNull();
    });

    it('search inline + filters in dropdown uses filter label on toggle and panel has no search field', () => {
      const { container } = render(
        <WorkspaceListPanel
          {...baseProps}
          searchPlacement="inline"
          filterPlacement="dropdown"
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      expect(container.querySelector('.products-search-panel--inline-header')).not.toBeNull();
      fireEvent.click(screen.getByText('Filters'));
      const panel = container.querySelector('.products-control-dropdown-panel');
      expect(panel).not.toBeNull();
      const textInputs = panel?.querySelectorAll('input[type="text"]') ?? [];
      expect(textInputs.length).toBe(0);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('sortOptions', () => {
    const sortOptions: WorkspaceSortOption[] = [
      { key: 'name-asc', label: 'Naam A-Z' },
      { key: 'name-desc', label: 'Naam Z-A' },
      { key: 'date-desc', label: 'Nieuwste eerst' },
    ];

    it('renders .workspace-sort-row with select', () => {
      const { container } = render(
        <WorkspaceListPanel
          {...baseProps}
          sortOptions={sortOptions}
          activeSortKey="name-asc"
          onSortChange={vi.fn()}
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      expect(container.querySelector('.workspace-sort-row')).not.toBeNull();
      expect(container.querySelector('.workspace-sort-select')).not.toBeNull();
    });

    it('renders all sort options', () => {
      render(
        <WorkspaceListPanel
          {...baseProps}
          sortOptions={sortOptions}
          activeSortKey="name-asc"
          onSortChange={vi.fn()}
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      expect(screen.getByText('Naam A-Z')).toBeInTheDocument();
      expect(screen.getByText('Naam Z-A')).toBeInTheDocument();
      expect(screen.getByText('Nieuwste eerst')).toBeInTheDocument();
    });

    it('calls onSortChange on select change', () => {
      const onSortChange = vi.fn();
      const { container } = render(
        <WorkspaceListPanel
          {...baseProps}
          sortOptions={sortOptions}
          activeSortKey="name-asc"
          onSortChange={onSortChange}
        >
          <div>items</div>
        </WorkspaceListPanel>,
      );

      const select = container.querySelector('.workspace-sort-select') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'date-desc' } });
      expect(onSortChange).toHaveBeenCalledWith('date-desc');
    });

    it('does not render sort row without sortOptions', () => {
      const { container } = render(
        <WorkspaceListPanel {...baseProps}>
          <div>items</div>
        </WorkspaceListPanel>,
      );

      expect(container.querySelector('.workspace-sort-row')).toBeNull();
    });
  });
});
