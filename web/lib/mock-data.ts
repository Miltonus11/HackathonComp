// Mock data for UI development. Shapes follow the data dictionary; values are synthetic.
// Replace each export with an API call once the backend exposes the matching endpoint.

import type { FeatureCollection, Polygon } from "geojson"

import sanFernandoGeo from "@/lib/geo/san-fernando-barangays.json"
import { SUPPRESSION_THRESHOLD } from "@/lib/labels"
import type {
  AdviceContent,
  AgeBand,
  AggEngagementMonthly,
  AggMoodWeekly,
  Assessment,
  AuditLog,
  Barangay,
  Consent,
  Escalation,
  Instrument,
  InstrumentCode,
  JournalPrompt,
  KnowledgeDocument,
  MoodEntry,
  Report,
  RiskFlag,
  Sector,
  Service,
  SeverityBand,
  SeverityCode,
  Sex,
  StaffUser,
  UserProfile,
} from "@/lib/types"

// Deterministic PRNG so server and client render the same numbers.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, items: readonly T[], weights: readonly number[]) {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// --- lookups ---

// All 59 barangays of the City of San Fernando, from the PSA-based boundary file.
// barangay_id is the last three digits of the PSGC code (e.g. Catbangen 0103314022 -> 22).
export const barangayGeo = sanFernandoGeo as unknown as FeatureCollection<Polygon, { name: string; psgc_code: string }>

export const barangays: Barangay[] = barangayGeo.features.map((f) => ({
  barangay_id: +f.properties.psgc_code.slice(-3),
  name: f.properties.name,
  psgc_code: f.properties.psgc_code,
  district: null,
}))

const bid = (name: string) => barangays.find((b) => b.name === name)!.barangay_id

// Busier, more urban barangays get more synthetic activity.
const URBAN = ["Catbangen", "Pagdaraoan", "Tanqui", "Sevilla", "Lingsat", "Madayegdeg", "Poro", "Parian", "Barangay I", "Barangay II", "Barangay III", "Barangay IV", "San Agustin", "Carlatan", "Ilocanos Norte", "Ilocanos Sur"]
const barangayWeight = (() => {
  const rand = rng(59)
  return Object.fromEntries(barangays.map((b) => [b.barangay_id, URBAN.includes(b.name) ? 10 + rand() * 12 : 1 + rand() * 4]))
})()

export function barangayName(id: number | null | undefined) {
  if (id == null) return "City-wide"
  return barangays.find((b) => b.barangay_id === id)?.name ?? `#${id}`
}

export const sectors: Sector[] = [
  "STUDENT",
  "EMPLOYEE",
  "SELF_EMPLOYED",
  "UNEMPLOYED",
  "SENIOR",
  "OUT_OF_SCHOOL_YOUTH",
  "HEALTHCARE_WORKER",
  "OTHER",
]
export const ageBands: AgeBand[] = ["UNDER_18", "18_24", "25_34", "35_44", "45_59", "60_PLUS"]
export const sexes: Sex[] = ["FEMALE", "MALE", "PREFER_NOT_TO_SAY"]

/** Last six months, oldest first, as ISO first-of-month dates. */
export const months = ["2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"]

// --- Content store: instruments and bands ---

export const instruments: Instrument[] = [
  { instrument_id: 1, code: "PHQ9", name: "Patient Health Questionnaire-9", item_count: 9, min_response: 0, max_response: 3, score_direction: "HIGHER_WORSE", recall_period_days: 14, scoring_version: "phq9-v1", source_citation: "Kroenke, Spitzer & Williams (2001). Public domain.", is_active: true },
  { instrument_id: 2, code: "GAD7", name: "Generalized Anxiety Disorder-7", item_count: 7, min_response: 0, max_response: 3, score_direction: "HIGHER_WORSE", recall_period_days: 14, scoring_version: "gad7-v1", source_citation: "Spitzer et al. (2006). Public domain.", is_active: true },
  { instrument_id: 3, code: "WHO5", name: "WHO-5 Well-Being Index", item_count: 5, min_response: 0, max_response: 5, score_direction: "HIGHER_BETTER", recall_period_days: 14, scoring_version: "who5-v1", source_citation: "WHO Regional Office for Europe (1998). [VERIFY] licensing.", is_active: true },
  { instrument_id: 4, code: "PHQ2", name: "Patient Health Questionnaire-2", item_count: 2, min_response: 0, max_response: 3, score_direction: "HIGHER_WORSE", recall_period_days: 14, scoring_version: "phq2-v1", source_citation: "Kroenke et al. (2003).", is_active: true },
  { instrument_id: 5, code: "GAD2", name: "Generalized Anxiety Disorder-2", item_count: 2, min_response: 0, max_response: 3, score_direction: "HIGHER_WORSE", recall_period_days: 14, scoring_version: "gad2-v1", source_citation: "Kroenke et al. (2007).", is_active: true },
]

