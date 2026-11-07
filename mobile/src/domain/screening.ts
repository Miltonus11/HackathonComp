/**
 * Types for the pre-assessment API (backend/screening) and the few rules mobile owns.
 * Mobile never scores or bands anything: severity comes from the server. The only rule
 * mirrored here is the crisis safety net (`localCrisisCheck`).
 */

export type InstrumentCode = 'WHO5' | 'GAD7' | 'PHQ9' | 'PHQ9_ITEM9';

export type Form = {
  instrument: InstrumentCode;
  name: string;
  recall_period_days: number | null;
  min_response: number;
  max_response: number;
  /** options[value - min_response] is the label for that value */
  options: string[];
  items: { item_no: number; text: string }[];
};

export type Advice = { headline: string; message: string; suggested_action: string };

export type Result = {
  instrument: InstrumentCode;
  raw_score: number;
  /** WHO-5 only (raw x 4); a decimal string such as "52.0" */
  scaled_score: string | null;
  severity_code: string;
  label: string;
  advice: Advice | null;
};

export type Hotline = { name: string; number: string; note: string };

export type Crisis = {
  headline: string;
  message: string;
  hotlines: Hotline[];
  talk_to_a_person: boolean;
};

/**
 * Set while a person with not-good wellbeing has to decide whether to answer the longer mood
 * questions (the PHQ-9 on the server; the app never names it). The client owns the wording.
 */
export type Choice = 'MOOD_QUESTIONS';

export type AnswerResponse = {
  crisis: Crisis | null;
  result: Result;
  next: Form | null;
  /** Non-null: show the choice dialog; 'next' is null and 'completed' false until they answer */
  choice: Choice | null;
  completed: boolean;
};

export type ChoiceResponse = { next: Form | null; choice: null; completed: boolean };

export type SessionSummary = {
  session_id: string;
  started_at: string;
  completed_at: string | null;
  crisis_shown: boolean;
  results: { instrument: InstrumentCode; severity_code: string }[];
};

export type SessionDetail = {
  session_id: string;
  started_at: string;
  completed_at: string | null;
  completed: boolean;
  crisis_shown: boolean;
  crisis: Crisis | null;
  results: Result[];
  next: Form | null;
  choice: Choice | null;
};

/** Answers keyed by item_no. */
export type Answers = Record<number, number>;

const WHO5_SCALE_FACTOR = 4;
const WHO5_CRISIS_AT_OR_BELOW = 28;

/**
 * Safety net only: the server is authoritative and returns the crisis block. This lets the
 * app show crisis help even if the request fails. Mirrors the server rule: PHQ-9 item 9 > 0
 * (also when asked alone) or WHO-5 scaled score <= 28.
 */
export function localCrisisCheck(code: InstrumentCode, answers: Answers): boolean {
  switch (code) {
    case 'PHQ9':
      return (answers[9] ?? 0) > 0;
    case 'PHQ9_ITEM9':
      return (answers[1] ?? 0) > 0;
    case 'WHO5': {
      const raw = Object.values(answers).reduce((sum, v) => sum + v, 0);
      return raw * WHO5_SCALE_FACTOR <= WHO5_CRISIS_AT_OR_BELOW;
    }
    default:
      return false;
  }
}

export function optionLabel(form: Form, value: number): string {
  return form.options[value - form.min_response] ?? '';
}

export function isFormComplete(form: Form, answers: Answers): boolean {
  return form.items.every((item) => {
    const v = answers[item.item_no];
    return v !== undefined && v >= form.min_response && v <= form.max_response;
  });
}

export function shouldAutoStartAssessment(input: {
  onboardingCompletedAt: string | null;
  dismissedThisSession: boolean;
}): boolean {
  return input.onboardingCompletedAt === null && !input.dismissedThisSession;
}

/** `summaries` is newest first (as the API returns it). */
export function findResumable(summaries: SessionSummary[]): SessionSummary | null {
  return summaries.find((s) => s.completed_at === null) ?? null;
}

export type AssessmentStatus =
  | { kind: 'none' }
  | { kind: 'unfinished'; session: SessionSummary }
  | { kind: 'done'; last: SessionSummary };

/** What the Home card shows. `summaries` is newest first (as the API returns it). */
export function assessmentStatus(summaries: SessionSummary[]): AssessmentStatus {
  const unfinished = findResumable(summaries);
  if (unfinished) return { kind: 'unfinished', session: unfinished };
  const last = summaries.find((s) => s.completed_at !== null);
  return last ? { kind: 'done', last } : { kind: 'none' };
}
