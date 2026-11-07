import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { getFallbackCrisis } from '@/content/crisis';
import { localizeForm } from '@/content/screening-fil';
import type { LanguageCode } from '@/domain/profile';
import {
  findResumable,
  localCrisisCheck,
  type Answers,
  type Crisis,
  type Form,
  type Result,
} from '@/domain/screening';
import { ScreeningError, type ScreeningService } from '@/services/screening-service';

import { useAuth } from './auth';
import { screeningService } from './screening';

type Next = 'question' | 'crisis' | 'results';

type Flow = {
  sessionId: string | null;
  /** The current instrument's form, in the user's language */
  form: Form | null;
  /** The person must decide whether to answer the longer mood questions */
  choicePending: boolean;
  answers: Answers;
  results: Result[];
  /** Crisis help waiting to be shown (server block, or the bundled fallback) */
  crisis: Crisis | null;
  completed: boolean;
  busy: boolean;
  /** Resumes an unfinished session, or starts a new one. Throws ScreeningError. */
  begin(): Promise<void>;
  setAnswer(itemNo: number, value: number): void;
  /** Submits the current instrument. Throws ScreeningError (answers are kept). */
  submit(): Promise<Next>;
  /** Called when the person leaves the crisis screen to carry on. */
  dismissCrisis(): 'question' | 'results';
  /** Accept (longer mood questions follow) or decline (finish with the results so far). */
  chooseMoodQuestions(accept: boolean): Promise<'question' | 'results'>;
  /** Re-reads the finished session so results come from the server. */
  refreshResults(): Promise<void>;
  /** Opens an earlier finished session so its results can be shown. */
  viewResults(sessionId: string): Promise<void>;
  reset(): void;
};

const FlowContext = createContext<Flow | null>(null);

