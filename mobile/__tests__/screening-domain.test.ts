import {
  assessmentStatus,
  findResumable,
  isFormComplete,
  localCrisisCheck,
  optionLabel,
  shouldAutoStartAssessment,
  type Form,
  type SessionSummary,
} from '@/domain/screening';

const form = (over: Partial<Form> = {}): Form => ({
  instrument: 'WHO5',
  name: 'WHO-5',
  recall_period_days: 14,
  min_response: 0,
  max_response: 5,
  options: ['At no time', 'Some', 'Less than half', 'More than half', 'Most', 'All'],
  items: [1, 2, 3, 4, 5].map((n) => ({ item_no: n, text: `item ${n}` })),
  ...over,
});

describe('localCrisisCheck (safety net, mirrors the server rule)', () => {
  it('PHQ9 item 9 above 0 is a crisis even when everything else is 0', () => {
    const answers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 1 };
    expect(localCrisisCheck('PHQ9', answers)).toBe(true);
    expect(localCrisisCheck('PHQ9', { ...answers, 9: 0 })).toBe(false);
  });
  it('PHQ9_ITEM9 asked alone: item 1 above 0 is a crisis', () => {
    expect(localCrisisCheck('PHQ9_ITEM9', { 1: 3 })).toBe(true);
    expect(localCrisisCheck('PHQ9_ITEM9', { 1: 0 })).toBe(false);
  });
  it('WHO5 scaled score (raw x 4) of 28 or lower is a crisis', () => {
    expect(localCrisisCheck('WHO5', { 1: 2, 2: 1, 3: 1, 4: 2, 5: 1 })).toBe(true); // raw 7 -> 28
    expect(localCrisisCheck('WHO5', { 1: 2, 2: 2, 3: 1, 4: 2, 5: 1 })).toBe(false); // raw 8 -> 32
  });
  it('GAD7 never triggers the local rule', () => {
    expect(localCrisisCheck('GAD7', { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 })).toBe(false);
  });
});

describe('optionLabel', () => {
  it('maps a value to options[value - min_response]', () => {
    expect(optionLabel(form(), 0)).toBe('At no time');
    expect(optionLabel(form(), 5)).toBe('All');
    expect(optionLabel(form({ min_response: 1, max_response: 2, options: ['a', 'b'] }), 2)).toBe('b');
  });
  it('returns an empty string for out-of-range values', () => {
    expect(optionLabel(form(), 9)).toBe('');
  });
});

describe('isFormComplete', () => {
  it('requires every item answered with an in-range value', () => {
    expect(isFormComplete(form(), { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 })).toBe(true);
    expect(isFormComplete(form(), { 1: 0, 2: 1, 3: 2, 4: 3 })).toBe(false);
    expect(isFormComplete(form(), { 1: 0, 2: 1, 3: 2, 4: 3, 5: 6 })).toBe(false);
  });
});

describe('shouldAutoStartAssessment', () => {
  it('is true only when onboarding is not completed and the prompt was not dismissed', () => {
    expect(shouldAutoStartAssessment({ onboardingCompletedAt: null, dismissedThisSession: false })).toBe(true);
    expect(shouldAutoStartAssessment({ onboardingCompletedAt: null, dismissedThisSession: true })).toBe(false);
    expect(
      shouldAutoStartAssessment({ onboardingCompletedAt: '2026-11-07T00:00:00Z', dismissedThisSession: false }),
    ).toBe(false);
  });
});

describe('findResumable', () => {
  const s = (id: string, completed: string | null): SessionSummary => ({
    session_id: id,
    started_at: '2026-11-07T00:00:00Z',
    completed_at: completed,
    crisis_shown: false,
    results: [],
  });
  it('returns the newest unfinished session, ignoring completed ones', () => {
    expect(findResumable([s('c', '2026-11-07T01:00:00Z'), s('b', null), s('a', null)])?.session_id).toBe('b');
    expect(findResumable([s('c', '2026-11-07T01:00:00Z')])).toBeNull();
    expect(findResumable([])).toBeNull();
  });
});

describe('assessmentStatus (drives the Home card)', () => {
  const s = (id: string, completed: string | null): SessionSummary => ({
    session_id: id,
    started_at: '2026-11-07T00:00:00Z',
    completed_at: completed,
    crisis_shown: false,
    results: [],
  });
  it('none when there are no sessions', () => {
    expect(assessmentStatus([])).toEqual({ kind: 'none' });
  });
  it('unfinished wins, even if an older session was completed', () => {
    expect(assessmentStatus([s('new', null), s('old', '2026-11-01T00:00:00Z')])).toEqual({
      kind: 'unfinished',
      session: expect.objectContaining({ session_id: 'new' }),
    });
  });
  it('done reports the newest completed session', () => {
    const out = assessmentStatus([s('b', '2026-11-07T00:00:00Z'), s('a', '2026-11-01T00:00:00Z')]);
    expect(out).toEqual({ kind: 'done', last: expect.objectContaining({ session_id: 'b' }) });
  });
});