export const severityBands: SeverityBand[] = [
  { band_id: 1, instrument_id: 1, min_value: 0, max_value: 4, severity_code: "MINIMAL", label: "Minimal", triggers_crisis_flow: false },
  { band_id: 2, instrument_id: 1, min_value: 5, max_value: 9, severity_code: "MILD", label: "Mild", triggers_crisis_flow: false },
  { band_id: 3, instrument_id: 1, min_value: 10, max_value: 14, severity_code: "MODERATE", label: "Moderate", triggers_crisis_flow: false },
  { band_id: 4, instrument_id: 1, min_value: 15, max_value: 19, severity_code: "MODERATELY_SEVERE", label: "Moderately severe", triggers_crisis_flow: false },
  { band_id: 5, instrument_id: 1, min_value: 20, max_value: 27, severity_code: "SEVERE", label: "Severe", triggers_crisis_flow: true },
  { band_id: 6, instrument_id: 2, min_value: 0, max_value: 4, severity_code: "MINIMAL", label: "Minimal", triggers_crisis_flow: false },
  { band_id: 7, instrument_id: 2, min_value: 5, max_value: 9, severity_code: "MILD", label: "Mild", triggers_crisis_flow: false },
  { band_id: 8, instrument_id: 2, min_value: 10, max_value: 14, severity_code: "MODERATE", label: "Moderate", triggers_crisis_flow: false },
  { band_id: 9, instrument_id: 2, min_value: 15, max_value: 21, severity_code: "SEVERE", label: "Severe", triggers_crisis_flow: true },
  { band_id: 10, instrument_id: 3, min_value: 52, max_value: 100, severity_code: "GOOD", label: "Good wellbeing", triggers_crisis_flow: false },
  { band_id: 11, instrument_id: 3, min_value: 29, max_value: 51, severity_code: "POOR", label: "Poor wellbeing", triggers_crisis_flow: false },
  { band_id: 12, instrument_id: 3, min_value: 0, max_value: 28, severity_code: "LIKELY_DEPRESSION", label: "Likely depression — assess", triggers_crisis_flow: true },
]

export const severitiesFor: Record<"PHQ9" | "GAD7" | "WHO5", SeverityCode[]> = {
  PHQ9: ["MINIMAL", "MILD", "MODERATE", "MODERATELY_SEVERE", "SEVERE"],
  GAD7: ["MINIMAL", "MILD", "MODERATE", "SEVERE"],
  WHO5: ["GOOD", "POOR", "LIKELY_DEPRESSION"],
}

// --- Analytics store ---
// The real Report Service aggregates first, then suppresses. These synthetic
// screenings exist only so the mock can do the same at any filter granularity.

type SyntheticScreening = {
  month: number
  barangay_id: number
  sector: Sector
  age_band: AgeBand
  sex: Sex
  PHQ9: SeverityCode
  GAD7: SeverityCode
  WHO5: SeverityCode
}

const screenings: SyntheticScreening[] = (() => {
  const rand = rng(2026)
  const out: SyntheticScreening[] = []
  for (let i = 0; i < 4000; i++) {
    const barangay_id = pick(rand, barangays.map((b) => b.barangay_id), barangays.map((b) => barangayWeight[b.barangay_id]))
    const sector = pick(rand, sectors, [30, 24, 8, 9, 10, 6, 7, 3])
    const age_band: AgeBand =
      sector === "STUDENT"
        ? pick(rand, ageBands, [45, 50, 5, 0, 0, 0])
        : sector === "SENIOR"
          ? "60_PLUS"
          : sector === "OUT_OF_SCHOOL_YOUTH"
            ? pick(rand, ageBands, [40, 60, 0, 0, 0, 0])
            : pick(rand, ageBands, [0, 22, 32, 24, 18, 4])
    const risk = rand() + (sector === "UNEMPLOYED" || sector === "OUT_OF_SCHOOL_YOUTH" ? 0.12 : 0)
    const phqIdx = risk < 0.38 ? 0 : risk < 0.68 ? 1 : risk < 0.86 ? 2 : risk < 0.96 ? 3 : 4
    const gadIdx = Math.min(3, Math.max(0, phqIdx + (rand() < 0.3 ? -1 : rand() < 0.2 ? 1 : 0)))
    out.push({
      month: Math.floor(rand() ** 0.7 * months.length),
      barangay_id,
      sector,
      age_band,
      sex: pick(rand, sexes, [54, 42, 4]),
      PHQ9: severitiesFor.PHQ9[phqIdx],
      GAD7: severitiesFor.GAD7[gadIdx],
      WHO5: phqIdx <= 1 ? "GOOD" : phqIdx <= 2 ? "POOR" : "LIKELY_DEPRESSION",
    })
  }
  return out
})()

export type ScreeningFilters = {
  fromMonth: number
  toMonth: number
  barangay_id?: number
  sector?: Sector
  age_band?: AgeBand
  sex?: Sex
}

/** A suppressed cell carries `count: null` so callers cannot recover the hidden value. */
export type Cell = { count: number | null; suppressed: boolean }

function suppress(n: number): Cell {
  return n < SUPPRESSION_THRESHOLD ? { count: null, suppressed: true } : { count: n, suppressed: false }
}

/**
 * Applies small-number suppression to a row of band counts that sits under a visible total.
 * If only one band would be hidden, the next-smallest is hidden too, otherwise
 * total minus the visible bands would reveal it (complementary suppression).
 */
