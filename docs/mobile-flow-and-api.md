# Daily flow spec: login, mood, journal, AI response

The agreed flow that backend and mobile both build against. The endpoints in sections 3 to 5 are **to be built**; the contracts below are the agreement. Anything marked **Decision** was chosen while writing this and can be changed before building.

Last updated: 2026-11-07

## 1. The flow

```
Login
  -> Daily mood (1-10, required)         system stores the number
  -> Journal: guided prompt              prompt comes from a reviewed bank, AI may personalize the wording
  -> User writes their answer
  -> AI gives an encouraging response    (only with AI consent; crisis check always runs first)
```

Rules that shape everything below:
- **Mood is required in the app flow.** The mobile app does not let the user past the mood screen until today's mood is logged. This is enforced by the app only: the journal endpoints on the server stay reachable whether or not mood was logged (MVP).
- **AI is optional.** The journal always works without it. The AI only ever personalizes wording and writes the encouraging reply.
- **Severity never comes from AI or from mood/journal.** Only the validated assessments (PHQ-9, GAD-7, WHO-5) produce severity.
- **AI runs only on the backend** (OpenAI). The app never holds an API key and never calls the AI directly.

## 2. Who builds what

| | Backend | Mobile |
|---|---|---|
| Login | done | send `mobile_number` + `password`, keep tokens |
| Routing after login | done (`GET /profile/`) | decide where to go (see 3.1) |
| Mood | store, one per day, baseline and trend | slider screen, gate the app until logged |
| Journal prompt | choose domain, pick prompt, optional AI wording | show prompt, allow free writing |
| Journal entry | encrypt, crisis check, AI reply | text input, loading state, show reply |
| History | list, read, delete | list and detail screens |

## 3. Login and routing

### 3.1 After login
Already built. `POST /api/auth/login/ {mobile_number, password}` returns `{access, refresh}`. Send `Authorization: Bearer <access>` afterwards. Refresh with `POST /api/auth/refresh/ {refresh}`.

Then the app routes using what exists today:
1. `GET /api/profile/`. `404` means registration is not finished: send the user to registration.
2. If `onboarding_completed_at` is `null`: send the user to the pre-assessment (`POST /api/screening/sessions/`).
3. Otherwise: go to the daily mood screen (section 4).

## 4. Daily mood (to be built)

Slider **1 to 10**, where 10 is best. Label it a mood tracker, not an assessment. Optional one-tap reason.

**Today's status** `GET /api/mood/today/`
```json
{ "date": "2026-11-07", "logged": false, "entry": null }
```
When logged, `entry` is the object below. The app shows the mood screen whenever `logged` is `false` and cannot be dismissed until it is logged.

**Log mood** `POST /api/mood/`
```json
{ "mood_score": 7, "reason_code": "SLEEP" }
```
- `mood_score`: integer 1 to 10, required.
- `reason_code`: optional. One of `SLEEP, WORK, SCHOOL, FAMILY, HEALTH, RELATIONSHIP, FINANCES, OTHER`.
- Returns `201`: `{ "id": "uuid", "entry_date": "2026-11-07", "mood_score": 7, "reason_code": "SLEEP", "logged_at": "..." }`.
- Errors: `400` for an invalid score or reason, `409 {code: "already_logged"}` if today already has an entry.
- **Decision:** one entry per day and no edits. A second POST the same day returns 409; the app should then just load today's entry.
- **Decision:** "today" is the calendar day in Philippine time (UTC+8), decided by the server, not the phone's clock.

**History** `GET /api/mood/?days=30` (default 30, max 365)
```json
{ "entries": [{ "entry_date": "...", "mood_score": 7, "reason_code": "SLEEP" }], "baseline": 6.8 }
```
`baseline` is the user's own average over their recent entries, `null` until they have enough. Trends are always compared to the user's own baseline, never to other people.

**Backend:** stores the number in `mood_entry` (unique per user per day). A sustained decline against the user's baseline will later suggest a short re-screen; that is out of scope for this spec.

## 5. Journal (to be built)

### 5.1 Get today's prompt
`GET /api/journal/prompt/`
```json
{ "prompt_id": 12, "domain": "SLEEP", "text": "How has your rest been lately, and what is on your mind at night?",
  "source": "personalized" }
```
- Available whether or not today's mood is logged.
- `domain` is one of `MOOD, INTEREST, SLEEP, ENERGY, WORRY, CONCENTRATION, SELF_WORTH`.
- `source`: `bank` (the reviewed text as written) or `personalized` (AI reworded it).

**How the backend picks the prompt**
1. **Domain, by rules, not AI.** Rotate through the domains, leaning toward the domain that matches the user's recent low mood reason, or their highest-scoring items on a full PHQ-9 (item to domain: 1 interest, 2 mood, 3 sleep, 4 energy, 6 self-worth, 7 concentration; GAD-7 gives worry). Users who never took the full PHQ-9 just get rotation.
2. **Text, from a reviewed bank.** Each domain has several clinician-reviewed prompts (`journal_prompt`, only `PUBLISHED` ones are served).
3. **Optional AI wording.** The AI may rephrase the chosen prompt to sound personal and warm. Its output is checked (length, no diagnosis words, still asks about the same domain). If the AI is slow, down, or fails the check, the reviewed text is returned with `source: "bank"`.
4. **Never PHQ-9 item 9.** Prompts never ask about self-harm.

