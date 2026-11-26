"use client";

import { formatRelativeTime, formatTimestamp, resolveLocale } from "./format";
import { useNow } from "./presentation";

/**
 * Provider-free relative-time component.
 *
 * `locale` and `timeZone` are both optional; when omitted, they fall back
 * to the browser defaults (navigator.language and Intl.DateTimeFormat's
 * resolved timeZone respectively). Hosts that want to pin a locale (e.g.
 * next-intl's resolved locale) pass it through the prop.
 */
export function RelativeTime({
  value,
  className,
  locale,
  timeZone,
  title,
}: {
  value: string;
  className?: string;
  /** Overrides the default navigator.language locale. */
  locale?: string;
  /** Overrides the browser's resolved time zone. */
  timeZone?: string;
  /** Overrides the hover-visible absolute timestamp; passed through to HTML <time>.title. */
  title?: string;
}) {
  const resolvedLocale = resolveLocale(locale);
  const now = useNow(60_000);
  return (
    <time
      dateTime={value}
      title={title ?? formatTimestamp(value, resolvedLocale, "medium", timeZone)}
      className={className}
    >
      {formatRelativeTime(value, resolvedLocale, now)}
    </time>
  );
}
