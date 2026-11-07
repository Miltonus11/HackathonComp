# Mobile: Theme, Privacy Consent & Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Git:** the owner makes all commits and pushes. Do NOT run git commands.
> **Passes (checkpoints):** work runs in three passes. Stop for the owner to commit only at the end of each pass; between tasks inside a pass, just run the task's checks and continue.
> - **Pass 1 — Palette:** Task 1
> - **Pass 2 — Logic:** Tasks 2–5
> - **Pass 3 — Screens:** Tasks 6–11 (includes the end-to-end check)

**Goal:** In the Expo mobile app, adopt the shadcn palette from `globals (1).css`, and ship the first-run flow: Data Privacy notice with layered consent → registration → sign-in, using mobile number + password, all against mock data (no backend).

**Architecture:** A `services/` layer exposes an `AuthService` interface with a mock implementation (device storage, no network), so a real API client can replace it later without touching screens. Pure domain logic (mobile-number normalization, validation, consent ledger) lives in `src/domain/` and is unit-tested. Screens in the `(auth)` group share a draft-state context so consent choices are persisted only when registration succeeds.

**Tech Stack:** Expo SDK 58 / Expo Router, React Native 0.88, NativeWind 4 + Tailwind 3, `expo-secure-store`, `expo-crypto` (new), `jest-expo` (new, tests).

**Spec:** `mental-health-app-system-context.md` §7.1 (consent), §7.2 (registration), §11 (privacy); `mental-health-app-data-dictionary.md` §3.1 `identity`, §4.1 `user_profile`, §4.2 `consent`, §8 enums. (Supplied by the owner in chat; not in the repo.) Palette source: `globals (1).css`. Before touching any Expo API, follow `mobile/AGENTS.md` (check docs for SDK 58).

## Global Constraints

- Mobile-first, `mobile/` only. No backend or web changes. Mock data only.
- Login identifier is a **Philippine mobile number**; canonical form `+639XXXXXXXXX`. Accepted inputs: `09XXXXXXXXX`, `9XXXXXXXXX`, `+639XXXXXXXXX`, `639XXXXXXXXX`, with spaces/dashes ignored.
- Consent types (exact enum): `APP_USE`, `AI_ANALYSIS`, `PROFESSIONAL_SHARING`. Each separate and revocable. **Insert-only ledger**: withdrawal is a new row with `granted=false`; latest row per type is current. Row fields: `consent_id`, `user_id`, `consent_type`, `granted`, `notice_version`, `language_code`, `decided_at`.
- `APP_USE` is required to continue. `AI_ANALYSIS` and `PROFESSIONAL_SHARING` are optional and **never pre-ticked**.
- Notice in English (`en`) and Filipino (`fil`). `ilo` is not offered until validated. Copy is a draft marked **[VERIFY with DPO]**; cite RA 10173.
- Registration fields: `birth_year` (year only, smallint), `sex` ∈ `FEMALE|MALE|PREFER_NOT_TO_SAY`, `sector` ∈ `STUDENT|EMPLOYEE|SELF_EMPLOYED|UNEMPLOYED|SENIOR|OUT_OF_SCHOOL_YOUTH|HEALTHCARE_WORKER|OTHER`, `barangay_id`, `language_code`, required `first_name` and `last_name` (real name, max 150 chars each, trimmed, non-empty), optional `display_name` (nickname shown in the app), `contact_for_followup` boolean. Names live only in the identity store, never in the profile/clinical store. **[DECIDE/VERIFY with DPO]** collecting real names conflicts with the data-minimization note in the data dictionary; owner chose to include them. **No age gating or branching.** Barangay only, never a full address.
- `user_id` is a UUID pseudonymous ID. Identity data (name, mobile, password hash) and profile/consent data are stored in **separate stores** linked only by `user_id`.
- Never store a plaintext password. (Mock hashing is SHA-256 + per-user salt, flagged as mock-only; the real backend will use Argon2id.)
- Timestamps are ISO-8601 UTC strings.
- Barangay list is a placeholder subset marked **[VERIFY]** against the city's PSGC list.
- Run `npx tsc --noEmit` and `npx expo lint` before declaring any task done (per `mobile/AGENTS.md`).

## Review Focus

