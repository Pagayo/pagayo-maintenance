/** @jsxImportSource preact */

import { ComponentChildren, FunctionalComponent, JSX } from 'preact';

export interface WorkspaceRowProps {
  isActive: boolean;
  isSelected: boolean;
  title: ComponentChildren;
  onClick: JSX.MouseEventHandler<HTMLButtonElement>;
  meta?: ComponentChildren;
  submeta?: ComponentChildren;
  status?: ComponentChildren;
  primaryValue?: ComponentChildren;
  secondaryValue?: ComponentChildren;
  className?: string;
  statusVariant?: 'active' | 'expired' | 'paused' | 'expiring';
  statusLabel?: string;
  typeVariant?: 'individual' | 'family';
  typeLabel?: string;
}

function joinClasses(...classes: Array<string | undefined | false>): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

/**
 * WorkspaceRow
 * Uniforme rijweergave voor master-detail workspace lijsten.
 */
export const WorkspaceRow: FunctionalComponent<WorkspaceRowProps> = ({
  isActive,
  isSelected,
  title,
  onClick,
  meta,
  submeta,
  status,
  primaryValue,
  secondaryValue,
  className,
  statusVariant,
  statusLabel,
  typeVariant,
  typeLabel,
}) => {
  const resolvedStatus = status ?? (
    statusVariant && statusLabel
      ? <span className={`workspace-badge workspace-badge--${statusVariant}`}>{statusLabel}</span>
      : undefined
  );

  return (
    <button
      type="button"
      className={joinClasses(
        'product-workspace-row',
        isSelected && 'selected',
        isActive && 'active',
        className,
      )}
      onClick={onClick}
    >
      <div className="product-workspace-row__copy">
        <div className="product-workspace-row__title">{title}</div>
        {typeVariant && typeLabel && (
          <span className={`workspace-type-chip workspace-type-chip--${typeVariant}`}>{typeLabel}</span>
        )}
        {meta && <div className="product-workspace-row__meta">{meta}</div>}
        {submeta && <div className="product-workspace-row__submeta">{submeta}</div>}
      </div>

      <div className="product-workspace-row__right">
        {resolvedStatus}
        {primaryValue && <div className="product-workspace-row__price">{primaryValue}</div>}
        {secondaryValue && <div className="product-workspace-row__stock">{secondaryValue}</div>}
      </div>
    </button>
  );
};
