import { ComponentChildren, FunctionalComponent, JSX } from 'preact';
import { t } from '../../../i18n';
import { DateInput } from '../../DateInput';
import { DateTimeInput } from '../../DateTimeInput';

interface WorkspaceToolbarProps {
  className?: string;
  scope?: 'page' | 'global';
  children: ComponentChildren;
}

interface WorkspaceToolbarSectionProps {
  children?: ComponentChildren;
}

interface WorkspaceToolbarSelectProps extends Omit<JSX.HTMLAttributes<HTMLSelectElement>, 'children'> {
  children: ComponentChildren;
  intent: string;
  isDisabled?: boolean;
}

interface WorkspaceToolbarDateInputProps extends Omit<JSX.HTMLAttributes<HTMLInputElement>, 'type' | 'onInput'> {
  intent: string;
  isDisabled?: boolean;
  type?: 'date' | 'datetime-local';
  value?: string;
  onInput?: (event: JSX.TargetedEvent<HTMLInputElement>) => void;
}

export type WorkspaceToolbarActionTone = 'default' | 'primary' | 'danger' | 'success';
export type WorkspaceToolbarSaveState = 'default' | 'saving' | 'saved';

export type WorkspaceToolbarActionIntent =
  | 'import'
  | 'export'
  | 'bulkEdit'
  | 'print'
  | 'delete'
  | 'new'
  | 'save'
  | 'archive'
  | 'restore'
  | 'duplicate'
  | 'view'
  | 'cancel'
  | 'rules'
  | 'refresh'
  | 'settings'
  | 'selected'
  | 'relatedMembers';

interface WorkspaceToolbarActionProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'children' | 'type'> {
  children: ComponentChildren;
  intent: WorkspaceToolbarActionIntent;
  tone?: WorkspaceToolbarActionTone;
  saveState?: WorkspaceToolbarSaveState;
  isDisabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export interface WorkspaceToolbarActionConfig extends Omit<WorkspaceToolbarActionProps, 'intent' | 'children'> {
  /** Label tekst. Optioneel — als weggelaten wordt het centrale default label voor het intent gebruikt. */
  label?: ComponentChildren;
  /** Optioneel icoon (bijv. Lucide); met `iconOnly` wordt een compacte toolknop gerenderd. */
  icon?: ComponentChildren;
  /** Toon alleen `icon`; `aria-label` valt terug op het default label voor dit intent (tenzij je `aria-label` zelf zet). */
  iconOnly?: boolean;
}

export type WorkspaceToolbarActionMap = Partial<Record<WorkspaceToolbarActionIntent, WorkspaceToolbarActionConfig>>;

interface WorkspaceToolbarActionGroupProps {
  actions: WorkspaceToolbarActionMap;
}

const WORKSPACE_TOOLBAR_INTENT_TONE: Record<WorkspaceToolbarActionIntent, WorkspaceToolbarActionTone> = {
  import: 'default',
  export: 'default',
  bulkEdit: 'default',
  print: 'default',
  delete: 'danger',
  new: 'default',
  save: 'primary',
  archive: 'default',
  restore: 'default',
  duplicate: 'default',
  view: 'default',
  cancel: 'default',
  rules: 'default',
  refresh: 'default',
  settings: 'default',
  selected: 'default',
  relatedMembers: 'default',
};

/**
 * Centrale default i18n keys per intent.
 * SSoT: pagina's hoeven geen label mee te geven als het standaard label volstaat.
 */
const WORKSPACE_TOOLBAR_INTENT_DEFAULT_LABEL: Record<WorkspaceToolbarActionIntent, string> = {
  import: 'common.import',
  export: 'common.export',
  bulkEdit: 'common.bulkEdit',
  print: 'common.print',
  delete: 'common.delete',
  new: 'common.create',
  save: 'common.autosave',
  archive: 'common.archive',
  restore: 'common.restore',
  duplicate: 'common.duplicate',
  view: 'common.view',
  cancel: 'common.cancel',
  rules: 'common.view',
  refresh: 'common.refresh',
  settings: 'common.workspaceToolbarSettings',
  selected: 'common.selected',
  relatedMembers: 'members.customerFilter.relatedMembers',
};

const WORKSPACE_TOOLBAR_ACTION_ORDER: WorkspaceToolbarActionIntent[] = [
  'import',
  'export',
  'bulkEdit',
  'rules',
  'delete',
  'archive',
  'restore',
  'duplicate',
  'view',
  'selected',
  'print',
  'relatedMembers',
  'refresh',
  'settings',
  'new',
  'cancel',
  'save',
];

function getToneClassName(tone: WorkspaceToolbarActionTone): string {
  if (tone === 'primary') {
    return 'products-workspace-toolbar__action--primary';
  }

  if (tone === 'danger') {
    return 'products-workspace-toolbar__action--danger';
  }

  if (tone === 'success') {
    return 'products-workspace-toolbar__action--success';
  }

  return '';
}

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

/**
 * WorkspaceToolbar
 * Gestandaardiseerde toolbar met vaste left/right secties voor admin workspaces.
 */
export const WorkspaceToolbar: FunctionalComponent<WorkspaceToolbarProps> = ({
  className,
  scope = 'page',
  children,
}) => {
  return (
    <div
      className={joinClasses('products-workspace-toolbar', className)}
      data-workspace-toolbar-scope={scope}
    >
      {children}
    </div>
  );
};

/**
 * WorkspaceToolbarLeft
 * Linker groep voor secundaire acties.
 */
export const WorkspaceToolbarLeft: FunctionalComponent<WorkspaceToolbarSectionProps> = ({ children }) => {
  return <div className="products-workspace-toolbar__left">{children}</div>;
};

/**
 * WorkspaceToolbarRight
 * Rechter groep voor primaire acties.
 */
export const WorkspaceToolbarRight: FunctionalComponent<WorkspaceToolbarSectionProps> = ({ children }) => {
  return <div className="products-workspace-toolbar__right">{children}</div>;
};

/**
 * WorkspaceToolbarAction
 * Afdwingbare workspace action button met intent-gedreven visuele varianten.
 */
export const WorkspaceToolbarAction: FunctionalComponent<WorkspaceToolbarActionProps> = ({
  intent,
  tone,
  saveState = 'default',
  className,
  type = 'button',
  isDisabled = false,
  children,
  ...buttonProps
}) => {
  const resolvedTone = tone ?? WORKSPACE_TOOLBAR_INTENT_TONE[intent];
  const saveStateClassName = intent === 'save'
    ? (saveState === 'saving'
      ? 'products-workspace-toolbar__action--autosaving'
      : (saveState === 'saved' ? 'products-workspace-toolbar__action--autosaved' : ''))
    : '';

  const { onClick, ...restButtonProps } = buttonProps;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={joinClasses(
        'products-workspace-toolbar__action',
        getToneClassName(resolvedTone),
        saveStateClassName,
        className,
      )}
      data-workspace-action-intent={intent}
      {...restButtonProps}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

/**
 * WorkspaceToolbarActionGroup
 * Declaratieve action set: pagina geeft aan welke acties nodig zijn,
 * de centrale toolbar-order bepaalt de render-volgorde.
 *
 * Labels zijn optioneel — als een pagina geen label meegeeft, wordt het
 * centrale default label uit WORKSPACE_TOOLBAR_INTENT_DEFAULT_LABEL gebruikt.
 * Pagina's kunnen overschrijven voor domein-specifieke tekst (bijv. "Process", "Renew").
 */
export const WorkspaceToolbarActionGroup: FunctionalComponent<WorkspaceToolbarActionGroupProps> = ({ actions }) => {
  return (
    <>
      {WORKSPACE_TOOLBAR_ACTION_ORDER.map((intent) => {
        const action = actions[intent];
        if (!action) {
          return null;
        }

        const { label, icon, iconOnly, ...actionProps } = action;
        const resolvedLabel = label ?? t(WORKSPACE_TOOLBAR_INTENT_DEFAULT_LABEL[intent]);
        const defaultLabelString = t(WORKSPACE_TOOLBAR_INTENT_DEFAULT_LABEL[intent]);
        const showIconOnly = Boolean(iconOnly && icon);
        const { 'aria-label': ariaLabelInput, title: titleInput, ...buttonProps } = actionProps;
        const ariaLabel = showIconOnly
          ? (typeof ariaLabelInput === 'string' && ariaLabelInput.length > 0
            ? ariaLabelInput
            : defaultLabelString)
          : ariaLabelInput;
        const resolvedTitle = showIconOnly ? defaultLabelString : titleInput;

        return (
          <WorkspaceToolbarAction
            key={`workspace-toolbar-action-${intent}`}
            intent={intent}
            data-testid={`toolbar-action-${intent}`}
            {...buttonProps}
            {...(typeof ariaLabel === 'string' ? { 'aria-label': ariaLabel } : {})}
            {...(resolvedTitle !== undefined ? { title: resolvedTitle } : {})}
          >
            {showIconOnly ? icon : resolvedLabel}
          </WorkspaceToolbarAction>
        );
      })}
    </>
  );
};

/**
 * WorkspaceToolbarSelect
 * Gedeelde select-control voor workspace toolbars met vaste styling en intent-attribuut.
 */
export const WorkspaceToolbarSelect: FunctionalComponent<WorkspaceToolbarSelectProps> = ({
  intent,
  className,
  isDisabled = false,
  children,
  ...selectProps
}) => {
  return (
    <select
      className={joinClasses('form-select', 'products-workspace-toolbar__select', className)}
      data-workspace-control-intent={intent}
      disabled={isDisabled}
      {...selectProps}
    >
      {children}
    </select>
  );
};

/**
 * WorkspaceToolbarDateInput
 * Gedeelde datum/datetime control voor workspace toolbars met vaste styling.
 */
export const WorkspaceToolbarDateInput: FunctionalComponent<WorkspaceToolbarDateInputProps> = ({
  intent,
  className,
  isDisabled = false,
  type = 'datetime-local',
  value = '',
  onInput,
  title,
  ...inputProps
}) => {
  const controlClassName = joinClasses(
    'form-input',
    'products-workspace-toolbar__date',
    className,
  );

  const emitInput = (nextValue: string) => {
    if (!onInput) {
      return;
    }
    onInput({
      currentTarget: { value: nextValue } as HTMLInputElement,
      target: { value: nextValue } as HTMLInputElement,
    } as JSX.TargetedEvent<HTMLInputElement>);
  };

  if (type === 'date') {
    return (
      <DateInput
        id={inputProps.id}
        name={inputProps.name}
        className={controlClassName}
        data-workspace-control-intent={intent}
        disabled={isDisabled}
        value={value}
        onValueChange={emitInput}
        aria-label={title}
        title={title}
      />
    );
  }

  return (
    <DateTimeInput
      className={joinClasses('products-workspace-toolbar__datetime', className)}
      data-workspace-control-intent={intent}
      disabled={isDisabled}
      value={value}
      onValueChange={emitInput}
      dateClassName={controlClassName}
      timeClassName={controlClassName}
      id={inputProps.id}
    />
  );
};
