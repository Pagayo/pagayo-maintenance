/**
 * Locale-aware datetime input (datetime-local string in/out).
 *
 * @module client/components/DateTimeInput
 */

import { FunctionalComponent, JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useI18n } from "../i18n";
import { useDateLocale, type UseDateLocaleOptions } from "../hooks/useDateLocale";
import {
  joinDateTimeLocal,
  splitDateTimeLocal,
} from "../utils/datetime";
import { DateInput } from "./DateInput";

type NativeWrapperProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "onInput" | "onChange"
>;

export interface DateTimeInputProps extends NativeWrapperProps {
  /** datetime-local value: YYYY-MM-DDTHH:mm */
  value: string;
  onValueChange: (value: string) => void;
  /** Called on blur after a valid datetime is committed. */
  onCommit?: (value: string) => void;
  error?: boolean | string;
  localeOptions?: UseDateLocaleOptions;
  dateClassName?: string;
  timeClassName?: string;
  disabled?: boolean;
  id?: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function normalizeTimeInput(time: string): string | null {
  const trimmed = time.trim();
  if (!trimmed) {
    return "00:00";
  }

  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${pad2(hours)}:${pad2(minutes)}`;
}

export const DateTimeInput: FunctionalComponent<DateTimeInputProps> = ({
  value,
  onValueChange,
  onCommit,
  error = false,
  localeOptions,
  className = "",
  dateClassName = "",
  timeClassName = "",
  disabled = false,
  id,
}) => {
  const { t } = useI18n();
  const { intlLocale } = useDateLocale(localeOptions);
  const [dateIso, setDateIso] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const isEditingRef = useRef(false);
  /** Refs stay in sync for blur commits — parent state updates are async. */
  const dateIsoRef = useRef("");
  const timeValueRef = useRef("");

  useEffect(() => {
    if (isEditingRef.current) {
      return;
    }
    const parts = splitDateTimeLocal(value, intlLocale);
    dateIsoRef.current = parts.dateIso;
    timeValueRef.current = parts.time;
    setDateIso(parts.dateIso);
    setTimeValue(parts.time);
  }, [value, intlLocale]);

  const buildJoinedValue = (nextDate: string, nextTime: string): string | null => {
    if (!nextDate.trim() && !nextTime.trim()) {
      return "";
    }
    const normalizedTime = normalizeTimeInput(nextTime);
    if (!normalizedTime) {
      return null;
    }
    return joinDateTimeLocal(nextDate.trim(), normalizedTime);
  };

  const emitChange = (nextDate: string, nextTime: string) => {
    const joined = buildJoinedValue(nextDate, nextTime);
    if (joined === "") {
      onValueChange("");
      return;
    }
    if (joined) {
      onValueChange(joined);
    }
  };

  const commitChange = (nextDate: string, nextTime: string) => {
    const normalizedTime = normalizeTimeInput(nextTime);
    const effectiveTime = normalizedTime ?? nextTime;
    if (normalizedTime) {
      timeValueRef.current = normalizedTime;
      setTimeValue(normalizedTime);
    }

    const joined = buildJoinedValue(nextDate, effectiveTime);
    if (joined === "") {
      onValueChange("");
      onCommit?.("");
      return;
    }
    if (joined) {
      onValueChange(joined);
      onCommit?.(joined);
    }
  };

  const timeInvalid =
    timeValue.trim() !== "" && normalizeTimeInput(timeValue) === null;
  const hasError = Boolean(error) || timeInvalid;
  const resolvedErrorMessage =
    typeof error === "string"
      ? error
      : timeInvalid
        ? t("common.timeInvalid")
        : undefined;

  const timeClasses = [
    "form-input",
    timeInvalid ? "form-input--error input--error" : "",
    timeClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={["date-time-input", className].filter(Boolean).join(" ")}
      data-testid="datetime-input"
    >
      <DateInput
        id={id ? `${id}-date` : undefined}
        value={dateIso}
        onFocus={() => {
          isEditingRef.current = true;
        }}
        onValueChange={(iso) => {
          dateIsoRef.current = iso;
          setDateIso(iso);
          emitChange(iso, timeValueRef.current);
        }}
        onBlur={() => {
          commitChange(dateIsoRef.current, timeValueRef.current);
          isEditingRef.current = false;
        }}
        disabled={disabled}
        className={dateClassName}
        localeOptions={localeOptions}
      />
      <input
        id={id ? `${id}-time` : undefined}
        type="text"
        inputMode="numeric"
        className={timeClasses}
        value={timeValue}
        disabled={disabled}
        placeholder={t("common.timePlaceholder")}
        aria-invalid={timeInvalid ? true : undefined}
        data-testid="datetime-time-input"
        onFocus={() => {
          isEditingRef.current = true;
        }}
        onInput={(event) => {
          const nextTime = event.currentTarget.value;
          timeValueRef.current = nextTime;
          setTimeValue(nextTime);
          emitChange(dateIsoRef.current, nextTime);
        }}
        onBlur={() => {
          commitChange(dateIsoRef.current, timeValueRef.current);
          isEditingRef.current = false;
        }}
      />
      {hasError && resolvedErrorMessage && (
        <small className="form-helper form-helper--error" role="alert">
          {resolvedErrorMessage}
        </small>
      )}
    </div>
  );
};
