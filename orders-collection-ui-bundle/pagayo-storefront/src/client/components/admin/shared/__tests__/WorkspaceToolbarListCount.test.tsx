/** @jsxImportSource preact */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { WorkspaceToolbarListCount } from '../WorkspaceToolbarListCount';

describe('WorkspaceToolbarListCount', () => {
  it('renders numeric count only without label', () => {
    render(<WorkspaceToolbarListCount count={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('12').classList.contains('products-count-badge')).toBe(true);
  });

  it('renders count with label when countLabel is set', () => {
    render(<WorkspaceToolbarListCount count={5} countLabel="personen" />);
    expect(screen.getByText('5 personen')).toBeInTheDocument();
  });
});
