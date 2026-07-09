/** @jsxImportSource preact */

import { ComponentChildren, FunctionalComponent, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

export interface WorkspaceCommandCenterAction {
  label: ComponentChildren;
  onClick?: () => void;
  tone?: 'default' | 'primary' | 'danger' | 'muted';
  disabled?: boolean;
  testId?: string;
}

export interface WorkspaceCommandCenterChip {
  key: string;
  label: ComponentChildren;
  onRemove?: () => void;
}

export interface WorkspaceCommandCenterSection {
  id: string;
  title: ComponentChildren;
  description?: ComponentChildren;
  width?: 'sm' | 'md' | 'lg';
  children: ComponentChildren;
}

interface WorkspaceCommandCenterProps {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  totalLabel?: ComponentChildren;
  toggleLabel: ComponentChildren;
  primaryAction: WorkspaceCommandCenterAction;
  secondaryActions?: WorkspaceCommandCenterAction[];
  sections: WorkspaceCommandCenterSection[];
  activeChips?: WorkspaceCommandCenterChip[];
  onClearAll?: () => void;
  clearAllLabel?: ComponentChildren;
  applyLabel?: ComponentChildren;
  onApply?: () => void;
  className?: string;
}

function joinClasses(...classes: Array<string | undefined | false>): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

const WorkspaceCommandCenterButton: FunctionalComponent<WorkspaceCommandCenterAction & { className?: string }> = ({
  label,
  onClick,
  tone = 'default',
  disabled = false,
  testId,
  className,
}) => (
  <button
    type="button"
    className={joinClasses(
      'workspace-command-center__button',
      `workspace-command-center__button--${tone}`,
      className,
    )}
    onClick={onClick}
    disabled={disabled}
    data-testid={testId}
  >
    {label}
  </button>
);

export const WorkspaceCommandCenter: FunctionalComponent<WorkspaceCommandCenterProps> = ({
  title,
  subtitle,
  totalLabel,
  toggleLabel,
  primaryAction,
  secondaryActions = [],
  sections,
  activeChips = [],
  onClearAll,
  clearAllLabel = 'Alles wissen',
  applyLabel = 'Toepassen',
  onApply,
  className,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  const handleApply = (): void => {
    onApply?.();
    setIsOpen(false);
  };

  return (
    <section
      ref={rootRef}
      className={joinClasses('workspace-command-center', isOpen && 'workspace-command-center--open', className)}
      data-workspace-v3="command-center"
    >
      <div className="workspace-command-center__header">
        <div className="workspace-command-center__title-block">
          <h1 className="workspace-command-center__title">{title}</h1>
          {subtitle ? <p className="workspace-command-center__subtitle">{subtitle}</p> : null}
          {totalLabel ? <span className="workspace-command-center__count">{totalLabel}</span> : null}
        </div>

        <div className="workspace-command-center__header-actions">
          <button
            type="button"
            className="workspace-command-center__toggle"
            aria-expanded={isOpen ? 'true' : 'false'}
            onClick={() => setIsOpen((current) => !current)}
          >
            {toggleLabel}
            {isOpen
              ? <ChevronUp size={16} strokeWidth={1.75} aria-hidden="true" />
              : <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />}
          </button>
          <WorkspaceCommandCenterButton {...primaryAction} tone={primaryAction.tone ?? 'primary'} />
        </div>
      </div>

      {isOpen ? (
        <div className="workspace-command-center__surface">
          <div className="workspace-command-center__surface-header">
            <div>
              <span className="workspace-command-center__eyebrow">Workspace</span>
              <p className="workspace-command-center__surface-title">Alle gereedschappen voor deze lijst</p>
            </div>
            <button
              type="button"
              className="workspace-command-center__close"
              aria-label="Sluit workspace"
              onClick={() => setIsOpen(false)}
            >
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          <div className="workspace-command-center__grid">
            {sections.map((section) => (
              <section
                key={section.id}
                className={joinClasses(
                  'workspace-command-center__section',
                  section.width ? `workspace-command-center__section--${section.width}` : undefined,
                )}
                data-workspace-section={section.id}
              >
                <div className="workspace-command-center__section-header">
                  <h2>{section.title}</h2>
                  {section.description ? <p>{section.description}</p> : null}
                </div>
                <div className="workspace-command-center__section-body">
                  {section.children}
                </div>
              </section>
            ))}
          </div>

          <div className="workspace-command-center__footer">
            <div className="workspace-command-center__active-filters" aria-label="Actieve filters">
              {activeChips.length > 0 ? activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="workspace-command-center__chip"
                  onClick={chip.onRemove}
                  disabled={!chip.onRemove}
                >
                  {chip.label}
                  {chip.onRemove ? <span aria-hidden="true">×</span> : null}
                </button>
              )) : <span className="workspace-command-center__no-filters">Geen actieve filters</span>}
              {activeChips.length > 0 && onClearAll ? (
                <button type="button" className="workspace-command-center__clear" onClick={onClearAll}>
                  {clearAllLabel}
                </button>
              ) : null}
            </div>

            <div className="workspace-command-center__footer-actions">
              {secondaryActions.map((action, index) => (
                <WorkspaceCommandCenterButton key={`workspace-secondary-${index}`} {...action} />
              ))}
              <WorkspaceCommandCenterButton label={applyLabel} tone="primary" onClick={handleApply} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

interface WorkspaceCommandOptionProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'type'> {
  label: ComponentChildren;
  meta?: ComponentChildren;
  isActive?: boolean;
}

export const WorkspaceCommandOption: FunctionalComponent<WorkspaceCommandOptionProps> = ({
  label,
  meta,
  isActive = false,
  className,
  ...buttonProps
}) => (
  <button
    type="button"
    className={joinClasses('workspace-command-option', isActive && 'workspace-command-option--active', className)}
    {...buttonProps}
  >
    <span>{label}</span>
    {meta ? <small>{meta}</small> : null}
  </button>
);

export const WorkspaceCommandField: FunctionalComponent<JSX.HTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input className={joinClasses('workspace-command-field', className)} {...props} />
);

export const WorkspaceCommandSelect: FunctionalComponent<JSX.HTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => (
  <select className={joinClasses('workspace-command-field', className)} {...props}>
    {children}
  </select>
);