function suppressRow(total: number, counts: Record<string, number>): Record<string, Cell> {
  const keys = Object.keys(counts)
  if (total < SUPPRESSION_THRESHOLD) return Object.fromEntries(keys.map((k) => [k, { count: null, suppressed: true }]))
  const hidden = new Set(keys.filter((k) => counts[k] < SUPPRESSION_THRESHOLD))
  if (hidden.size === 1) {
    const next = keys.filter((k) => !hidden.has(k)).sort((a, b) => counts[a] - counts[b])[0]
    if (next) hidden.add(next)
  }
  return Object.fromEntries(
    keys.map((k) => [k, hidden.has(k) ? { count: null, suppressed: true } : { count: counts[k], suppressed: false }]),
  )
}

function bandCounts(rows: SyntheticScreening[], instrument: "PHQ9" | "GAD7" | "WHO5") {
  return Object.fromEntries(severitiesFor[instrument].map((sev) => [sev, rows.filter((r) => r[instrument] === sev).length]))
}

function filtered(f: ScreeningFilters) {
  return screenings.filter(
    (s) =>
      s.month >= f.fromMonth &&
      s.month <= f.toMonth &&
      (f.barangay_id == null || s.barangay_id === f.barangay_id) &&
      (f.sector == null || s.sector === f.sector) &&
      (f.age_band == null || s.age_band === f.age_band) &&
      (f.sex == null || s.sex === f.sex),
  )
}

export function screeningTotal(f: ScreeningFilters): Cell {
  return suppress(filtered(f).length)
}

/** Severity distribution for one instrument, grouped by a dimension. */
export function screeningBy<K extends "barangay_id" | "sector" | "age_band" | "sex">(
  f: ScreeningFilters,
  instrument: "PHQ9" | "GAD7" | "WHO5",
  groupBy: K,
): { key: SyntheticScreening[K]; total: Cell; bands: Record<string, Cell> }[] {
  const rows = filtered(f)
  const groups = new Map<SyntheticScreening[K], SyntheticScreening[]>()
  for (const r of rows) {
    const list = groups.get(r[groupBy]) ?? []
    list.push(r)
    groups.set(r[groupBy], list)
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      total: suppress(list.length),
      bands: suppressRow(list.length, bandCounts(list, instrument)),
    }))
    .sort((a, b) => (b.total.count ?? 0) - (a.total.count ?? 0))
}

export const HIGH_BANDS: Record<"PHQ9" | "GAD7" | "WHO5", SeverityCode[]> = {
  PHQ9: ["MODERATE", "MODERATELY_SEVERE", "SEVERE"],
  GAD7: ["MODERATE", "SEVERE"],
  WHO5: ["POOR", "LIKELY_DEPRESSION"],
}

/** People at moderate-or-higher per barangay, aggregated before suppression (not summed from bands). */
export function screeningHighByBarangay(f: ScreeningFilters, instrument: "PHQ9" | "GAD7" | "WHO5") {
  const rows = filtered(f)
  return barangays.map((b) => {
    const inB = rows.filter((r) => r.barangay_id === b.barangay_id)
    return {
      barangay_id: b.barangay_id,
      total: suppress(inB.length),
      high: suppress(inB.filter((r) => HIGH_BANDS[instrument].includes(r[instrument])).length),
    }
  })
}

export function screeningBands(f: ScreeningFilters, instrument: "PHQ9" | "GAD7" | "WHO5") {
  const rows = filtered(f)
  return suppressRow(rows.length, bandCounts(rows, instrument))
}

export const engagementMonthly: AggEngagementMonthly[] = (() => {
  const rand = rng(77)
  const out: AggEngagementMonthly[] = []
  for (const b of barangays) {
    let registered = 0
    months.forEach((m, i) => {
      const done = screenings.filter((s) => s.month === i && s.barangay_id === b.barangay_id).length
      const started = Math.round(done * (1.18 + rand() * 0.15))
      registered += Math.round(started * 1.1)
      const suggested = Math.round(done * 0.34)
      out.push({
        period_month: m,
        barangay_id: b.barangay_id,
        registered_users: registered,
        active_users: Math.round(registered * (0.45 + rand() * 0.2)),
        assessments_started: started,
        assessments_completed: done,
        rescreens_completed: Math.round(done * (0.15 + i * 0.04)),
        referrals_suggested: suggested,
        referrals_initiated: Math.round(suggested * (0.25 + rand() * 0.15)),
        escalations_opened: Math.round(done * 0.04),
        suppressed: done < SUPPRESSION_THRESHOLD,
      })
    })
  }
  return out
})()

export const moodWeekly: AggMoodWeekly[] = (() => {
  const rand = rng(11)
  const out: AggMoodWeekly[] = []
  for (const b of barangays) {
    for (let w = 0; w < 12; w++) {
      const d = new Date(Date.UTC(2026, 7, 17 + w * 7))
      const n = Math.round(barangayWeight[b.barangay_id] * 1.4 * (0.7 + rand() * 0.6))
      const suppressed = n < SUPPRESSION_THRESHOLD
      out.push({
        period_week: d.toISOString().slice(0, 10),
        barangay_id: b.barangay_id,
        user_count: suppressed ? null : n,
        avg_mood: suppressed ? null : Math.round((6.4 + Math.sin(w / 2 + b.barangay_id) * 0.6 - (w > 8 ? 0.4 : 0)) * 10) / 10,
        suppressed,
      })
    }
  }
  return out
})()

