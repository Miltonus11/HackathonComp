# Mobile: Pre-assessment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (owner chose inline/native execution). Steps use checkbox syntax.
> **Git:** the owner makes all commits. Do NOT run git commands.
> **Backend:** never edit `backend/` without the owner's explicit say-so for that specific change (see "Backend asks").
> **Passes:** stop for the owner only at the end of a pass. Pass 1 = Tasks 1–5 (foundation). Pass 2 = Tasks 6–9 (screens). Pass 3 = Tasks 10–12 (Home card, auto-start, resume, end-to-end).

**Goal:** First-time users are taken straight into the pre-assessment; returning users find it as an option on Home. Flow and scoring are entirely server-side; mobile renders forms, crisis screens and results.

**Architecture:** A shared authed API client (token store + refresh) is extracted from the auth service. A `ScreeningService` wraps `/api/screening/…`. Pure logic (local crisis rule, entry decision, Filipino localization) lives in `src/domain` and `src/content` with unit tests. Screens live in a new `assessment` route group outside the tab bar.

**Tech Stack:** Expo Router, NativeWind, jest-expo (existing).

**Spec:** `mental-health-app-system-context.md` §6.1, §7.3, §7.4, §9; `backend/screening/*` (authoritative for the API).

## Backend contract (read from `backend/screening`, 73 tests pass)
- `POST /api/screening/sessions/` → `201 {session_id, next: Form}`; `403 {code:'consent_required'|'profile_required', detail}`.
- `GET /api/screening/sessions/` → `[{session_id, started_at, completed_at, crisis_shown, results:[{instrument, severity_code}]}]` newest first.
- `GET /api/screening/sessions/<id>/` → `{session_id, started_at, completed_at, completed, crisis_shown, crisis, results:[Result], next: Form|null}`.
- `POST /api/screening/sessions/<id>/answers/` body `{instrument, responses:[{item_no, value}]}` → `{crisis: Crisis|null, result: Result, next: Form|null, completed}`; errors `400 {code:'wrong_instrument'|'invalid_responses'}`, `409 {code:'session_complete'}`, `404` other user's session.
- `Form = {instrument, name, recall_period_days, min_response, max_response, options: string[], items:[{item_no, text}]}`; option label for value `v` is `options[v - min_response]`.
- `Result = {instrument, raw_score, scaled_score|null, severity_code, label, advice:{headline, message, suggested_action}|null}`.
- `Crisis = {headline, message, hotlines:[{name, number, note}], talk_to_a_person: true}`.
- Flow (server): WHO5 → GAD7 → PHQ9 if WHO-5 scaled < 52, else PHQ9_ITEM9 (item 9 alone). Crisis when item 9 > 0 or WHO-5 scaled ≤ 28.
- Profile `onboarding_completed_at` is set by the server when a session completes.

## Global Constraints
- Mobile never scores, bands or decides severity. It only mirrors the crisis rule locally as a safety net (Task 2).
- Wording: "Your responses suggest…"; never "You have…". No combined score. PHQ9_ITEM9 is shown as a "safety check", never as a PHQ-9 score.
- Crisis screen is shown **before** the next questionnaire. It must work offline from bundled hotlines (`[VERIFY]` each number with the City Health Office).
- Real backend only for screening (no mock mode).
- Filipino: questions and option labels bundled in the app (`fil`), drafted by the assistant, marked `[VERIFY]` against validated Filipino instruments. English fallback when a string is missing.
- Entry rules: auto-start when `profile.onboarding_completed_at` is null; "Maybe later" is allowed but the prompt returns on the next login until completed; Home always shows the card. An unfinished session is resumed, never duplicated.
- Run `npx tsc --noEmit`, `npx expo lint`, `npx jest` at the end of each pass.

## Backend asks (owner decides who makes them; none made yet)
1. **WHO-5 "low" result wording** (`screening/seed_data.py`, `('WHO5','POOR',…)`): it currently says "We will ask a few more questions". Suggested: "Your responses suggest your wellbeing has been low over the past two weeks. Small steps like regular rest, movement and talking with someone you trust can help, and support is available if you want it."
2. **Opt-in PHQ-9 for good WHO-5 scores.** Today a WHO-5 ≥ 52 user gets item 9 only and the session completes; submitting `PHQ9` is rejected (`wrong_instrument`). Needed: a way to say "yes, I also want the full PHQ-9". Suggested: add `AssessmentSession.full_phq9_requested` (bool), `POST /api/screening/sessions/<id>/request-phq9/` (allowed when WHO-5 ≥ 52 and PHQ9 not done; reopens a completed session), and `flow.next_instrument` returns `PHQ9` when the flag is set and PHQ9 is not done (and does not ask item 9 twice). Mobile Task 11 depends on this.
3. Filipino advice/crisis rows (`AdviceContent`, language `fil`): mobile cannot translate server text. A draft seed script will be provided outside `backend/` (Task 5).

