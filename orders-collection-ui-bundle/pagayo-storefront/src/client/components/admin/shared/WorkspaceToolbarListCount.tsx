/** @jsxImportSource preact */

import { FunctionalComponent } from 'preact';

export interface WorkspaceToolbarListCountProps {
  count: number;
  countLabel?: string;
}

/**
 * List total badge for the workspace toolbar (same visual grammar as the former list-panel count).
 */
export const WorkspaceToolbarListCount: FunctionalComponent<WorkspaceToolbarListCountProps> = ({
  count,
  countLabel,
}) => (
  <span className="products-count-badge">
    {countLabel ? `${count} ${countLabel}` : count}
  </span>
);