// --- Identity store: staff ---

export const staffUsers: StaffUser[] = [
  { staff_id: "s-001", full_name: "Admin Demo", email: "admin@example.gov.ph", mfa_enabled: true, role: "ADMIN", license_no: null, status: "ACTIVE", created_at: "2026-05-02T01:00:00Z" },
  { staff_id: "s-002", full_name: "Case Officer A", email: "officer.a@example.gov.ph", mfa_enabled: true, role: "CASE_OFFICER", license_no: "PSY-0001234", status: "ACTIVE", created_at: "2026-05-04T01:00:00Z" },
  { staff_id: "s-003", full_name: "Case Officer B", email: "officer.b@example.gov.ph", mfa_enabled: true, role: "CASE_OFFICER", license_no: "RN-0098765", status: "ACTIVE", created_at: "2026-05-10T01:00:00Z" },
  { staff_id: "s-004", full_name: "Content Manager Demo", email: "content@example.gov.ph", mfa_enabled: true, role: "CONTENT_MANAGER", license_no: null, status: "ACTIVE", created_at: "2026-05-12T01:00:00Z" },
  { staff_id: "s-005", full_name: "DPO Demo", email: "dpo@example.gov.ph", mfa_enabled: true, role: "DPO", license_no: null, status: "ACTIVE", created_at: "2026-05-02T01:00:00Z" },
  { staff_id: "s-006", full_name: "Former Officer", email: "former@example.gov.ph", mfa_enabled: false, role: "CASE_OFFICER", license_no: "PSY-0004321", status: "DISABLED", created_at: "2026-05-20T01:00:00Z" },
]

export function staffName(id: string | null) {
  if (!id) return "Unassigned"
  return staffUsers.find((s) => s.staff_id === id)?.full_name ?? id
}

// --- Clinical store: escalations (Case Officer view) ---

export const riskFlags: RiskFlag[] = [
  { flag_id: "f-1001", user_id: "u-7f3a", source: "PHQ9_ITEM9", source_ref_type: "ASSESSMENT", source_ref_id: "a-501", level: "CRISIS", status: "OPEN", created_at: "2026-11-07T00:42:00Z" },
  { flag_id: "f-1002", user_id: "u-21cd", source: "JOURNAL_CLASSIFIER", source_ref_type: "JOURNAL_ENTRY", source_ref_id: "j-882", level: "CRISIS", status: "ACKNOWLEDGED", created_at: "2026-11-06T13:15:00Z" },
  { flag_id: "f-1003", user_id: "u-9b10", source: "SEVERE_SCORE", source_ref_type: "ASSESSMENT", source_ref_id: "a-498", level: "HIGH", status: "ACKNOWLEDGED", created_at: "2026-11-06T06:03:00Z" },
  { flag_id: "f-1004", user_id: "u-4e77", source: "CHAT_KEYWORD", source_ref_type: "CHAT_MESSAGE", source_ref_id: "m-3301", level: "HIGH", status: "OPEN", created_at: "2026-11-05T22:47:00Z" },
  { flag_id: "f-1005", user_id: "u-c0aa", source: "MOOD_TREND", source_ref_type: "MOOD_ENTRY", source_ref_id: "md-77", level: "MODERATE", status: "ACKNOWLEDGED", created_at: "2026-11-04T03:20:00Z" },
  { flag_id: "f-1006", user_id: "u-5d02", source: "WHO5_LOW", source_ref_type: "ASSESSMENT", source_ref_id: "a-480", level: "HIGH", status: "RESOLVED", created_at: "2026-11-01T09:10:00Z" },
  { flag_id: "f-1007", user_id: "u-88f1", source: "JOURNAL_KEYWORD", source_ref_type: "JOURNAL_ENTRY", source_ref_id: "j-850", level: "HIGH", status: "FALSE_ALARM", created_at: "2026-10-29T11:00:00Z" },
]