1. Mobile number typed as `0917 123 4567`, `+63 917-123-4567`, `917 123 4567` → all normalize to `+639171234567`; `0817…`, 9 or 12 digits, letters → rejected with a clear message.
2. Registering a number that already exists → "already registered" error, no second account, no consent rows written.
3. Consent edge cases: grant → withdraw → re-grant (latest wins); withdrawing `APP_USE` later blocks app use; backing out of registration persists nothing.
4. Birth-year edge inputs: non-numeric, future year, before 1900, a minor's year → clear error or accepted (minors accepted, no crash, no branching).
5. Language switch mid-notice (`en`↔`fil`) keeps checkbox state, and the saved `language_code` equals the language shown when the user decided; long Filipino text and the on-screen keyboard never hide the Continue button or inputs.

---

## File Structure

| Path (under `mobile/`) | Responsibility |
|---|---|
| `src/global.css`, `tailwind.config.js` | Palette tokens (light + dark) as CSS vars, mapped to Tailwind colors |
| `src/constants/theme.ts` | `Colors` rebuilt from the same palette (non-Tailwind consumers) |
| `src/domain/mobile-number.ts` | `normalizePhMobile` |
| `src/domain/validation.ts` | Field validators (password, birth year, registration payload) |
| `src/domain/consent.ts` | Consent types, ledger append, `currentConsent`, `hasRequiredConsent` |
| `src/domain/profile.ts` | Enums + types for sex, sector, language, `UserProfile`, `Identity` |
| `src/content/privacy-notice.ts` | Notice copy per language + `NOTICE_VERSION` |
| `src/content/options.ts` | Sector/sex labels, placeholder barangays |
| `src/services/storage.ts` | Key-value storage (SecureStore native / localStorage web) |
| `src/services/auth-service.ts` | `AuthService` interface + types |
| `src/services/mock-auth-service.ts` | Mock implementation (identity store, profile+consent store, session) |
| `src/lib/auth.tsx` | Rewritten `AuthProvider`/`useAuth` over `AuthService` |
| `src/components/ui/` | `Button`, `TextField`, `Checkbox`, `ChipSelect`, `Screen`, `LanguageToggle` |
| `src/lib/onboarding-draft.tsx` | Draft context: language, consents, profile fields before submit |
| `src/app/(auth)/` | `welcome`, `privacy`, `register`, `login`, `_layout` |
| `src/app/(tabs)/privacy-settings.tsx` | View/withdraw/re-grant optional consents |
| `__tests__/` | Jest tests for `domain/` and `services/` |

---

### Task 1: Port the palette (theme foundation)

**Files:**
- Modify: `src/global.css`, `tailwind.config.js`, `src/constants/theme.ts`, `src/components/auth-form.tsx` (swap hard-coded `gray-*`/`blue-*` for tokens until Task 9 replaces it)

**Interfaces:**
- Produces: Tailwind color classes `bg-background text-foreground bg-card text-card-foreground bg-primary text-primary-foreground bg-secondary text-secondary-foreground bg-muted text-muted-foreground bg-accent text-accent-foreground bg-destructive border-border border-input ring-ring` plus `rounded-lg` driven by `--radius: 0.625rem`; `Colors.light/dark` in `theme.ts` carry the same values.

`globals (1).css` is Tailwind v4/shadcn (`@import "tailwindcss"`, `@theme inline`, `tw-animate-css`); this app is Tailwind 3 + NativeWind 4, so it cannot be copied as-is. Port only `:root`/`.dark` variable values.

- [ ] **Step 1: Spike oklch support.** Put `--primary: oklch(0.491 0.27 292.581)` in `:root`, map `primary: 'var(--primary)'` in `tailwind.config.js` `theme.extend.colors`, render a `bg-primary` View via `npx expo start --web`. Record whether it renders purple on web **and** in Expo Go/emulator. If oklch fails on either, convert every oklch value to hex/`rgb()` (keep a comment with the original oklch) and use that.
- [ ] **Step 2: Write all tokens** from the source `:root` (light) and `.dark` into `src/global.css` (keep the existing font vars and `@tailwind` directives; drop `@import`, `@theme`, `@layer base`). Include `card, popover, primary, secondary, muted, accent, destructive, border, input, ring, background, foreground (+ -foreground pairs), sidebar-*, chart-*, --radius`. Primary is the violet `0.491 0.27 292.581`.
- [ ] **Step 3: Map tokens in `tailwind.config.js`** (`colors`, and `borderRadius.lg = 'var(--radius)'`, `md`/`sm` offsets of -2px/-4px).
- [ ] **Step 4: Dark mode.** `app.json` pins `userInterfaceStyle: "light"`, so ship light only; keep `.dark` vars defined and add a one-line **[VERIFY]** note on how NativeWind 4 toggles them. Do not build a theme switcher (YAGNI).
- [ ] **Step 5: Rebuild `Colors` in `theme.ts`** from the same values; keep exported names and `ThemeColor` type so existing components still compile.
- [ ] **Step 6: Verify.** `npx tsc --noEmit`, `npx expo lint`, then the existing login screen renders with the violet primary on web and a device/emulator.

