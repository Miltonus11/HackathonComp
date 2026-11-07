import { clampMood, moodEmoji, shouldShowMoodGate, toSubmission } from '@/domain/mood';

describe('clampMood', () => {
  it('rounds and keeps 1..10', () => {
    expect(clampMood(0)).toBe(1);
    expect(clampMood(11)).toBe(10);
    expect(clampMood(6.4)).toBe(6);
    expect(clampMood(6.5)).toBe(7);
    expect(clampMood(NaN)).toBe(5);
  });
});

describe('toSubmission', () => {
  it('omits the reason when none is picked', () => {
    expect(toSubmission(7, null)).toEqual({ mood_score: 7 });
  });
  it('includes the reason when picked', () => {
    expect(toSubmission(3, 'SLEEP')).toEqual({ mood_score: 3, reason_code: 'SLEEP' });
  });
});

describe('shouldShowMoodGate', () => {
  it('never shows when logged or still unknown', () => {
    for (const where of ['home', 'journal'] as const) {
      expect(shouldShowMoodGate({ where, logged: true, onboardingCompleted: true })).toBe(false);
      expect(shouldShowMoodGate({ where, logged: null, onboardingCompleted: true })).toBe(false);
    }
  });
  it('journal always shows when not logged, even for a first-timer', () => {
    expect(shouldShowMoodGate({ where: 'journal', logged: false, onboardingCompleted: false })).toBe(true);
  });
  it('home shows only after onboarding is complete', () => {
    expect(shouldShowMoodGate({ where: 'home', logged: false, onboardingCompleted: false })).toBe(false);
    expect(shouldShowMoodGate({ where: 'home', logged: false, onboardingCompleted: true })).toBe(true);
  });
});

describe('moodEmoji', () => {
  it('has a different face at each end and stays in range', () => {
    expect(moodEmoji(1)).not.toBe(moodEmoji(10));
    expect(moodEmoji(0)).toBe(moodEmoji(1));
    expect(moodEmoji(99)).toBe(moodEmoji(10));
  });
});