export const escalations: Escalation[] = [
  { escalation_id: "e-301", flag_id: "f-1001", assigned_staff_id: null, user_contactable: true, status: "QUEUED", outcome_code: null, notes: null, queued_at: "2026-11-07T00:42:00Z", first_response_at: null, closed_at: null },
  { escalation_id: "e-300", flag_id: "f-1002", assigned_staff_id: "s-002", user_contactable: false, status: "ASSIGNED", outcome_code: null, notes: null, queued_at: "2026-11-06T13:15:00Z", first_response_at: "2026-11-06T13:31:00Z", closed_at: null },
  { escalation_id: "e-299", flag_id: "f-1003", assigned_staff_id: "s-003", user_contactable: true, status: "CONTACT_ATTEMPTED", outcome_code: null, notes: "Called once, no answer. Retry after 2 PM.", queued_at: "2026-11-06T06:03:00Z", first_response_at: "2026-11-06T06:40:00Z", closed_at: null },
  { escalation_id: "e-298", flag_id: "f-1004", assigned_staff_id: null, user_contactable: true, status: "QUEUED", outcome_code: null, notes: null, queued_at: "2026-11-05T22:47:00Z", first_response_at: null, closed_at: null },
  { escalation_id: "e-297", flag_id: "f-1005", assigned_staff_id: "s-002", user_contactable: true, status: "CONTACTED", outcome_code: null, notes: "Spoke by phone. Agreed to visit CHO on Monday.", queued_at: "2026-11-04T03:20:00Z", first_response_at: "2026-11-04T05:00:00Z", closed_at: null },
  { escalation_id: "e-296", flag_id: "f-1006", assigned_staff_id: "s-003", user_contactable: true, status: "CLOSED", outcome_code: "REFERRED_TO_SERVICE", notes: "Referred to CHO psychologist. Appointment confirmed.", queued_at: "2026-11-01T09:10:00Z", first_response_at: "2026-11-01T09:52:00Z", closed_at: "2026-11-02T02:00:00Z" },
  { escalation_id: "e-295", flag_id: "f-1007", assigned_staff_id: "s-002", user_contactable: true, status: "CLOSED", outcome_code: "NOT_ACTIONABLE", notes: "Keyword matched a song lyric. Marked false alarm.", queued_at: "2026-10-29T11:00:00Z", first_response_at: "2026-10-29T11:20:00Z", closed_at: "2026-10-29T12:00:00Z" },
]

export const caseProfiles: Record<string, UserProfile> = {
  "u-7f3a": { user_id: "u-7f3a", birth_year: 2004, sex: "FEMALE", sector: "STUDENT", barangay_id: bid("Catbangen"), language_code: "fil" },
  "u-21cd": { user_id: "u-21cd", birth_year: 1991, sex: "MALE", sector: "UNEMPLOYED", barangay_id: bid("Pagdaraoan"), language_code: "en" },
  "u-9b10": { user_id: "u-9b10", birth_year: 1985, sex: "FEMALE", sector: "HEALTHCARE_WORKER", barangay_id: bid("Tanqui"), language_code: "en" },
  "u-4e77": { user_id: "u-4e77", birth_year: 2008, sex: "PREFER_NOT_TO_SAY", sector: "OUT_OF_SCHOOL_YOUTH", barangay_id: bid("Poro"), language_code: "fil" },
  "u-c0aa": { user_id: "u-c0aa", birth_year: 1960, sex: "MALE", sector: "SENIOR", barangay_id: bid("Sevilla"), language_code: "ilo" },
  "u-5d02": { user_id: "u-5d02", birth_year: 1998, sex: "FEMALE", sector: "EMPLOYEE", barangay_id: bid("Lingsat"), language_code: "en" },
  "u-88f1": { user_id: "u-88f1", birth_year: 2002, sex: "MALE", sector: "STUDENT", barangay_id: bid("Catbangen"), language_code: "fil" },
}

export function caseAssessments(userId: string): Assessment[] {
  const rand = rng(userId.charCodeAt(2) * 31 + userId.charCodeAt(3))
  const base = 10 + Math.floor(rand() * 10)
  const dates = ["2026-10-08T02:00:00Z", "2026-10-22T02:00:00Z", "2026-11-06T02:00:00Z"]
  return dates.flatMap((d, i) => {
    const phq = Math.min(27, base + i * 2)
    const gad = Math.min(21, base - 2 + i)
    const whoRaw = Math.max(2, 16 - i * 3 - Math.floor(rand() * 3))
    const band = (code: "PHQ9" | "GAD7", s: number) =>
      severityBands.find((b) => b.instrument_id === (code === "PHQ9" ? 1 : 2) && s >= b.min_value && s <= b.max_value)!.severity_code
    const who = whoRaw * 4
    return [
      { assessment_id: `a-${userId}-${i}-1`, user_id: userId, instrument_code: "PHQ9" as InstrumentCode, raw_score: phq, scaled_score: null, severity_code: band("PHQ9", phq), critical_item_positive: i === 2 && userId === "u-7f3a", taken_at: d },
      { assessment_id: `a-${userId}-${i}-2`, user_id: userId, instrument_code: "GAD7" as InstrumentCode, raw_score: gad, scaled_score: null, severity_code: band("GAD7", gad), critical_item_positive: false, taken_at: d },
      { assessment_id: `a-${userId}-${i}-3`, user_id: userId, instrument_code: "WHO5" as InstrumentCode, raw_score: whoRaw, scaled_score: who, severity_code: (who >= 52 ? "GOOD" : who > 28 ? "POOR" : "LIKELY_DEPRESSION") as SeverityCode, critical_item_positive: false, taken_at: d },
    ]
  })
}

export function caseMood(userId: string): MoodEntry[] {
  const rand = rng(userId.length * 97 + userId.charCodeAt(4))
  return Array.from({ length: 21 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 17 + i))
    const score = Math.max(1, Math.min(10, Math.round(7 - i * 0.18 + (rand() - 0.5) * 3)))
    return { entry_date: d.toISOString().slice(0, 10), mood_score: score }
  })
}

