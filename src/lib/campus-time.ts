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
