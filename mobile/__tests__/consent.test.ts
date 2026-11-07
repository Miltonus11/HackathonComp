import {
  appendConsent,
  currentConsent,
  hasRequiredConsent,
  type ConsentRecord,
} from '@/domain/consent';

const base = { user_id: 'u1', notice_version: 'v1', language_code: 'en' as const };
const add = (ledger: ConsentRecord[], type: ConsentRecord['consent_type'], granted: boolean, user = 'u1') =>
  appendConsent(ledger, { ...base, user_id: user, consent_type: type, granted });

describe('consent ledger', () => {
  it('is false for an empty ledger', () => {
    expect(currentConsent([], 'u1', 'APP_USE')).toBe(false);
    expect(hasRequiredConsent([], 'u1')).toBe(false);
  });

  it('grant makes it current', () => {
    const l = add([], 'AI_ANALYSIS', true);
    expect(currentConsent(l, 'u1', 'AI_ANALYSIS')).toBe(true);
  });

  it('withdraw appends a row (insert-only) and flips current to false', () => {
    const granted = add([], 'AI_ANALYSIS', true);
    const withdrawn = add(granted, 'AI_ANALYSIS', false);
    expect(withdrawn).toHaveLength(2);
    expect(withdrawn[0]).toEqual(granted[0]);
    expect(currentConsent(withdrawn, 'u1', 'AI_ANALYSIS')).toBe(false);
  });

  it('latest row wins on grant → withdraw → re-grant', () => {
    let l = add([], 'PROFESSIONAL_SHARING', true);
    l = add(l, 'PROFESSIONAL_SHARING', false);
    l = add(l, 'PROFESSIONAL_SHARING', true);
    expect(currentConsent(l, 'u1', 'PROFESSIONAL_SHARING')).toBe(true);
    expect(l).toHaveLength(3);
  });

  it('latest wins even when rows share the same timestamp', () => {
    const now = new Date('2026-11-07T00:00:00Z');
    let l = appendConsent([], { ...base, consent_type: 'APP_USE', granted: true }, now);
    l = appendConsent(l, { ...base, consent_type: 'APP_USE', granted: false }, now);
    expect(currentConsent(l, 'u1', 'APP_USE')).toBe(false);
  });

  it('ignores other users and other types', () => {
    const l = add(add([], 'APP_USE', true, 'u2'), 'AI_ANALYSIS', true);
    expect(currentConsent(l, 'u1', 'APP_USE')).toBe(false);
    expect(hasRequiredConsent(l, 'u1')).toBe(false);
  });

  it('hasRequiredConsent is true only when APP_USE is current', () => {
    let l = add([], 'APP_USE', true);
    expect(hasRequiredConsent(l, 'u1')).toBe(true);
    l = add(l, 'APP_USE', false);
    expect(hasRequiredConsent(l, 'u1')).toBe(false);
  });

  it('does not mutate its input and fills id and decided_at', () => {
    const input: ConsentRecord[] = [];
    const out = add(input, 'APP_USE', true);
    expect(input).toHaveLength(0);
    expect(out[0].consent_id).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(out[0].decided_at))).toBe(false);
  });
});