export function caseConsents(userId: string): Consent[] {
  const sharing = userId !== "u-21cd"
  return [
    { consent_type: "APP_USE", granted: true, decided_at: "2026-10-08T01:55:00Z" },
    { consent_type: "AI_ANALYSIS", granted: userId !== "u-c0aa", decided_at: "2026-10-08T01:56:00Z" },
    { consent_type: "PROFESSIONAL_SHARING", granted: sharing, decided_at: "2026-10-08T01:56:00Z" },
  ]
}

// --- Content store: advice, prompts, services, knowledge ---

export const adviceContent: AdviceContent[] = [
  { advice_id: 1, instrument_id: 1, severity_code: "MINIMAL", language_code: "en", headline: "Your responses suggest minimal depressive symptoms", message_body: "Keep up the habits that help you feel well: regular sleep, movement, and time with people you trust. A quick check-in in about two weeks can help you notice changes early.", suggested_action: "MONITOR", version: 3, review_status: "PUBLISHED", reviewed_by: "CHO Psychologist", reviewed_at: "2026-09-20T02:00:00Z", is_active: true },
  { advice_id: 2, instrument_id: 1, severity_code: "MILD", language_code: "en", headline: "Your responses suggest mild depressive symptoms", message_body: "Small daily steps can help. Try the self-care tools in the app, and consider talking to someone you trust. Counseling is available if you want it.", suggested_action: "SELF_CARE", version: 2, review_status: "PUBLISHED", reviewed_by: "CHO Psychologist", reviewed_at: "2026-09-20T02:00:00Z", is_active: true },
  { advice_id: 3, instrument_id: 1, severity_code: "MODERATE", language_code: "en", headline: "Your responses suggest moderate depressive symptoms", message_body: "Talking to a professional could help. Below are services near you that you can contact directly from the app.", suggested_action: "CONSIDER_PROFESSIONAL", version: 2, review_status: "PUBLISHED", reviewed_by: "CHO Psychologist", reviewed_at: "2026-09-20T02:00:00Z", is_active: true },
  { advice_id: 4, instrument_id: 1, severity_code: "MODERATE", language_code: "fil", headline: "Ang iyong mga sagot ay nagpapahiwatig ng katamtamang sintomas ng depresyon", message_body: "Makakatulong ang pakikipag-usap sa isang propesyonal. [VERIFY] Translation pending clinical review.", suggested_action: "CONSIDER_PROFESSIONAL", version: 1, review_status: "DRAFT", reviewed_by: null, reviewed_at: null, is_active: true },
  { advice_id: 5, instrument_id: 1, severity_code: "SEVERE", language_code: "en", headline: "We strongly recommend talking to a professional soon", message_body: "Your responses suggest severe depressive symptoms. You don't have to handle this alone. Please reach out to one of the services below. We'll also remind you to follow up.", suggested_action: "PRIORITY_REFERRAL", version: 2, review_status: "CLINICALLY_REVIEWED", reviewed_by: "CHO Psychologist", reviewed_at: "2026-10-30T02:00:00Z", is_active: true },
  { advice_id: 6, instrument_id: 2, severity_code: "MILD", language_code: "en", headline: "Your responses suggest mild anxiety symptoms", message_body: "Breathing exercises and limiting caffeine can help. Try the grounding tool in the app.", suggested_action: "SELF_CARE", version: 1, review_status: "PUBLISHED", reviewed_by: "CHO Psychologist", reviewed_at: "2026-09-21T02:00:00Z", is_active: true },
  { advice_id: 7, instrument_id: 3, severity_code: "POOR", language_code: "en", headline: "Your wellbeing score is lower than usual", message_body: "A lower wellbeing score suggests it may help to look more closely at how you're doing. A short follow-up screen is recommended.", suggested_action: "MONITOR", version: 1, review_status: "PUBLISHED", reviewed_by: "CHO Psychologist", reviewed_at: "2026-09-21T02:00:00Z", is_active: true },
  { advice_id: 8, instrument_id: null, severity_code: "CRISIS", language_code: "en", headline: "You don't have to go through this alone", message_body: "If you are thinking about harming yourself, please contact a crisis line now or go to the nearest emergency room. You can also ask us to have a trained responder reach out to you.", suggested_action: "CRISIS_SUPPORT", version: 4, review_status: "PUBLISHED", reviewed_by: "CHO Psychiatrist", reviewed_at: "2026-10-15T02:00:00Z", is_active: true },
]