Free writing without a prompt is always allowed (`prompt_id` is optional when saving).

### 5.2 Save an entry and get the response
`POST /api/journal/`
```json
{ "prompt_id": 12, "body": "I have been sleeping badly all week and I keep thinking about work." }
```
Returns `201`:
```json
{
  "entry_id": "uuid",
  "written_at": "...",
  "reflection": { "message": "That sounds tiring. It is good that you wrote it down...", "nudge": "A short check-in might help." },
  "ai_status": "ok",
  "crisis": null
}
```
`reflection` is `null` unless `ai_status` is `ok`. `nudge` may be `null`.

`ai_status` values:
| Value | Meaning |
|---|---|
| `ok` | reflection included |
| `no_consent` | user has not granted `AI_ANALYSIS`; the entry is saved, no reflection |
| `unavailable` | AI failed or timed out; the entry is saved, no reflection |
| `crisis` | the crisis check fired; no AI reply is generated and `crisis` is set |

`crisis` is `null`, or the same payload as the assessment's: `{headline, message, hotlines: [{name, number, note}], talk_to_a_person}`.

Errors: `400` for an empty or too long body (**Decision:** max 5,000 characters). Available whether or not today's mood is logged.

**What the backend does, in this order**
1. Saves the entry, encrypted per user. Errors here fail the whole request.
2. **Crisis check, always, whatever the consent.** Keyword and phrase lists (English, Filipino, Taglish, Ilocano) first, then a classifier on the text. If it fires: create a risk flag (`JOURNAL_KEYWORD` or `JOURNAL_CLASSIFIER`) and the escalation record, skip the AI, return `ai_status: "crisis"` and the `crisis` payload. The check errs toward false alarms.
3. If there is no crisis and the user holds an active `AI_ANALYSIS` consent: send the text to OpenAI **without any name, number, barangay or other identifier**, and return the reflection. Without consent: `no_consent`.

**The AI reflection must:**
- be short, warm and encouraging, in the user's language (English or Filipino);
- reflect what the user wrote and may offer one gentle nudge, for example "You have mentioned poor sleep several times this week";
- **never** diagnose, name a severity or score, mention medication, claim to be a therapist, or turn the text into a PHQ-9/GAD-7 result.

Latency: the POST waits for the AI (backend timeout about 10 seconds, then `unavailable`). The app should show a loading state and treat `unavailable` as a normal outcome, since the entry is already saved.

### 5.3 Read and delete
- `GET /api/journal/` returns the user's entries, newest first: `[{entry_id, written_at, prompt_text, body, reflection}]`. Only the owner can read them.
- `GET /api/journal/<entry_id>/` returns one entry.
- `DELETE /api/journal/<entry_id>/` is a **hard delete**: the entry, its reflection and any signals derived from it are removed, with no recovery. Returns `204`.

Journal text is private. It is never visible to admins or staff, never used in analytics, and never sent to the AI with identifiers.

## 6. Data model additions (backend)

| Table | Key fields |
|---|---|
| `mood_entry` | `id, user, entry_date, mood_score (1-10, check constraint), reason_code, logged_at`. Unique `(user, entry_date)` |
| `journal_prompt` | `id, domain_code, language_code, prompt_text, rotation_weight, review_status, is_active` |
| `journal_entry` | `id, user, prompt, body (encrypted), ai_reflection (encrypted), ai_analyzed, risk_scanned_at, written_at` |
| `risk_flag` | existing. `source` already has `JOURNAL_KEYWORD` and `JOURNAL_CLASSIFIER`; `source_ref_type = JOURNAL_ENTRY` |

## 7. Settings and secrets

- Backend `.env`: `OPENAI_API_KEY` (and a model name setting). It must never appear in the mobile app, the repo, or the API responses.
- Open item: the city's DPO must accept sending de-identified text to OpenAI outside the country. Until that is decided, treat the AI reply as a demo feature that is off unless the user consents.

## 8. Build order

1. **Mood:** model, the three endpoints, baseline, tests. No AI.
2. **Journal without AI:** prompt bank and seed, rule-based domain choice, encrypted entries, crisis check (keywords), list and delete.
3. **AI:** prompt wording, reflection, consent gating, timeouts and fallbacks.

Mobile can build the mood screen against step 1 and the journal screens against step 2, then add the loading state for step 3.

## 9. Open questions

1. Which OpenAI model should the backend use, and who owns the API key and its billing?

Settled: max entry length 5,000 characters; a second mood POST on the same day returns 409; "today" is the Philippine calendar day; the journal endpoints are not gated on mood.
