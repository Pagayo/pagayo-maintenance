import { useEffect, useState } from "preact/hooks";

interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

interface Modal {
  id: string;
  component: string;
  props?: Record<string, unknown>;
}

interface UIState {
  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;

  // Modals
  modals: Modal[];
  openModal: (modal: Omit<Modal, "id">) => void;
  closeModal: (id?: string) => void;

  // Global loading
  isPageLoading: boolean;
  setPageLoading: (loading: boolean) => void;

  // Mobile menu
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;

  // Autosave status (shown in navbar)
  autosaveStatus: "idle" | "saving" | "saved" | "error";
  autosaveError: string | null;
  setAutosaving: () => void;
  setAutosaved: () => void;
  setAutosaveError: (message: string) => void;
  clearAutosave: () => void;

  // Navbar notification (central notification in navbar bar)
  navNotification: {
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null;
  showNavNotification: (
    type: "success" | "error" | "warning" | "info",
    message: string,
    duration?: number,
  ) => void;
  clearNavNotification: () => void;
}

let toastId = 0;
let modalId = 0;

type Listener = () => void;
type UIStoreSelector<T> = (current: UIState) => T;
type UseUIStore = {
  (): UIState;
  <T>(selector: UIStoreSelector<T>): T;
  getState: () => UIState;
  setState: (
    partial: Partial<UIState> | ((current: UIState) => Partial<UIState>),
  ) => void;
  subscribe: (listener: Listener) => () => void;
};

const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

let state: UIState;

function setState(
  partial: Partial<UIState> | ((current: UIState) => Partial<UIState>),
): void {
  const nextPartial = typeof partial === "function" ? partial(state) : partial;
  state = { ...state, ...nextPartial };
  notify();
}

function createState(): UIState {
  return {
    // Toasts
    toasts: [],
    addToast: (toast) => {
      const id = `toast-${++toastId}`;
      setState((current) => ({
        toasts: [...current.toasts, { ...toast, id }],
      }));

      const duration = toast.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => {
          setState((current) => ({
            toasts: current.toasts.filter((t) => t.id !== id),
          }));
        }, duration);
      }
    },
    removeToast: (id) =>
      setState((current) => ({
        toasts: current.toasts.filter((t) => t.id !== id),
      })),

    // Modals
    modals: [],
    openModal: (modal) => {
      const id = `modal-${++modalId}`;
      setState((current) => ({
        modals: [...current.modals, { ...modal, id }],
      }));
    },
    closeModal: (id) =>
      setState((current) => ({
        modals: id
          ? current.modals.filter((m) => m.id !== id)
          : current.modals.slice(0, -1),
      })),

    // Global loading
    isPageLoading: false,
    setPageLoading: (loading) => setState({ isPageLoading: loading }),

    // Mobile menu
    isMobileMenuOpen: false,
    toggleMobileMenu: () =>
      setState((current) => ({
        isMobileMenuOpen: !current.isMobileMenuOpen,
      })),
    closeMobileMenu: () => setState({ isMobileMenuOpen: false }),

    // Autosave
    autosaveStatus: "idle",
    autosaveError: null,
    setAutosaving: () =>
      setState({ autosaveStatus: "saving", autosaveError: null }),
    setAutosaved: () => {
      setState({ autosaveStatus: "saved", autosaveError: null });
      setTimeout(() => {
        setState((current) =>
          current.autosaveStatus === "saved" ? { autosaveStatus: "idle" } : {},
        );
      }, 2000);
    },
    setAutosaveError: (message) =>
      setState({ autosaveStatus: "error", autosaveError: message }),
    clearAutosave: () =>
      setState({ autosaveStatus: "idle", autosaveError: null }),

    // Navbar notification
    navNotification: null,
    showNavNotification: (type, message, duration = 5000) => {
      setState({ navNotification: { type, message } });
      if (duration > 0) {
        setTimeout(() => {
          setState((current) =>
            current.navNotification?.message === message
              ? { navNotification: null }
              : {},
          );
        }, duration);
      }
    },
    clearNavNotification: () => setState({ navNotification: null }),
  };
}

state = createState();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const identitySelector: UIStoreSelector<UIState> = (current) => current;

const useUIStore = Object.assign(
  function <T>(selector?: UIStoreSelector<T>): T | UIState {
    const select = (selector ?? identitySelector) as UIStoreSelector<
      T | UIState
    >;
    const [selected, setSelected] = useState(() => select(state));

    useEffect(() => {
      const update = (): void => {
        const nextSelected = select(state);
        setSelected((current) =>
          Object.is(current, nextSelected) ? current : nextSelected,
        );
      };

      const unsubscribe = subscribe(update);
      update();
      return unsubscribe;
    }, [select]);

    return selected;
  },
  {
    getState: (): UIState => state,
    setState: (
      partial: Partial<UIState> | ((current: UIState) => Partial<UIState>),
    ) => setState(partial),
    subscribe,
  },
) as UseUIStore;

export { useUIStore };