export const journalPrompts: JournalPrompt[] = [
  { prompt_id: 1, domain_code: "ENERGY", language_code: "en", prompt_text: "What gave you energy today, and what drained it?", rotation_weight: 3, review_status: "PUBLISHED", is_active: true },
  { prompt_id: 2, domain_code: "SLEEP", language_code: "en", prompt_text: "How did you sleep last night? What was on your mind before bed?", rotation_weight: 2, review_status: "PUBLISHED", is_active: true },
  { prompt_id: 3, domain_code: "INTEREST", language_code: "en", prompt_text: "Was there a moment today you enjoyed, even a small one?", rotation_weight: 3, review_status: "PUBLISHED", is_active: true },
  { prompt_id: 4, domain_code: "WORRY", language_code: "en", prompt_text: "What's one thing you've been worrying about? What would you tell a friend in the same situation?", rotation_weight: 2, review_status: "PUBLISHED", is_active: true },
  { prompt_id: 5, domain_code: "SELF_WORTH", language_code: "en", prompt_text: "Name something you handled well this week.", rotation_weight: 2, review_status: "CLINICALLY_REVIEWED", is_active: true },
  { prompt_id: 6, domain_code: "CONCENTRATION", language_code: "en", prompt_text: "Was it easy or hard to focus today? What helped?", rotation_weight: 1, review_status: "DRAFT", is_active: true },
  { prompt_id: 7, domain_code: "MOOD", language_code: "fil", prompt_text: "Ano ang naramdaman mo ngayong araw?", rotation_weight: 2, review_status: "DRAFT", is_active: true },
  { prompt_id: 8, domain_code: "MOOD", language_code: "en", prompt_text: "Describe today in three words.", rotation_weight: 1, review_status: "RETIRED", is_active: false },
]

// [VERIFY] every phone number and schedule before launch.
export const services: Service[] = [
  { service_id: 1, name: "NCMH Crisis Hotline", service_type: "HOTLINE", barangay_id: null, address: null, phone: "1553", email: null, schedule_text: "24/7", cost_type: "FREE", accepts_walk_in: false, min_severity: null, is_crisis_service: true, last_verified_at: "2026-10-01", is_active: true, languages: ["en", "fil"], sectors: [...sectors] },
  { service_id: 2, name: "Hopeline PH", service_type: "HOTLINE", barangay_id: null, address: null, phone: "[VERIFY]", email: null, schedule_text: "24/7", cost_type: "FREE", accepts_walk_in: false, min_severity: null, is_crisis_service: true, last_verified_at: "2026-06-10", is_active: true, languages: ["en", "fil"], sectors: [...sectors] },
  { service_id: 3, name: "City Health Office — Mental Health Unit", service_type: "CITY_HEALTH_OFFICE", barangay_id: bid("Tanqui"), address: "[VERIFY] City Hall compound", phone: "[VERIFY]", email: null, schedule_text: "Mon–Fri, 8 AM–5 PM", cost_type: "FREE", accepts_walk_in: true, min_severity: "MILD", is_crisis_service: false, last_verified_at: "2026-10-12", is_active: true, languages: ["en", "fil", "ilo"], sectors: [...sectors] },
  { service_id: 4, name: "Catbangen Barangay Health Center", service_type: "BARANGAY_HEALTH_CENTER", barangay_id: bid("Catbangen"), address: "[VERIFY]", phone: null, email: null, schedule_text: "Mon–Fri, 8 AM–4 PM", cost_type: "FREE", accepts_walk_in: true, min_severity: "MINIMAL", is_crisis_service: false, last_verified_at: "2026-09-02", is_active: true, languages: ["fil", "ilo"], sectors: [...sectors] },
  { service_id: 5, name: "Provincial Hospital — Psychiatry OPD", service_type: "HOSPITAL", barangay_id: bid("Sevilla"), address: "[VERIFY]", phone: "[VERIFY]", email: null, schedule_text: "Tue & Thu, 8 AM–12 NN", cost_type: "SUBSIDIZED", accepts_walk_in: false, min_severity: "MODERATE", is_crisis_service: false, last_verified_at: "2026-08-15", is_active: true, languages: ["en", "fil", "ilo"], sectors: [...sectors] },
  { service_id: 6, name: "University Guidance Center", service_type: "SCHOOL_GUIDANCE", barangay_id: bid("Pagdaraoan"), address: "[VERIFY]", phone: null, email: "guidance@example.edu.ph", schedule_text: "School days", cost_type: "FREE", accepts_walk_in: true, min_severity: "MINIMAL", is_crisis_service: false, last_verified_at: "2026-10-20", is_active: true, languages: ["en", "fil"], sectors: ["STUDENT"] },
  { service_id: 7, name: "Senior Citizens Peer Circle", service_type: "PEER_SUPPORT", barangay_id: bid("Sevilla"), address: "[VERIFY]", phone: null, email: null, schedule_text: "Saturdays, 9 AM", cost_type: "FREE", accepts_walk_in: true, min_severity: "MINIMAL", is_crisis_service: false, last_verified_at: "2026-04-01", is_active: false, languages: ["ilo", "fil"], sectors: ["SENIOR"] },
]

