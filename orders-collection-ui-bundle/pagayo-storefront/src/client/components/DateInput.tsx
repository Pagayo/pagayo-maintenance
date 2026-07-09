/**
 * Locale-aware date input (ISO YYYY-MM-DD in/out).
 *
 * @module client/components/DateInput
 */

import { FunctionalComponent, JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useI18n } from "../i18n";
import { useDateLocale, type UseDateLocaleOptions } from "../hooks/useDateLocale";
import {
  formatDateForInput,
  formatDateInputFromDigits,
  parseDateInput,
} from "../utils/datetime";

function usePrefersNativeDateInput(): boolean {
  const [prefersNative, setPrefersNative] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const coarseQuery = window.matchMedia("(pointer: coarse)");
    const update = () => {
      setPrefersNative(coarseQuery.matches);
    };

    update();
    coarseQuery.addEventListener("change", update);
    return () => {
      coarseQuery.removeEventListener("change", update);
    };
  }, []);

  return prefersNative;
}

type NativeInputProps = Omit<
  JSX.HTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onInput" | "onChange" | "onBlur" | "onFocus"
>;

export interface DateInputProps extends NativeInputProps {
  /** ISO date YYYY-MM-DD */
  value: string;
  onValueChange: (iso: string) => void;
  onBlur?: (event: JSX.TargetedEvent<HTMLInputElement>) => void;
  onFocus?: (event: JSX.TargetedEvent<HTMLInputElement>) => void;
  error?: boolean | string;
  localeOptions?: UseDateLocaleOptions;
  showFormatHint?: boolean;
  /**
   * Native calendar picker (value stays ISO YYYY-MM-DD).
   * Use when a specific calendar day must be easy to pick (e.g. dashboard overrides).
   */
  useNativePicker?: boolean;
  /** When false, never auto-switch to native picker on touch devices. Default true. */
  nativeOnTouch?: boolean;
  /** Optional ISO min/max for native picker only (YYYY-MM-DD). */
  minIso?: string;
  maxIso?: string;
}

export const DateInput: FunctionalComponent<DateInputProps> = ({
  value,
  onValueChange,
  onBlur,
  onFocus,
  error = false,
  localeOptions,
  showFormatHint = false,
  useNativePicker = false,
  nativeOnTouch = true,
  minIso,
  maxIso,
  className = "",
  disabled = false,
  id,
  required,
  "aria-label": ariaLabel,
  ...inputProps
}) => {
  const { t } = useI18n();
  const { intlLocale, pattern } = useDateLocale(localeOptions);
  const prefersNativeDateInput = usePrefersNativeDateInput();
  const useNativeDatePicker =
    useNativePicker || (nativeOnTouch && prefersNativeDateInput);
  const isFocusedRef = useRef(false);
  const [displayValue, setDisplayValue] = useState(() =>
    formatDateForInput(value, intlLocale),
  );
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isFocusedRef.current) {
      return;
    }
    setDisplayValue(formatDateForInput(value, intlLocale));
  }, [value, intlLocale]);

  const parsedDisplay = parseDateInput(displayValue, intlLocale);
  const invalidAfterBlur =
    touched && displayValue.trim() !== "" && parsedDisplay === null;
  const hasError = Boolean(error) || invalidAfterBlur;
  const resolvedErrorMessage =
    typeof error === "string"
      ? error
      : invalidAfterBlur
        ? t("common.dateInvalid")
        : undefined;

  const commitDisplay = useCallback(
    (nextDisplay: string) => {
      const formatted = formatDateInputFromDigits(nextDisplay, intlLocale);
      setDisplayValue(formatted);

      if (!formatted.trim()) {
        onValueChange("");
        return;
      }

      const iso = parseDateInput(formatted, intlLocale);
      if (iso) {
        onValueChange(iso);
      }
    },
    [intlLocale, onValueChange],
  );

  const inputClasses = [
    "form-input",
    hasError ? "form-input--error input--error" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (useNativeDatePicker) {
    return (
      <>
        <input
          {...inputProps}
          id={id}
          type="date"
          className={inputClasses}
          value={value}
          min={minIso}
          max={maxIso}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          aria-invalid={hasError ? true : undefined}
          data-testid="date-input"
          onFocus={onFocus}
          onBlur={onBlur}
          onInput={(event) => {
            onValueChange(event.currentTarget.value);
          }}
        />
        {hasError && resolvedErrorMessage && (
          <small className="form-helper form-helper--error" role="alert">
            {resolvedErrorMessage}
          </small>
        )}
      </>
    );
  }

  return (
    <>
      <input
        {...inputProps}
        id={id}
        type="text"
        inputMode="numeric"
        lang={intlLocale}
        className={inputClasses}
        value={displayValue}
        placeholder={pattern.placeholder}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={hasError ? true : undefined}
        data-testid="date-input"
        onFocus={(event) => {
          isFocusedRef.current = true;
          onFocus?.(event);
        }}
        onInput={(event) => {
          commitDisplay(event.currentTarget.value);
        }}
        onBlur={(event) => {
          isFocusedRef.current = false;
          setTouched(true);

          const currentDisplay = event.currentTarget.value;
          const trimmed = currentDisplay.trim();
          if (!trimmed) {
            onValueChange("");
            setDisplayValue("");
          } else {
            const iso = parseDateInput(currentDisplay, intlLocale);
            if (iso) {
              setDisplayValue(formatDateForInput(iso, intlLocale));
              onValueChange(iso);
            } else {
              setDisplayValue(formatDateForInput(value, intlLocale));
            }
          }

          onBlur?.(event);
        }}
      />
      {showFormatHint && !hasError && (
        <small className="form-helper">
          {t("common.dateFormatHint", { format: pattern.placeholder })}
        </small>
      )}
      {hasError && resolvedErrorMessage && (
        <small className="form-helper form-helper--error" role="alert">
          {resolvedErrorMessage}
        </small>
      )}
    </>
  );
};
