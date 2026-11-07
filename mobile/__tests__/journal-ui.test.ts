import { formatDay, formatPhTime, getJournalUi } from '@/content/journal-ui';

describe('journal text', () => {
  it('has every string in both languages', () => {
    const en = getJournalUi('en');
    const fil = getJournalUi('fil');
    expect(Object.keys(fil).sort()).toEqual(Object.keys(en).sort());
    for (const ui of [en, fil]) {
      for (const [key, value] of Object.entries(ui)) {
        if (typeof value === 'string') expect(`${key}:${value.trim()}`).not.toBe(`${key}:`);
      }
      expect(ui.weekdays).toHaveLength(7);
      expect(ui.months).toHaveLength(12);
    }
  });

  it('formats a day without the device time zone', () => {
    expect(formatDay(getJournalUi('en'), '2026-11-07')).toBe('Sat, Nov 7, 2026');
    expect(formatDay(getJournalUi('fil'), '2026-11-07')).toBe('Sab, Nob 7, 2026');
  });

  it('shows the time in Philippine time', () => {
    expect(formatPhTime('2026-11-07T07:05:00Z')).toBe('3:05 PM');
    expect(formatPhTime('2026-11-07T16:00:00Z')).toBe('12:00 AM');
    expect(formatPhTime('nope')).toBe('');
  });
});
