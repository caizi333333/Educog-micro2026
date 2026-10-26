/**
 * Campus clock for student-facing timestamps.
 *
 * The teaching site is a China campus. Display times in Asia/Shanghai
 * (UTC+8, no daylight saving) regardless of the browser or server timezone.
 * Do not call `toLocaleString` / `toLocaleDateString` without `timeZone`
 * for student-visible dates — that follows the runtime zone and has rendered
 * Pacific time on production.
 */

export const CAMPUS_TIME_ZONE = 'Asia/Shanghai';

export const CAMPUS_TIME_LABEL = '北京时间';

const campusDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: CAMPUS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const campusDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: CAMPUS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function asDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format an instant as `YYYY/MM/DD HH:mm:ss` in Asia/Shanghai.
 * Returns `时间待核实` when the value is missing or not a real timestamp.
 */
export function formatCampusDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '时间待核实';
  const date = asDate(value);
  if (!date) return '时间待核实';
  return campusDateTimeFormatter.format(date);
}

/**
 * Format a calendar day in Asia/Shanghai. Near midnight this can differ from
 * the viewer's local date; the campus day is the one students should see.
 */
export function formatCampusDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '时间待核实';
  const date = asDate(value);
  if (!date) return '时间待核实';
  return campusDateFormatter.format(date);
}

/**
 * Calendar day key (`YYYY-MM-DD`) in Asia/Shanghai.
 * Use this for streak and daily-login identity. `toISOString().slice(0, 10)`
 * is the UTC day and disagrees with the campus day near midnight.
 */
export function campusDateKey(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

/** Shift a `YYYY-MM-DD` campus day key by a whole number of calendar days. */
export function shiftCampusDateKey(dateKey: string, dayOffset: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day + dayOffset)).toISOString().slice(0, 10);
}

/** Hour of the day, 0–23, in Asia/Shanghai. */
export function campusHour(value: Date): number {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPUS_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(value));
  return Number.isFinite(hour) ? hour % 24 : 0;
}
