import { gentleAdvice } from "../gentle-results";

const advice = (suggested_action: string) => ({
  headline: 'Signs of severe anxiety',
  message: 'Your responses suggest severe signs of anxiety.',
  suggested_action,
});

describe('gentleAdvice', () => {
  it.each(['MONITOR', 'SELF_CARE', 'CONSIDER_PROFESSIONAL', 'PRIORITY_REFERRAL'])(
    '%s never shows severity wording, in either language',
    (action) => {
      for (const lang of ['en', 'fil'] as const) {
        const m = gentleAdvice(advice(action), lang)!;
        expect(m.headline).not.toMatch(/sever|signs of|significant/i);
        expect(m.message).not.toMatch(/sever|signs of|significant/i);
      }
    },
  );

  it('keeps the server wording for crisis support', () => {
    const a = { headline: 'Thank you for telling us', message: 'You deserve support.', suggested_action: 'CRISIS_SUPPORT' };
    expect(gentleAdvice(a, 'en')).toEqual({ headline: a.headline, message: a.message });
  });

  it('returns null without advice', () => {
    expect(gentleAdvice(null, 'en')).toBeNull();
  });
});