## Tasks

### Task 1 — Shared authed client (refactor)
**Files:** Create `src/lib/authed-client.ts`; Modify `src/lib/api.ts` (export `jsonInit`), `src/services/api-auth-service.ts`.
**Produces:** `createAuthedClient(kv): { readTokens(); saveTokens(t); clearTokens(); authed<T>(path, init?): Promise<T> }`, `type Tokens`, `TOKENS_KEY`. Behavior unchanged: refresh once on 401.
- [ ] Existing 12 `api-auth-service` tests must stay green (they are the safety net). Move the token read/save/refresh code out of the service into the client; the service takes `(kv = defaultKv, client = createAuthedClient(kv))`.

### Task 2 — Screening domain logic (tests first)
**Files:** `src/domain/screening.ts`, `__tests__/screening-domain.test.ts`.
**Produces:** types `InstrumentCode`, `Form`, `Result`, `Crisis`, `AnswerResponse`, `SessionSummary`, `SessionDetail`; `localCrisisCheck(code, responses: Record<number,number>): boolean` (PHQ9 item 9 > 0; PHQ9_ITEM9 item 1 > 0; WHO5 raw×4 ≤ 28); `optionLabel(form, value)`; `isFormComplete(form, answers)`; `shouldAutoStartAssessment({onboardingCompletedAt, dismissedThisSession}): boolean`; `findResumable(summaries): SessionSummary | null` (newest summary with `completed_at === null`).
**Tests:** item 9 = 1 → true even when other items 0; WHO5 raw 7 (=28) → true, raw 8 (=32) → false; GAD7 never local-crisis; `optionLabel` for WHO5 (0..5) and FREQ (0..3); `shouldAutoStart` true only when not completed and not dismissed; `findResumable` ignores completed.

### Task 3 — Crisis fallback content
**Files:** `src/content/crisis.ts`, `__tests__/crisis.test.ts`.
**Produces:** `FALLBACK_HOTLINES` (NCMH 1553; NCMH mobile 0917-899-8727; Hopeline PH 0917-558-4673; National Emergency 911 — copied from backend settings, `[VERIFY]`), `getFallbackCrisis(lang): Crisis`, `telUrl(number): string` (digits and leading `+` only).
**Tests:** every hotline has name and number; `telUrl('0917-899-8727') === 'tel:09178998727'`; `getFallbackCrisis('fil')` has Filipino text and `talk_to_a_person` true.

### Task 4 — Screening service (tests first, fake backend)
**Files:** `src/services/screening-service.ts`, `src/services/api-screening-service.ts`, `__tests__/api-screening-service.test.ts`.
**Produces:** `interface ScreeningService { start(): Promise<{sessionId; next: Form}>; list(): Promise<SessionSummary[]>; get(id): Promise<SessionDetail>; submit(id, instrument, answers: Record<number,number>): Promise<AnswerResponse> }`; `ScreeningError` with codes `CONSENT_REQUIRED|PROFILE_REQUIRED|WRONG_INSTRUMENT|INVALID_RESPONSES|SESSION_COMPLETE|NETWORK|SERVER`; `createApiScreeningService(client)`.
**Tests (fake fetch mirroring the real flow):** start returns WHO5; submit order WHO5→GAD7→PHQ9 when WHO-5 < 52, →PHQ9_ITEM9 when ≥ 52; crisis block passed through; 403 codes mapped; network failure → `NETWORK`; answers serialized as `{item_no, value}` list.

### Task 5 — Filipino content + seed script
**Files:** `src/content/screening-fil.ts`, `__tests__/screening-fil.test.ts`, `seed/seed_screening_fil.py` (outside backend, run later like the barangay seed).
**Produces:** `localizeForm(form: Form, lang: LanguageCode): Form` (replaces item texts and option labels when a Filipino entry exists for that instrument; otherwise returns the form unchanged). Filipino items: WHO5 ×5, GAD7 ×7, PHQ9 ×9, PHQ9_ITEM9 ×1; options: WHO5 ×6, FREQ ×4. Header comment: draft, `[VERIFY]` against validated versions.
**Tests:** item/option counts equal the backend's (5/7/9/1 and 6/4); `localizeForm(form,'en')` unchanged; `localizeForm(form,'fil')` keeps `item_no`, `min_response`, `max_response` and only changes text.
**Seed script:** inserts `InstrumentItem(language_code='fil')` rows and Filipino `AdviceContent` rows (same reviewer marker as the English seed, i.e. "pending clinical review"), idempotent, `--dry-run`.

**PASS 1 ENDS — STOP.** Run jest/tsc/lint; report; owner commits.

