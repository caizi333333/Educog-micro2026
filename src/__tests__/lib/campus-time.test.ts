import { CAMPUS_TIME_ZONE, formatCampusDate, formatCampusDateTime } from '@/lib/campus-time';

describe('campus time', () => {
  // 2026-10-26 17:02:53Z is 2026-10-27 01:02:53 in Asia/Shanghai
  // and 2026-10-26 10:02:53 in America/Los_Angeles (PDT, UTC-7).
  const pacificInstant = '2026-10-26T17:02:53.000Z';

  it('formats student timestamps in Asia/Shanghai, not the runtime zone', () => {
    expect(CAMPUS_TIME_ZONE).toBe('Asia/Shanghai');
    expect(formatCampusDateTime(pacificInstant)).toBe('2026/10/27 01:02:53');
    expect(formatCampusDate(pacificInstant)).toBe('2026/10/27');
  });

  it('does not invent a clock for a missing or invalid value', () => {
    expect(formatCampusDateTime(null)).toBe('时间待核实');
    expect(formatCampusDateTime('not-a-date')).toBe('时间待核实');
    expect(formatCampusDate(undefined)).toBe('时间待核实');
  });
});
