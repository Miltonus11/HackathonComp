/** Daily mood tracker. Not an assessment: it never produces a severity (backend rule). */

export const MOOD_MIN = 1;
export const MOOD_MAX = 10;
export const MOOD_DEFAULT = 5;

/** Same values as backend wellbeing.MoodEntry.Reason. */
export const MOOD_REASONS = [
  'SLEEP',
  'WORK',
  'SCHOOL',
  'FAMILY',
  'HEALTH',
  'RELATIONSHIP',
  'FINANCES',
  'OTHER',
] as const;
export type MoodReason = (typeof MOOD_REASONS)[number];

export type MoodEntry = {
  id: string;
  /** Philippine calendar day, decided by the server */
  entry_date: string;
  mood_score: number;
  reason_code: MoodReason | null;
  logged_at: string;
};

/** GET /api/mood/today/ */
export type MoodToday = {
  date: string;
  logged: boolean;
  entry: MoodEntry | null;
};

/** Snap whatever the slider reports to a whole number inside 1..10. */
export function clampMood(value: number): number {
  if (!Number.isFinite(value)) return MOOD_DEFAULT;
  return Math.min(MOOD_MAX, Math.max(MOOD_MIN, Math.round(value)));
}

const MOOD_EMOJI = ['😭', '😢', '😞', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'] as const;

/** One face per score, 1 (saddest) to 10 (happiest). */
export const moodEmoji = (score: number): string => MOOD_EMOJI[clampMood(score) - 1];

export type MoodSubmission = { mood_score: number; reason_code?: MoodReason };

/** Request body for POST /api/mood/: reason is omitted when none was picked. */
export function toSubmission(score: number, reason: MoodReason | null): MoodSubmission {
  const body: MoodSubmission = { mood_score: clampMood(score) };
  if (reason) body.reason_code = reason;
  return body;
}

/**
 * Where the daily prompt is allowed to show.
 * - `journal`: anyone, including a first-timer who just finished the pre-assessment.
 * - `home`: only people who already finished onboarding, so a first-timer is not stopped by the
 *   mood dialog in the middle of (or right after) the pre-assessment.
 */
export type MoodGateWhere = 'home' | 'journal';

export function shouldShowMoodGate(args: {
  where: MoodGateWhere;
  logged: boolean | null; // null = not known yet
  onboardingCompleted: boolean;
}): boolean {
  if (args.logged !== false) return false; // already logged, or still unknown
  if (args.where === 'journal') return true;
  return args.onboardingCompleted;
}