export const knowledgeDocuments: KnowledgeDocument[] = [
  { doc_id: "d-01", title: "Understanding depression: a guide for the public", source_org: "WHO", source_url: "https://www.who.int/", language_code: "en", approved_by: "CHO Psychologist", approved_at: "2026-09-10T02:00:00Z", is_active: true, chunk_count: 42 },
  { doc_id: "d-02", title: "Coping with stress during difficult times", source_org: "WHO", source_url: "https://www.who.int/", language_code: "en", approved_by: "CHO Psychologist", approved_at: "2026-09-10T02:00:00Z", is_active: true, chunk_count: 28 },
  { doc_id: "d-03", title: "Mental Health Act (RA 11036): your rights", source_org: "DOH", source_url: "https://doh.gov.ph/", language_code: "en", approved_by: "City Legal Office", approved_at: "2026-09-18T02:00:00Z", is_active: true, chunk_count: 35 },
  { doc_id: "d-04", title: "Paano humingi ng tulong (How to ask for help)", source_org: "NCMH", source_url: null, language_code: "fil", approved_by: "CHO Psychologist", approved_at: "2026-10-02T02:00:00Z", is_active: true, chunk_count: 12 },
  { doc_id: "d-05", title: "City mental health services FAQ", source_org: "CITY_HEALTH_OFFICE", source_url: null, language_code: "en", approved_by: "CHO Head", approved_at: "2026-10-25T02:00:00Z", is_active: true, chunk_count: 9 },
  { doc_id: "d-06", title: "Sleep hygiene basics (2019 edition)", source_org: "OTHER_VETTED", source_url: null, language_code: "en", approved_by: "CHO Psychologist", approved_at: "2026-06-01T02:00:00Z", is_active: false, chunk_count: 14 },
]

// --- Audit log and reports ---

export const auditLog: AuditLog[] = [
  { audit_id: 10421, occurred_at: "2026-11-07T01:05:00Z", actor_type: "STAFF", actor_id: "s-002", action: "VIEW_CASE_RECORD", target_type: "escalation", target_id: "e-300", reason_code: "ACTIVE_ESCALATION", result: "ALLOWED", client_ip_hash: "9f2c…a1" },
  { audit_id: 10420, occurred_at: "2026-11-07T00:58:00Z", actor_type: "STAFF", actor_id: "s-001", action: "EXPORT_REPORT", target_type: "report", target_id: "r-019", reason_code: null, result: "ALLOWED", client_ip_hash: "41be…07" },
  { audit_id: 10419, occurred_at: "2026-11-07T00:42:00Z", actor_type: "SYSTEM", actor_id: "system", action: "CREATE_RISK_FLAG", target_type: "risk_flag", target_id: "f-1001", reason_code: "PHQ9_ITEM9", result: "ALLOWED", client_ip_hash: null },
  { audit_id: 10418, occurred_at: "2026-11-06T23:10:00Z", actor_type: "STAFF", actor_id: "s-003", action: "VIEW_CASE_RECORD", target_type: "user_profile", target_id: "u-21cd", reason_code: null, result: "DENIED", client_ip_hash: "c771…3e" },
  { audit_id: 10417, occurred_at: "2026-11-06T09:30:00Z", actor_type: "STAFF", actor_id: "s-004", action: "PUBLISH_ADVICE", target_type: "advice_content", target_id: "3", reason_code: null, result: "ALLOWED", client_ip_hash: "18aa…f0" },
  { audit_id: 10416, occurred_at: "2026-11-06T06:41:00Z", actor_type: "STAFF", actor_id: "s-003", action: "VIEW_CASE_RECORD", target_type: "escalation", target_id: "e-299", reason_code: "ACTIVE_ESCALATION", result: "ALLOWED", client_ip_hash: "c771…3e" },
  { audit_id: 10415, occurred_at: "2026-11-05T14:00:00Z", actor_type: "USER", actor_id: "u-5d02", action: "DELETE_JOURNAL", target_type: "journal_entry", target_id: "j-811", reason_code: null, result: "ALLOWED", client_ip_hash: "77d0…9b" },
  { audit_id: 10414, occurred_at: "2026-11-05T08:12:00Z", actor_type: "USER", actor_id: "u-88f1", action: "WITHDRAW_CONSENT", target_type: "consent", target_id: null, reason_code: "AI_ANALYSIS", result: "ALLOWED", client_ip_hash: "0e3f…22" },
  { audit_id: 10413, occurred_at: "2026-11-04T02:00:00Z", actor_type: "STAFF", actor_id: "s-005", action: "VIEW_AUDIT_LOG", target_type: "audit_log", target_id: null, reason_code: "MONTHLY_REVIEW", result: "ALLOWED", client_ip_hash: "5a5a…c4" },
]

export const reports: Report[] = [
  { report_id: "r-019", generated_by: "s-001", report_type: "SEVERITY_BY_BARANGAY", filters_json: { from: "2026-08-01", to: "2026-10-31" }, format: "PDF", ai_summary_text: "Moderate-or-higher PHQ-9 results were most common in Pagdaraoan and Catbangen during the quarter. Cells under 5 people are hidden.", file_ref: "reports/r-019.pdf", generated_at: "2026-11-07T00:58:00Z" },
  { report_id: "r-018", generated_by: "s-001", report_type: "ENGAGEMENT", filters_json: { from: "2026-10-01", to: "2026-10-31" }, format: "CSV", ai_summary_text: null, file_ref: "reports/r-018.csv", generated_at: "2026-11-01T03:00:00Z" },
  { report_id: "r-017", generated_by: "s-001", report_type: "SECTOR_SUMMARY", filters_json: { from: "2026-07-01", to: "2026-09-30", sector: "STUDENT" }, format: "PDF", ai_summary_text: "Student screenings rose 18% compared with the prior quarter.", file_ref: "reports/r-017.pdf", generated_at: "2026-10-05T03:00:00Z" },
]