**PASS 1 ENDS — STOP:** report spike result (oklch ok or converted); owner commits.

---

### Task 2: Test setup + mobile-number and validation logic

**Files:**
- Create: `src/domain/mobile-number.ts`, `src/domain/validation.ts`, `__tests__/mobile-number.test.ts`, `__tests__/validation.test.ts`
- Modify: `package.json` (jest config + `test` script)

**Interfaces:**
- Produces:
  - `normalizePhMobile(input: string): string | null` → `+639XXXXXXXXX` or `null`
  - `validatePassword(pw: string): string | null` (error message or null; min 8 chars, must differ from only-whitespace)
  - `validateBirthYear(raw: string, now?: Date): string | null` (4 digits, 1900 ≤ year ≤ current year)

- [ ] **Step 1: Install test tooling:** `npx expo install jest-expo jest @types/jest`; add `"test": "jest"` and `"jest": { "preset": "jest-expo" }` to `package.json`.
- [ ] **Step 2: Write failing tests** in `__tests__/mobile-number.test.ts`:
  - `normalizePhMobile('0917 123 4567') === '+639171234567'`; same result for `'+63 917-123-4567'`, `'917 123 4567'`, `'639171234567'`
  - returns `null` for `'0817 123 4567'`, `'091712345'`, `'09171234567890'`, `'abc'`, `''`
  - `validatePassword('short')` returns a message; `validatePassword('longenough1')` is `null`; `'        '` returns a message
  - `validateBirthYear('2031', new Date('2026-11-07'))` returns a message; `'1899'`, `'19x5'`, `''` too; `'2010'` (a minor) and `'1990'` are `null`
- [ ] **Step 3: Run** `npx jest` → FAIL (modules missing).
- [ ] **Step 4: Implement** both modules to the signatures above.
- [ ] **Step 5: Run** `npx jest` → PASS.

**Task done:** checks pass; continue (stop only at pass boundaries).

---

### Task 3: Domain types and consent ledger