### Task 6 — Assessment route group and flow state
**Files:** `src/app/assessment/_layout.tsx`, `src/lib/assessment-flow.tsx`; Modify `src/app/_layout.tsx` (add `assessment` to the signed-in Protected group).
**Produces:** `AssessmentFlowProvider` / `useAssessmentFlow(): { sessionId; form; results; crisis; answers; start(); resume(); setAnswer(item, value); submit(); dismissCrisis(); }`.

### Task 7 — Intro and question screens
**Files:** `src/app/assessment/index.tsx` (intro: ~5 min, "not a diagnosis", always-visible "Need help now?", Start / Maybe later), `src/app/assessment/question.tsx` (one item per card, progress bar, large radio buttons from `optionLabel`, Back/Next, recall period text, item-9 framing "One more important question", submit on last item; network error keeps answers and offers Retry).
- Submit path: if `localCrisisCheck` is true, show the crisis screen even when the request fails.

### Task 8 — Crisis screen
**Files:** `src/app/assessment/crisis.tsx`.
Server `Crisis` if present, else `getFallbackCrisis(lang)`. Tap-to-call via `Linking.openURL(telUrl(n))`, "Talk to a person" (placeholder until the responder channel exists, shows hotlines), "Continue" returns to the flow. No free-form text.

### Task 9 — Results screen
**Files:** `src/app/assessment/results.tsx`.
Three separate cards (WHO-5 wellbeing, GAD-7, PHQ-9 or "safety check"), flag wording from `advice`, severity chip using palette tokens, disclaimer, Done → Home. (Referral prompt is the next phase.)

**PASS 2 ENDS — STOP.**

### Task 10 — Home card + auto-start + resume
**Files:** `src/app/(tabs)/index.tsx`, `src/lib/use-assessment-status.ts`, `src/lib/auth.tsx` (add `refreshSession()` so `onboarding_completed_at` updates after completion), `src/app/(tabs)/_layout.tsx` (auto-redirect using `shouldAutoStartAssessment`).
Home card states: not taken (Start), unfinished (Continue → `findResumable` → `get(id)`), done (last results + date + Take again). "Maybe later" sets an in-memory flag; the prompt returns on next login.

### Task 11 — Opt-in PHQ-9 (blocked on Backend ask 2)
When `next` is null and WHO-5 ≥ 52 and PHQ9 not done, results show "Would you like to answer the full PHQ-9 as well?"; Yes calls the new endpoint then continues the flow. Skip this task if the backend ask is not made.

### Task 12 — End-to-end pass
Fresh account → auto-start → WHO-5 high → GAD-7 → item 9 (0) → results; fresh account with WHO-5 low → PHQ-9 appears; item 9 > 0 → crisis screen first, offline too; kill the app mid-way → resume; returning login → Home card; Filipino toggle. Run jest/tsc/lint.

**PASS 3 ENDS — STOP.**

## Review Focus
1. Item 9 answered > 0 while offline: the crisis screen appears from bundled hotlines and the answer is not lost.
2. App killed or session expired between instruments: resume continues at the server's `next`; `wrong_instrument` triggers a refetch, not an error wall.
3. Starting twice (double tap, or an unfinished session exists): only one session; unfinished one is resumed.
4. WHO-5 exactly 28 (crisis) / 32 / 48 (PHQ-9 follows) / 52 (item 9 only): each lands in the right branch.
5. Long Filipino labels and the keyboard-less question cards fit small screens; options stay reachable; Back never lets a submitted instrument be re-answered.

## Update: Task 11 replaced by the choice dialog (done)

The owner changed the design: when WHO-5 is not good, after GAD-7 the person is asked (a dialog, no instrument names) whether to answer a few more questions about their mood. Yes: the full PHQ-9 follows. No: results are shown with only WHO-5 and GAD-7. Good-WHO-5 users are never asked (unchanged: GAD-7, then item 9 alone).

- Backend (owner-approved for this change only): `AssessmentSession.phq9_accepted` + migration `0002_session_phq9_choice`; `flow.pending_choice`; `answer_phq9_choice`; `POST /api/screening/sessions/<id>/choice/ {accept}`; answers/detail now return `choice: "MOOD_QUESTIONS" | null`. 136 backend tests pass.
- Mobile: `chooseMoodQuestions`, `choicePending` in the flow, `assessment/choice.tsx`. The longer questionnaire is never named in the UI.
- **Known safety consequence (owner decision):** a person who declines is never asked PHQ-9 item 9. Their only safety nets are the WHO-5 crisis flag (scaled <= 28), the GAD-7 severe flag, and the always-visible help link. The WHO-5 "POOR" advice text still says "We will ask a few more questions" and needs rewording (Backend ask 1).
