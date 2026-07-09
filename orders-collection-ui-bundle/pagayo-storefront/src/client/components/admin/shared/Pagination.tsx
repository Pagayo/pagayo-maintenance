/**
 * Pagination
 * Shared pagination component for admin list pages.
 * Shows page navigation with previous/next and page numbers.
 *
 * CSS: Styling via @pagayo/design (contexts/admin/tables.css)
 *
 * @example
 * <Pagination
 *   currentPage={1}
 *   totalItems={100}
 *   pageSize={25}
 *   onPageChange={(page) => setCurrentPage(page)}
 * />
 */
import { FunctionalComponent } from 'preact';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ADMIN_WORKSPACE_LIST_PAGE_SIZE } from '../../../../shared/admin-workspace-pagination';

interface PaginationProps {
  /** Current active page (1-based) */
  currentPage: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Items per page */
  pageSize: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
}

/** Max page number buttons shown at once (fixed blocks of 5: 1–5, 6–10, …) */
export const ADMIN_PAGINATION_WINDOW_SIZE = 5;

/**
 * Page numbers for the current sliding block (max 5).
 * Block 1: pages 1–5; block 2: 6–10; etc.
 */
export function getVisiblePageNumbers(
  currentPage: number,
  totalPages: number,
  windowSize: number = ADMIN_PAGINATION_WINDOW_SIZE,
): number[] {
  if (totalPages <= 0) return [];
  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const blockIndex = Math.floor((currentPage - 1) / windowSize);
  const start = blockIndex * windowSize + 1;
  const end = Math.min(start + windowSize - 1, totalPages);

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Pagination
 * Renders page controls below a list/table.
 * Item range on top; prev/next and up to 5 page numbers below.
 */
export const Pagination: FunctionalComponent<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = getVisiblePageNumbers(currentPage, totalPages);

  return (
    <div className="pagination">
      <div className="pagination__inner">
        <div className="pagination__info">
          {startItem}–{endItem} van {totalItems}
        </div>

        <div className="pagination__controls">
          <button
            type="button"
            className="pagination__btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Vorige pagina"
            aria-label="Vorige pagina"
          >
            <ChevronLeft size={16} />
          </button>

          {pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              className={`pagination__btn pagination__page ${
                pageNum === currentPage ? 'pagination__page--active' : ''
              }`}
              onClick={() => onPageChange(pageNum)}
              aria-label={`Pagina ${pageNum}`}
              aria-current={pageNum === currentPage ? 'page' : undefined}
            >
              {pageNum}
            </button>
          ))}

          <button
            type="button"
            className="pagination__btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Volgende pagina"
            aria-label="Volgende pagina"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

/** Default page size for admin workspace list pages */
export const ADMIN_PAGE_SIZE = ADMIN_WORKSPACE_LIST_PAGE_SIZE;

/**
 * Helper: slice items array for current page.
 */
export function paginateItems<T>(items: T[], currentPage: number, pageSize: number = ADMIN_PAGE_SIZE): T[] {
  const start = (currentPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
