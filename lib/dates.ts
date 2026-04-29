// Date helpers. All scheduling rolls through here so the timezone math has one
// owner. Mother's Day 2026 = Sunday, May 10 (second Sunday).

export const DELIVERY_DATES = [
  '2026-05-04', // Day 1
  '2026-05-05', // Day 2
  '2026-05-06', // Day 3
  '2026-05-07', // Day 4
  '2026-05-08', // Day 5
  '2026-05-09', // Day 6
  '2026-05-10', // Day 7 — Mother's Day morning
] as const;

export const EDIT_CLOSE_DATE = '2026-05-03';     // 23:59 user-local
export const HUNT_REMINDER_DATE = '2026-05-09';  // 18:00 user-local — sent night before
export const HUNT_DAY = '2026-05-10';            // Mother's Day; user texts link to mom

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
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7,
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
