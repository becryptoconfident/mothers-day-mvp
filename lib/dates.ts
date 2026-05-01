// Date helpers. All scheduling rolls through here so the timezone math has one
// owner. Mother's Day 2026 = Sunday, May 10 (second Sunday).

export const DELIVERY_DATES = [
  '2026-05-08', // Message 1 — Friday (the memory)
  '2026-05-09', // Message 2 — Saturday (the thing she does)
  '2026-05-10', // Message 3 — Sunday, Mother's Day morning (the unsaid thing)
] as const;

export const EDIT_CLOSE_DATE = '2026-05-07';     // 23:59 user-local — day before first send
export const HUNT_REMINDER_DATE = '2026-05-09';  // legacy, hunt feature retired
export const HUNT_DAY = '2026-05-10';            // legacy, hunt feature retired

/**
 * Convert "YYYY-MM-DD" + "HH:MM" + IANA timezone → ISO UTC string.
 * Uses Intl to compute the offset for that wall-clock moment in that zone.
 */
export function localToUTC(dateStr: string, timeStr: string, ianaTz: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);

  // Build a UTC date with those wall-clock numbers, then ask Intl what THAT
  // moment looks like in the target zone, and compute the delta to correct.
  const naiveUTC = Date.UTC(y, mo - 1, d, h, mi, 0);
  const probe = new Date(naiveUTC);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(probe).map((p) => [p.type, p.value]));
  const interpretedUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    0,
  );
  const offset = interpretedUTC - naiveUTC;
  return new Date(naiveUTC - offset).toISOString();
}

export function deliveryISOForDay(
  day: 1 | 2 | 3,
  timeStr: string,
  ianaTz: string,
): string {
  return localToUTC(DELIVERY_DATES[day - 1], timeStr, ianaTz);
}

export function isEditWindowOpen(ianaTz: string, now: Date = new Date()): boolean {
  const closeUTC = localToUTC(EDIT_CLOSE_DATE, '23:59', ianaTz);
  return now.toISOString() < closeUTC;
}

/** Adds st/nd/rd/th to a day-of-month number. */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** "09:00" → "9am". "13:30" → "1:30pm". "00:00" → "12am". Bad input → returned as-is. */
export function formatTime12(hhmm: string): string {
  const [hStr, mStr] = (hhmm || '').split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

/** Friendly e.g. "Monday, May 4th" */
export function formatHumanDate(isoDate: string, ianaTz: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: ianaTz,
  });
  const parts = fmt.formatToParts(new Date(isoDate));
  return parts
    .map((p) => (p.type === 'day' ? ordinal(Number(p.value)) : p.value))
    .join('');
}
