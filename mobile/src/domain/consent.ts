import { randomUUID } from 'expo-crypto';

import type { LanguageCode } from './profile';

export const CONSENT_TYPES = ['APP_USE', 'AI_ANALYSIS', 'PROFESSIONAL_SHARING'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export type ConsentRecord = {
  consent_id: string;
  user_id: string;
  consent_type: ConsentType;
  /** true = granted, false = withdrawn */
  granted: boolean;
  notice_version: string;
  /** Language of the notice the user was shown when deciding */
  language_code: LanguageCode;
  /** ISO-8601 UTC */
  decided_at: string;
};

export type NewConsent = Omit<ConsentRecord, 'consent_id' | 'decided_at'>;

/**
 * Insert-only: returns a new ledger with one more row. Rows are never edited or removed,
 * so a withdrawal is simply a later row with granted=false.
 */
export function appendConsent(
  ledger: readonly ConsentRecord[],
  rec: NewConsent,
  now: Date = new Date(),
): ConsentRecord[] {
  return [...ledger, { ...rec, consent_id: randomUUID(), decided_at: now.toISOString() }];
}

/** The latest row (by ledger order) for this user and type wins; no row means not consented. */
export function currentConsent(
  ledger: readonly ConsentRecord[],
  userId: string,
  type: ConsentType,
): boolean {
  for (let i = ledger.length - 1; i >= 0; i--) {
    const r = ledger[i];
    if (r.user_id === userId && r.consent_type === type) return r.granted;
  }
  return false;
}

export function hasRequiredConsent(ledger: readonly ConsentRecord[], userId: string): boolean {
  return currentConsent(ledger, userId, 'APP_USE');
}
