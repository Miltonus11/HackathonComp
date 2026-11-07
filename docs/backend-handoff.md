# Backend changes the mobile app needs

> **Status (mobile is now wired to the real API):** profile, consents and barangays endpoints exist and mobile uses them; `GET /api/barangays/` was made public (one-line change in `core/views.py`). Registration is done as several calls (account, profile, consents), and mobile resumes a half-finished signup if the same number and password are submitted again. Still open from the list below: items 1 (atomic register), 2 (require `display_name`/names server-side), 6 (enforce `APP_USE`), 7 (login `status` check), 8 (throttling), 9 (consent ordering tie-break). To run offline against the on-device mock instead, set `EXPO_PUBLIC_USE_MOCK=1`.

Mobile (registration, consent, login) is built against a mock service. To switch it to the real API, the backend needs the items below. Nothing here has been changed in `backend/`; this is a request list for whoever owns it.

## What already works with mobile as-is
- `POST /api/auth/login/` with `{mobile_number, password}` → `{access, refresh}`. Any PH format is accepted.
- `POST /api/auth/register/` for identity only: `mobile_number, password, first_name, last_name, display_name, contact_for_followup`.
- `GET /api/auth/me/`, `POST /api/auth/refresh/`.

## Needed

1. **Register creates everything in one transaction.** Extend `POST /api/auth/register/` to also accept:
   ```json
   {
     "birth_year": 2001, "sex": "MALE", "sector": "STUDENT", "barangay_id": 4,
     "language_code": "en",
     "notice_version": "2026-11-draft-1",
     "consents": { "APP_USE": true, "AI_ANALYSIS": false, "PROFESSIONAL_SHARING": false }
   }
   ```
   and create `User` + `UserProfile` + three `Consent` rows (one per type, `granted` as sent, same `notice_version`/`language_code`). Reject with 400 if `consents.APP_USE` is not true. Nothing is saved on any failure.
2. **Names.** For residents: `first_name` and `last_name` required. **`display_name` required** (this is the username; 3–30 chars on mobile). Decide whether it must be unique. First and last name must never be returned to other users or shown in the app; consider omitting them from `UserSerializer` / `GET /me/`.
3. **`GET /api/barangays/`** (public or authenticated) → `[{id, name}]`. Seed with `seed/seed_barangays.py` (run from `backend/`, supports `--dry-run`). The list in `seed/barangays.json` is unverified.
4. **Consents.**
   - `GET /api/consents/` → the signed-in user's rows, oldest first.
   - `POST /api/consents/` `{consent_type, granted, notice_version, language_code}` → appends one row, returns the updated list.
5. **`GET /api/auth/me/` returns identity + profile + consents** (or add `/api/profile/`), so mobile can restore a session with one call.
6. **Enforce `APP_USE` on clinical endpoints.** A permission class that denies when the latest `APP_USE` row is `granted=False`. Consent endpoints themselves must stay reachable so a user can re-grant.
7. **Login should respect `status`.** `SUSPENDED` / `DELETED` / `DELETION_REQUESTED` users should not get tokens (today only `is_active` is checked).
8. **Throttle** login and register (e.g. DRF `ScopedRateThrottle`). The login ID is a guessable 10-digit number.
9. **Consent ordering.** `Consent.has_active` sorts by `decided_at` only; add `id`/insertion order as a tie-breaker.
10. **Errors.** Keep DRF's `{field: [messages]}` shape; mobile maps field keys (`mobile_number`, `password`, `display_name`, …) to inputs.

## Field mapping (mobile ↔ backend)
| Mobile | Backend |
|---|---|
| `mobile` / `mobile_number` | `User.mobile_number` (`+639XXXXXXXXX`) |
| `display_name` (username) | `User.display_name` |
| `user_id` | `User.user_id` |
| `birth_year, sex, sector, language_code` | `UserProfile.*` |
| `barangay_id` | `UserProfile.barangay` (FK) |
| consent ledger | `Consent` rows |
| `created_at` (identity) | `User.date_joined` |
