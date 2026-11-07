import {
  addDays,
  buildDays,
  canWriteToday,
  checkBody,
  daysBetween,
  findSavedEntry,
  MAX_JOURNAL_CHARS,
  phDate,
  phToday,
  type JournalEntry,
} from '@/domain/journal';

const entry = (id: string, written_at: string, body = 'hello'): JournalEntry => ({
  entry_id: id,
  written_at,
  prompt_text: null,
  body,
  reflection: null,
});

describe('Philippine days', () => {
  it('turns a UTC timestamp into the Philippine calendar day', () => {
    expect(phDate('2026-11-07T15:59:59Z')).toBe('2026-11-07'); // 23:59:59 in Manila
    expect(phDate('2026-11-07T16:00:00Z')).toBe('2026-11-08'); // midnight in Manila
    expect(phDate('2026-11-08T07:30:00+08:00')).toBe('2026-11-08');
  });

  it('returns null for missing or broken timestamps', () => {
    expect(phDate(null)).toBeNull();
    expect(phDate('')).toBeNull();
    expect(phDate('not a date')).toBeNull();
  });

  it('works out today from a clock reading', () => {
    expect(phToday(new Date('2026-11-07T20:00:00Z'))).toBe('2026-11-08');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysBetween('2026-11-01', '2026-11-07')).toBe(6);
  });
});

describe('buildDays', () => {
  it('makes one page per day from today back to registration, empty days included', () => {
    const days = buildDays({
      today: '2026-11-07',
      registeredOn: '2026-11-04',
      entries: [entry('a', '2026-11-06T02:00:00Z'), entry('b', '2026-11-04T01:00:00Z')],
    });
    expect(days.map((d) => d.date)).toEqual(['2026-11-07', '2026-11-06', '2026-11-05', '2026-11-04']);
    expect(days.map((d) => d.entries.map((e) => e.entry_id))).toEqual([[], ['a'], [], ['b']]);
    expect(days[0].isToday).toBe(true);
    expect(days.slice(1).every((d) => !d.isToday)).toBe(true);
  });

  it('gives a first-day user just today', () => {
    const days = buildDays({ today: '2026-11-07', registeredOn: '2026-11-07', entries: [] });
    expect(days).toHaveLength(1);
    expect(canWriteToday(days)).toBe(true);
  });

  it('places an entry written late at night (UTC) on the right Philippine day', () => {
    const days = buildDays({
      today: '2026-11-08',
      registeredOn: '2026-11-07',
      entries: [entry('late', '2026-11-07T17:00:00Z')], // 01:00 on the 8th in Manila
    });
    expect(days[0].entries.map((e) => e.entry_id)).toEqual(['late']);
    expect(days[1].entries).toEqual([]);
  });

  it('keeps every entry on a day, newest first', () => {
    const days = buildDays({
      today: '2026-11-07',
      registeredOn: '2026-11-07',
      entries: [entry('older', '2026-11-07T01:00:00Z'), entry('newer', '2026-11-07T05:00:00Z')],
    });
    expect(days[0].entries.map((e) => e.entry_id)).toEqual(['newer', 'older']);
    expect(canWriteToday(days)).toBe(false);
  });

  it('extends back to an entry older than the registration day instead of dropping it', () => {
    const days = buildDays({
      today: '2026-11-07',
      registeredOn: '2026-11-06',
      entries: [entry('old', '2026-11-04T03:00:00Z')],
    });
    expect(days).toHaveLength(4);
    expect(days[3].entries.map((e) => e.entry_id)).toEqual(['old']);
  });

  it('copes with a registration date after today or missing', () => {
    expect(buildDays({ today: '2026-11-07', registeredOn: '2026-11-09', entries: [] })).toHaveLength(1);
    expect(buildDays({ today: '2026-11-07', registeredOn: null, entries: [] })).toHaveLength(1);
  });

  it('ignores entries dated after today', () => {
    const days = buildDays({ today: '2026-11-07', registeredOn: '2026-11-07', entries: [entry('f', '2026-11-09T00:00:00Z')] });
    expect(days).toHaveLength(1);
    expect(days[0].entries).toEqual([]);
  });
});

describe('checkBody', () => {
  it('rejects blank text, like the server', () => {
    expect(checkBody('')).toBe('EMPTY');
    expect(checkBody('   \n ')).toBe('EMPTY');
  });

  it('allows up to the limit after trimming', () => {
    expect(checkBody('x'.repeat(MAX_JOURNAL_CHARS))).toBeNull();
    expect(checkBody(`  ${'x'.repeat(MAX_JOURNAL_CHARS)}  `)).toBeNull();
    expect(checkBody('x'.repeat(MAX_JOURNAL_CHARS + 1))).toBe('TOO_LONG');
  });
});

describe('findSavedEntry', () => {
  const today = '2026-11-07';
  it('finds today’s entry with the same (trimmed) text', () => {
    const list = [entry('x', '2026-11-07T03:00:00Z', 'my day')];
    expect(findSavedEntry(list, '  my day \n', today)?.entry_id).toBe('x');
  });

  it('does not match other text or other days', () => {
    expect(findSavedEntry([entry('x', '2026-11-07T03:00:00Z', 'other')], 'my day', today)).toBeNull();
    expect(findSavedEntry([entry('x', '2026-11-05T03:00:00Z', 'my day')], 'my day', today)).toBeNull();
  });
});
