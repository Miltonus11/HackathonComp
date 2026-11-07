/**
 * Journal: types for backend/wellbeing's journal API, plus the pure day/page rules the screen uses.
 * No React, no network here.
 *
 * Days are Philippine calendar days (UTC+8, no daylight saving), the same "today" the server uses
 * for mood. Page 0 is today; each later page is one day earlier, back to the day the person
 * registered. Days without an entry still get a page ("no entry").
 */
import type { Crisis } from './screening';

export const MAX_JOURNAL_CHARS = 5000;

export type JournalDomain = 'MOOD' | 'INTEREST' | 'SLEEP' | 'ENERGY' | 'WORRY' | 'CONCENTRATION' | 'SELF_WORTH';

/** GET /api/journal/prompt/. `source: 'none'` (all fields null) means the prompt bank is empty. */
export type JournalPrompt = {
  prompt_id: number | null;
  domain: JournalDomain | null;
  text: string | null;
  source: 'bank' | 'personalized' | 'none';
};

export type Reflection = { message: string; nudge: string | null };

/** One row of GET /api/journal/ and GET /api/journal/<id>/ */
export type JournalEntry = {
  entry_id: string;
  written_at: string;
  prompt_text: string | null;
  body: string | null; // null only if the server could not decrypt it
  reflection: Reflection | null;
};

export type AiStatus = 'ok' | 'no_consent' | 'unavailable' | 'crisis';

/** POST /api/journal/ (201) */
export type SaveResponse = {
  entry_id: string;
  written_at: string;
  reflection: Reflection | null;
  ai_status: AiStatus;
  crisis: Crisis | null;
};

// ---------------------------------------------------------------------------------------- days

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Philippine calendar day ('YYYY-MM-DD') of a timestamp. Returns null for anything unparseable. */
export function phDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + PH_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today in the Philippines from a clock reading. Only a fallback: prefer the server's date. */
export const phToday = (now: Date = new Date()): string => phDate(now.toISOString())!;

function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);

export type JournalDay = {
  /** 'YYYY-MM-DD', Philippine calendar day */
  date: string;
  isToday: boolean;
  /** Newest first. Usually zero or one; the server allows more, so none are hidden. */
  entries: JournalEntry[];
};

/**
 * One page per day, today first, back to the registration day. Entries dated before registration
 * (should not happen, but clocks and data imports are messy) extend the range so none are lost.
 * A registration date after today (a bad clock) just gives today alone.
 */
export function buildDays(args: { today: string; registeredOn: string | null; entries: JournalEntry[] }): JournalDay[] {
  const { today, entries } = args;
  const byDate = new Map<string, JournalEntry[]>();
  let earliest = args.registeredOn && DATE_RE.test(args.registeredOn) ? args.registeredOn : today;
  for (const e of entries) {
    const d = phDate(e.written_at);
    if (!d || d > today) continue; // a future-dated entry has no page to live on
    if (d < earliest) earliest = d;
    byDate.set(d, [...(byDate.get(d) ?? []), e]);
  }
  if (earliest > today) earliest = today;

  const count = daysBetween(earliest, today) + 1;
  const days: JournalDay[] = [];
  for (let i = 0; i < count; i++) {
    const date = addDays(today, -i);
    const list = (byDate.get(date) ?? []).sort((a, b) => Date.parse(b.written_at) - Date.parse(a.written_at));
    days.push({ date, isToday: i === 0, entries: list });
  }
  return days;
}

/** Today's writing box shows only while today has no entry (deleting it brings the box back). */
export const canWriteToday = (days: JournalDay[]): boolean => days.length > 0 && days[0].entries.length === 0;

// ------------------------------------------------------------------------------------- writing

export type BodyProblem = 'EMPTY' | 'TOO_LONG';

/** Same rules as the server: whitespace is trimmed, then 1..5000 characters. */
export function checkBody(text: string): BodyProblem | null {
  const t = text.trim();
  if (!t) return 'EMPTY';
  if (t.length > MAX_JOURNAL_CHARS) return 'TOO_LONG';
  return null;
}

/**
 * After a save whose answer never arrived, find the entry if the server did save it: same text
 * (the server trims it) and written today. Used to avoid a duplicate when offering a retry.
 */
export function findSavedEntry(entries: JournalEntry[], text: string, today: string): JournalEntry | null {
  const t = text.trim();
  return entries.find((e) => e.body === t && phDate(e.written_at) === today) ?? null;
}
