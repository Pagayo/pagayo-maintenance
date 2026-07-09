/** @jsxImportSource preact */

import { FunctionalComponent } from 'preact';
import { Search } from 'lucide-react';

export interface WorkspaceSearchInputProps {
  id: string;
  value: string;
  placeholder: string;
  onInput: (value: string) => void;
  onFocus?: () => void;
  className?: string;
  /** Match list-page inline header search (default). */
  inlineHeader?: boolean;
}

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

/**
 * WorkspaceSearchInput — zelfde zoekveld als linkerkolom WorkspaceListPanel.
 */
export const WorkspaceSearchInput: FunctionalComponent<WorkspaceSearchInputProps> = ({
  id,
  value,
  placeholder,
  onInput,
  onFocus,
  className,
  inlineHeader = true,
}) => (
  <div
    className={joinClasses(
      'products-search-panel',
      inlineHeader ? 'products-search-panel--inline-header' : undefined,
      className,
    )}
  >
    <label className="products-search-input-wrapper" htmlFor={id}>
      <Search size={16} strokeWidth={1.5} aria-hidden="true" />
      <input
        id={id}
        type="text"
        value={value}
        onInput={(event) => onInput((event.target as HTMLInputElement).value)}
        onFocus={onFocus}
        placeholder={placeholder}
      />
    </label>
  </div>
);
