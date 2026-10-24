import { todayIST } from './dates.js';

describe('todayIST', () => {
  it('uses India time, which is ahead of UTC', () => {
    // 20:00 UTC on 31 Dec is 01:30 IST on 1 Jan.
    expect(todayIST(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
    expect(todayIST(new Date('2026-12-31T10:00:00Z'))).toBe('2026-12-31');
  });
});