export function AssessmentFlowProvider({
  children,
  service = screeningService,
}: {
  children: React.ReactNode;
  service?: ScreeningService;
}) {
  const { session } = useAuth();
  const lang: LanguageCode = session?.profile.language_code ?? 'en';

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rawForm, setRawForm] = useState<Form | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [results, setResults] = useState<Result[]>([]);
  const [crisis, setCrisis] = useState<Crisis | null>(null);
  const [completed, setCompleted] = useState(false);
  const [choicePending, setChoicePending] = useState(false);
  const [busy, setBusy] = useState(false);
  // Where to go once the crisis screen is dismissed; null means "retry the same instrument".
  const afterCrisis = useRef<{ next: Form | null; completed: boolean; choice: boolean } | null>(null);

  // `choice` true means nothing is due until the person answers the choice dialog, so a missing
  // next form does not mean "finished".
  const apply = useCallback((next: Form | null, done: boolean, choice = false) => {
    setRawForm(next);
    setAnswers({});
    setChoicePending(choice);
    setCompleted(done || (next === null && !choice));
  }, []);

  const form = useMemo(() => (rawForm ? localizeForm(rawForm, lang) : null), [rawForm, lang]);

  const begin = useCallback(async () => {
    setBusy(true);
    try {
      const resumable = findResumable(await service.list());
      if (resumable) {
        const d = await service.get(resumable.session_id);
        setSessionId(d.session_id);
        setResults(d.results);
        apply(d.next, d.completed, d.choice !== null);
      } else {
        const s = await service.start();
        setSessionId(s.sessionId);
        setResults([]);
        apply(s.next, false);
      }
    } finally {
      setBusy(false);
    }
  }, [service, apply]);

  const setAnswer = useCallback((itemNo: number, value: number) => {
    setAnswers((a) => ({ ...a, [itemNo]: value }));
  }, []);

  const resync = useCallback(
    async (id: string) => {
      const d = await service.get(id);
      setResults(d.results);
      apply(d.next, d.completed, d.choice !== null);
      return d.completed || (d.next === null && d.choice === null);
    },
    [service, apply],
  );

  const submit = useCallback(async (): Promise<Next> => {
    if (!sessionId || !rawForm) throw new ScreeningError('SERVER', 'No assessment is in progress.');
    const code = rawForm.instrument;
    const snapshot = answers;
    setBusy(true);
    try {
      const res = await service.submit(sessionId, code, snapshot);
      // Err toward showing help: if our local rule says crisis but the server did not, show it.
      const crisisBlock = res.crisis ?? (localCrisisCheck(code, snapshot) ? getFallbackCrisis(lang) : null);
      setResults((r) => [...r.filter((x) => x.instrument !== res.result.instrument), res.result]);
      if (crisisBlock) {
        setCrisis(crisisBlock);
        afterCrisis.current = { next: res.next, completed: res.completed, choice: res.choice !== null };
        return 'crisis';
      }
      apply(res.next, res.completed, res.choice !== null);
      return res.completed ? 'results' : 'question';
    } catch (e) {
      const err = e instanceof ScreeningError ? e : new ScreeningError('SERVER', 'Something went wrong.');
      // Safety: a critical answer must reach crisis help even if saving it failed.
      if (localCrisisCheck(code, snapshot) && (err.code === 'NETWORK' || err.code === 'SERVER')) {
        setCrisis(getFallbackCrisis(lang));
        afterCrisis.current = null;
        return 'crisis';
      }
      // The server already moved on (double tap, app restarted): follow the server.
      if (err.code === 'WRONG_INSTRUMENT' || err.code === 'SESSION_COMPLETE') {
        return (await resync(sessionId)) ? 'results' : 'question';
      }
      throw err;
    } finally {
      setBusy(false);
    }
  }, [sessionId, rawForm, answers, service, lang, apply, resync]);

  const dismissCrisis = useCallback((): 'question' | 'results' => {
    const after = afterCrisis.current;
    afterCrisis.current = null;
    setCrisis(null);
    if (!after) return 'question';
    apply(after.next, after.completed, after.choice);
    return after.completed || (after.next === null && !after.choice) ? 'results' : 'question';
  }, [apply]);

  const chooseMoodQuestions = useCallback(
    async (accept: boolean): Promise<'question' | 'results'> => {
      if (!sessionId) throw new ScreeningError('SERVER', 'No assessment is in progress.');
      setBusy(true);
      try {
        const res = await service.chooseMoodQuestions(sessionId, accept);
        apply(res.next, res.completed, false);
        return res.completed || res.next === null ? 'results' : 'question';
      } catch (e) {
        const err = e instanceof ScreeningError ? e : new ScreeningError('SERVER', 'Something went wrong.');
        // The server already moved on (double tap, restart): follow the server.
        if (err.code === 'NO_CHOICE_PENDING' || err.code === 'SESSION_COMPLETE') {
          return (await resync(sessionId)) ? 'results' : 'question';
        }
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, service, apply, resync],
  );

  const refreshResults = useCallback(async () => {
    if (!sessionId) return;
    const d = await service.get(sessionId);
    setResults(d.results);
  }, [sessionId, service]);

  const viewResults = useCallback(
    async (id: string) => {
      const d = await service.get(id);
      setSessionId(d.session_id);
      setResults(d.results);
      setCrisis(null);
      apply(null, true);
    },
    [service, apply],
  );

  const reset = useCallback(() => {
    setSessionId(null);
    setRawForm(null);
    setAnswers({});
    setResults([]);
    setCrisis(null);
    setCompleted(false);
    setChoicePending(false);
    afterCrisis.current = null;
  }, []);

  const value = useMemo<Flow>(
    () => ({
      sessionId,
      form,
      choicePending,
      answers,
      results,
      crisis,
      completed,
      busy,
      begin,
      setAnswer,
      submit,
      dismissCrisis,
      chooseMoodQuestions,
      refreshResults,
      viewResults,
      reset,
    }),
    [sessionId, form, choicePending, answers, results, crisis, completed, busy, begin, setAnswer, submit, dismissCrisis, chooseMoodQuestions, refreshResults, viewResults, reset],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useAssessmentFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error('useAssessmentFlow must be used within AssessmentFlowProvider');
  return ctx;
}