**Files:**
- Create: `src/domain/profile.ts`, `src/domain/consent.ts`, `__tests__/consent.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `profile.ts`: `type LanguageCode = 'en' | 'fil'`, `type Sex`, `type Sector` (exact enums above), `type UserProfile = { user_id; birth_year: number; sex: Sex; sector: Sector; occupation_detail?: string; barangay_id: number; language_code: LanguageCode; onboarding_completed_at: string | null; created_at: string }`, `type Identity = { identity_id; user_id; first_name: string; last_name: string; display_name?: string; mobile_number: string; contact_for_followup: boolean; status: 'ACTIVE'|'SUSPENDED'|'DELETION_REQUESTED'|'DELETED'; created_at; last_login_at: string | null }`
  - `consent.ts`: `type ConsentType`, `type ConsentRecord` (fields in Global Constraints), `appendConsent(ledger: ConsentRecord[], rec: Omit<ConsentRecord,'consent_id'|'decided_at'>, now?: Date): ConsentRecord[]` (returns new array, never mutates), `currentConsent(ledger, userId, type): boolean` (latest row wins, default `false`), `hasRequiredConsent(ledger, userId): boolean` (`APP_USE` current)

- [ ] **Step 1: Write failing tests** `__tests__/consent.test.ts`: empty ledger → `currentConsent` false; grant → true; grant then withdraw → false and ledger length 2 (insert-only, original row untouched); withdraw then re-grant → true; different user's rows ignored; `hasRequiredConsent` true only when `APP_USE` current; `appendConsent` does not mutate its input.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (use `expo-crypto` `randomUUID` for `consent_id`; install via `npx expo install expo-crypto`). **Step 4: Run** → PASS.

**Task done:** checks pass; continue (stop only at pass boundaries).

---

### Task 4: Content — privacy notice and option lists

**Files:**
- Create: `src/content/privacy-notice.ts`, `src/content/options.ts`, `__tests__/content.test.ts`

**Interfaces:**
- Produces:
  - `NOTICE_VERSION = '2026-11-draft-1'`
  - `getNotice(lang: LanguageCode): { title; intro; sections: {heading; body}[]; consents: Record<ConsentType, {label; description; required: boolean}>; footer }` — plain-language, covers: what is collected, why, who sees it (admins aggregates only), AI use of journal/chat text, sharing with a professional, rights (access, export, delete, withdraw), retention note, DPO contact placeholder, RA 10173 reference; draft banner text "[VERIFY with DPO]"
  - `SECTOR_LABELS`, `SEX_LABELS: Record<…, Record<LanguageCode,string>>`; `BARANGAYS: {barangay_id:number; name:string}[]` (~10 placeholder entries, comment **[VERIFY]**)

- [ ] **Step 1: Write failing tests:** `getNotice('en')` and `getNotice('fil')` both have all three consent keys; `required` true only for `APP_USE`; every `SECTOR` and `Sex` value has both `en` and `fil` labels; barangay ids unique.
- [ ] **Step 2–4:** run (FAIL) → write content → run (PASS). Filipino text is a good-faith draft and is flagged for human review.

**Task done:** checks pass; continue (stop only at pass boundaries).

---

### Task 5: Mock auth service

**Files:**
- Create: `src/services/storage.ts`, `src/services/auth-service.ts`, `src/services/mock-auth-service.ts`, `__tests__/mock-auth-service.test.ts`

**Interfaces:**
- Consumes: Task 2 (`normalizePhMobile`, validators), Task 3 (types, `appendConsent`)
- Produces:
  - `storage.ts`: `kv: { get(key: string): Promise<string|null>; set(key: string, v: string): Promise<void>; remove(key: string): Promise<void> }` (SecureStore native, `localStorage` web; same split the old `auth.tsx` used). Test injects an in-memory `kv`.
  - `auth-service.ts`:
    ```ts
    type RegistrationInput = { mobile: string; password: string; first_name: string; last_name: string; display_name?: string; contact_for_followup: boolean; birth_year: number; sex: Sex; sector: Sector; barangay_id: number; language_code: LanguageCode; consents: Record<ConsentType, boolean>; notice_version: string }
    type Session = { identity: Identity; profile: UserProfile; consents: ConsentRecord[] }
    interface AuthService {
      register(input: RegistrationInput): Promise<Session>
      signIn(mobile: string, password: string): Promise<Session>
      restore(): Promise<Session | null>
      signOut(): Promise<void>
      setConsent(type: ConsentType, granted: boolean, language: LanguageCode): Promise<Session>
    }
    class AuthError extends Error { code: 'INVALID_MOBILE'|'WEAK_PASSWORD'|'MOBILE_TAKEN'|'BAD_CREDENTIALS'|'CONSENT_REQUIRED'|'INVALID_INPUT' }
    ```
  - `mock-auth-service.ts`: `createMockAuthService(kv = defaultKv): AuthService`

Behavior: `register` rejects without `APP_USE` consent (`CONSENT_REQUIRED`), normalizes the mobile, rejects duplicates (`MOBILE_TAKEN`) and writes nothing on any rejection. Identity (with salted SHA-256 hash via `expo-crypto`, kept in a separate `identity_store` key, never returned in `Session`) and profile+consents (separate `clinical_store` key) are linked only by `user_id`. `signIn` returns the same `BAD_CREDENTIALS` for unknown number and wrong password. `setConsent` appends a ledger row; withdrawing `APP_USE` is allowed and leaves `restore()` returning the session with `hasRequiredConsent` false (UI blocks, Task 10).

- [ ] **Step 1: Write failing tests** (in-memory `kv`): register happy path returns a UUID `user_id` and 3 consent rows (granted per input, incl. `false`); `identity_store` JSON contains no plaintext password; register same number written as `09171234567` then `+63 917 123 4567` → second throws `MOBILE_TAKEN` and the ledger count is unchanged; register without `APP_USE` → `CONSENT_REQUIRED` and the stores stay empty; `signIn` works with a differently formatted number; wrong password and unknown number both throw `BAD_CREDENTIALS`; `setConsent('AI_ANALYSIS', false)` after grant → current false, ledger grew by 1; `restore()` returns `null` after `signOut()`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.

**PASS 2 ENDS — STOP:** run `npx jest`, `npx tsc --noEmit`, `npx expo lint`; report; owner commits.

---

### Task 6: Rewrite `AuthProvider` over the service

**Files:**
- Modify: `src/lib/auth.tsx`; delete the email/token logic. `src/lib/api.ts` stays untouched for later.
- Modify: `src/app/_layout.tsx` (guards use `session && hasRequiredConsent`)

**Interfaces:**
- Consumes: `AuthService` (Task 5)
- Produces: `useAuth(): { session: Session | null; loading: boolean; signIn(mobile, password): Promise<void>; signUp(input: RegistrationInput): Promise<void>; signOut(): Promise<void>; setConsent(type, granted, lang): Promise<void>; hasRequiredConsent: boolean }`. A single `authService` instance is created at module scope (`createMockAuthService()`), so swapping in an API client later is a one-line change.

- [ ] **Step 1:** implement the provider (restore on mount, same `loading` splash behavior as before).
- [ ] **Step 2:** root `Stack.Protected`: `(tabs)` when `session && hasRequiredConsent`; `(auth)` otherwise.
- [ ] **Step 3:** `npx tsc --noEmit` — fix the old `signIn(email…)`/`User` call sites (`auth-form.tsx`, `(tabs)` screens) minimally; they are replaced in Tasks 8–9.

**Task done:** checks pass; continue (stop only at pass boundaries).

---

### Task 7: UI primitives

**Files:**
- Create: `src/components/ui/button.tsx`, `text-field.tsx`, `checkbox.tsx`, `chip-select.tsx`, `screen.tsx`, `language-toggle.tsx`

**Interfaces (all styled with Task 1 tokens only, no hard-coded colors):**
- `Button({ title, onPress, variant?: 'primary'|'secondary'|'ghost'; loading?; disabled? })`
- `TextField({ label, error?, secure?, ...TextInputProps })` — label above, error below, show/hide toggle when `secure`, `accessibilityLabel` set
- `Checkbox({ checked, onChange, label, description?, required? })`
- `ChipSelect<T extends string>({ options: {value:T; label:string}[]; value: T | null; onChange(v:T): void; label })`
- `Screen({ children, scroll?: boolean })` — safe area + `KeyboardAvoidingView` + `ScrollView` with `keyboardShouldPersistTaps="handled"`, bottom padding so the footer button clears the keyboard
- `LanguageToggle({ value: LanguageCode; onChange })`

- [ ] **Step 1:** build each; touch targets ≥ 44pt; required fields get a visible marker beyond color.
- [ ] **Step 2:** a temporary preview route (delete afterwards) renders all of them; check on web and device.
- [ ] **Step 3:** `npx tsc --noEmit` + `npx expo lint`.

**Task done:** checks pass; continue (stop only at pass boundaries).

---

### Task 8: Welcome + Privacy notice and consent screens

**Files:**
- Create: `src/lib/onboarding-draft.tsx`, `src/app/(auth)/welcome.tsx`, `src/app/(auth)/privacy.tsx`
- Modify: `src/app/(auth)/_layout.tsx` (wrap in `OnboardingDraftProvider`, initial route `welcome`)

**Interfaces:**
- Consumes: Task 4 `getNotice`, Task 7 primitives
- Produces: `useOnboardingDraft(): { language; setLanguage; consents: Record<ConsentType, boolean>; setConsent(type, v); profile: Partial<…>; setProfile(patch); reset() }`. Defaults: `language: 'en'`, all three consents `false`.

Flow: `welcome` (app name, one-paragraph purpose, "Get started" → `privacy`, "I already have an account" → `login`, `LanguageToggle`) → `privacy` (notice sections, three checkboxes; `APP_USE` marked required; **Continue disabled until `APP_USE` is checked**; link to read full notice) → `register`. Back from `privacy` returns to `welcome` and keeps draft; nothing is persisted yet.

- [ ] **Step 1:** implement draft context.
- [ ] **Step 2:** welcome and privacy screens; all copy from `getNotice(language)`; switching language keeps checkbox state.
- [ ] **Step 3:** manual check: Continue disabled until `APP_USE`; optional boxes start unticked; toggle `en`↔`fil` keeps ticks; Continue stays reachable with the keyboard/long Filipino text (Review Focus 5).

**Task done:** checks pass; continue (stop only at pass boundaries).

---

### Task 9: Registration screen (+ login)

**Files:**
- Create: `src/app/(auth)/register.tsx`, `src/app/(auth)/login.tsx` (replace), delete `src/app/(auth)/signup.tsx` and `src/components/auth-form.tsx` once unused
- Test: extend `__tests__/validation.test.ts` with `validateRegistration`
- Modify: `src/domain/validation.ts` — add `validateRegistration(input: Partial<RegistrationFields>): Record<string,string>` (field → message; empty object means valid)

**Interfaces:**
- Consumes: draft context (Task 8), `useAuth().signUp/signIn` (Task 6), `normalizePhMobile`, options (Task 4)

Registration form, in two short steps in one screen (progress "1 of 2 / 2 of 2") to avoid a long scroll:
1. **About you:** birth year, sex (`ChipSelect`), sector (`ChipSelect`), barangay (picker/list), language.
2. **Your account:** first name, last name, nickname (optional; shown in the app instead of the real name), mobile number, password, confirm password, "OK to contact me for follow-up" checkbox (unticked by default).
Submit calls `signUp({...draft, consents, notice_version: NOTICE_VERSION})`. Field errors inline; `MOBILE_TAKEN` → error on the mobile field with a "Log in instead" link; network-free so no spinner beyond brief submitting state. On success the root guard swaps to `(tabs)`.

Login: mobile number + password, `BAD_CREDENTIALS` shown as one generic message, link to `welcome`. "Forgot password" shown disabled with "coming soon" (no flow yet).

- [ ] **Step 1: Failing tests** for `validateRegistration`: returns an error for each of first name (empty/whitespace), last name, mobile, password, confirm mismatch, birth year, missing sex/sector/barangay; returns `{}` for a valid payload; a minor's birth year is valid.
- [ ] **Step 2:** run (FAIL) → implement → run (PASS).
- [ ] **Step 3:** build both screens.
- [ ] **Step 4:** manual run of Review Focus 1, 2, 4, and back-navigation (nothing persisted until submit).
- [ ] **Step 5:** `npx tsc --noEmit`, `npx expo lint`, `npx jest`.

**Task done:** checks pass; continue (stop only at pass boundaries).

---

### Task 10: Signed-in privacy settings and consent gate

**Files:**
- Create: `src/app/(tabs)/privacy-settings.tsx`
- Modify: `src/components/app-tabs.tsx` and `app-tabs.web.tsx` (add tab "Privacy"), `src/app/(tabs)/index.tsx` (replace template content with a minimal signed-in home: greeting using the nickname or "there", and a sign-out button)

**Interfaces:**
- Consumes: `useAuth().session.consents`, `setConsent`, `currentConsent`

Screen lists the three consents with current state and "last changed" time; `AI_ANALYSIS` and `PROFESSIONAL_SHARING` toggle freely (each toggle appends a ledger row in the currently selected language). Withdrawing `APP_USE` shows a confirmation explaining the app will stop being usable; on confirm the root guard returns the user to the auth flow. Includes the notice text and a placeholder "Export / delete my data — coming soon" row (no behavior; non-goal).

- [ ] **Step 1:** implement; **Step 2:** manual check of Review Focus 3 (grant → withdraw → re-grant; `APP_USE` withdrawal routes to auth, re-consenting via sign-in is handled by a consent re-prompt, see Open Question 2).

**Task done:** checks pass; continue (stop only at pass boundaries).

---

### Task 11: End-to-end pass

- [ ] Fresh install (clear storage) → welcome → privacy (`APP_USE` only) → register → lands on home → Privacy tab shows `APP_USE` granted and others not → sign out → log in with the number typed in a different format → withdraw `AI_ANALYSIS` → relaunch app (session restored, consent state kept).
- [ ] Run once on web, once on a device/emulator. Fix layout issues (keyboard, small screens ~360dp wide, long Filipino text).
- [ ] `npx tsc --noEmit`, `npx expo lint`, `npx jest` all clean; report outputs.

**PASS 3 ENDS — STOP:** owner commits; hands back for the next feature (pre-assessment) planning.

---

## Out of scope (this plan)

Backend/web, real OTP or SMS verification, password reset, account deletion/data export behavior, the assessments, crisis flow, journal, mood, chatbot, directory, Ilocano, dark-mode switcher, minors/guardian consent handling (tracked as **[DECIDE]** in the spec).

## Open Questions (defaults assumed unless you say otherwise)

1. **OTP:** mobile number is treated as an unverified login ID in the mock. Add a mock OTP step later? (Assumed: no.)
2. **`APP_USE` withdrawn then user logs back in:** assumed the consent screen is shown again before the app is usable (a re-prompt reusing the privacy screen). Confirm.
3. **Email:** the spec lists contact as optional; the plan drops email entirely since login is mobile-only. Confirm.
4. **Barangays:** placeholder subset until you provide the PSGC list.
5. **Library for the barangay picker:** assumed a simple modal list (no new dependency).
