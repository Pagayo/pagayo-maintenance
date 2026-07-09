/** @jsxImportSource preact */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { WorkspaceRow } from '../WorkspaceRow';

// ===========================================
// HELPERS
// ===========================================

const baseProps = {
  isActive: false,
  isSelected: false,
  title: 'Test Title',
  onClick: vi.fn(),
};

// ===========================================
// TESTS
// ===========================================

describe('WorkspaceRow', () => {
  // ---- BACKWARD COMPATIBILITY ----

  describe('backward compatibility (no new props)', () => {
    it('renders title and meta', () => {
      render(<WorkspaceRow {...baseProps} meta="Some meta" />);

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Some meta')).toBeInTheDocument();
    });

    it('renders custom status markup via status prop', () => {
      render(
        <WorkspaceRow {...baseProps} status={<span data-testid="custom-status">Custom</span>} />,
      );

      expect(screen.getByTestId('custom-status')).toBeInTheDocument();
    });

    it('renders without status when no status props are set', () => {
      const { container } = render(<WorkspaceRow {...baseProps} />);

      expect(container.querySelector('.workspace-badge')).toBeNull();
    });
  });

  // ---- STATUS VARIANT ----

  describe('statusVariant + statusLabel', () => {
    it('renders .workspace-badge with variant class', () => {
      const { container } = render(
        <WorkspaceRow {...baseProps} statusVariant="active" statusLabel="Actief" />,
      );

      const badge = container.querySelector('.workspace-badge');
      expect(badge).not.toBeNull();
      expect(badge?.classList.contains('workspace-badge--active')).toBe(true);
      expect(badge?.textContent).toBe('Actief');
    });

    it('renders expired variant', () => {
      const { container } = render(
        <WorkspaceRow {...baseProps} statusVariant="expired" statusLabel="Verlopen" />,
      );

      const badge = container.querySelector('.workspace-badge--expired');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe('Verlopen');
    });

    it('status prop wins over statusVariant when both are set', () => {
      const { container } = render(
        <WorkspaceRow
          {...baseProps}
          status={<span data-testid="custom-status">Custom</span>}
          statusVariant="active"
          statusLabel="Actief"
        />,
      );

      expect(screen.getByTestId('custom-status')).toBeInTheDocument();
      expect(container.querySelector('.workspace-badge')).toBeNull();
    });

    it('does not render badge when only statusVariant is set without statusLabel', () => {
      const { container } = render(
        <WorkspaceRow {...baseProps} statusVariant="paused" />,
      );

      expect(container.querySelector('.workspace-badge')).toBeNull();
    });
  });

  // ---- TYPE VARIANT ----

  describe('typeVariant + typeLabel', () => {
    it('renders .workspace-type-chip with variant class', () => {
      const { container } = render(
        <WorkspaceRow {...baseProps} typeVariant="individual" typeLabel="Individueel" />,
      );

      const chip = container.querySelector('.workspace-type-chip');
      expect(chip).not.toBeNull();
      expect(chip?.classList.contains('workspace-type-chip--individual')).toBe(true);
      expect(chip?.textContent).toBe('Individueel');
    });

    it('renders family variant', () => {
      const { container } = render(
        <WorkspaceRow {...baseProps} typeVariant="family" typeLabel="Familie" />,
      );

      const chip = container.querySelector('.workspace-type-chip--family');
      expect(chip).not.toBeNull();
      expect(chip?.textContent).toBe('Familie');
    });

    it('type chip renders independently of status', () => {
      const { container } = render(
        <WorkspaceRow
          {...baseProps}
          status={<span data-testid="custom-status">Custom</span>}
          typeVariant="family"
          typeLabel="Familie"
        />,
      );

      expect(screen.getByTestId('custom-status')).toBeInTheDocument();
      expect(container.querySelector('.workspace-type-chip--family')).not.toBeNull();
    });

    it('type chip works alongside statusVariant', () => {
      const { container } = render(
        <WorkspaceRow
          {...baseProps}
          statusVariant="active"
          statusLabel="Actief"
          typeVariant="individual"
          typeLabel="Individueel"
        />,
      );

      expect(container.querySelector('.workspace-badge--active')).not.toBeNull();
      expect(container.querySelector('.workspace-type-chip--individual')).not.toBeNull();
    });

    it('does not render type chip when only typeVariant without typeLabel', () => {
      const { container } = render(
        <WorkspaceRow {...baseProps} typeVariant="family" />,
      );

      expect(container.querySelector('.workspace-type-chip')).toBeNull();
    });
  });
});
