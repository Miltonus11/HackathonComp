import type {
  AgeBand,
  EscalationStatus,
  JournalDomain,
  OutcomeCode,
  ReviewStatus,
  RiskLevel,
  RiskSource,
  Sector,
  ServiceType,
  SeverityCode,
  StaffRole,
  SuggestedAction,
} from "@/lib/types"

/** Minimum cell size shown anywhere in admin views (data dictionary rule 7). */
export const SUPPRESSION_THRESHOLD = 5

/** "MODERATELY_SEVERE" -> "Moderately severe" */
export function humanize(code: string) {
  const s = code.toLowerCase().replace(/_/g, " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const roleLabels: Record<StaffRole, string> = {
  ADMIN: "Admin / Program Manager",
  CASE_OFFICER: "Case / Referral Officer",
  CONTENT_MANAGER: "Content Manager",
  DPO: "Data Protection Officer",
}

export const sectorLabels: Record<Sector, string> = {
  STUDENT: "Student",
  EMPLOYEE: "Employee",
  SELF_EMPLOYED: "Self-employed",
  UNEMPLOYED: "Unemployed",
  SENIOR: "Senior citizen",
  OUT_OF_SCHOOL_YOUTH: "Out-of-school youth",
  HEALTHCARE_WORKER: "Healthcare worker",
  OTHER: "Other",
}

export const ageBandLabels: Record<AgeBand, string> = {
  UNDER_18: "Under 18",
  "18_24": "18–24",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_59": "45–59",
  "60_PLUS": "60+",
}

export const serviceTypeLabels: Record<ServiceType, string> = {
  BARANGAY_HEALTH_CENTER: "Barangay health center",
  CITY_HEALTH_OFFICE: "City Health Office",
  HOTLINE: "Hotline",
  HOSPITAL: "Hospital",
  PRIVATE_PRACTICE: "Private practice",
  NGO: "NGO",
  SCHOOL_GUIDANCE: "School guidance",
  PEER_SUPPORT: "Peer support",
}

export const riskSourceLabels: Record<RiskSource, string> = {
  PHQ9_ITEM9: "PHQ-9 item 9",
  WHO5_LOW: "Very low WHO-5",
  SEVERE_SCORE: "Severe score",
  JOURNAL_KEYWORD: "Journal keyword",
  JOURNAL_CLASSIFIER: "Journal classifier",
  CHAT_KEYWORD: "Chat keyword",
  CHAT_CLASSIFIER: "Chat classifier",
  MOOD_TREND: "Mood trend",
}

export const instrumentLabels: Record<string, string> = {
  PHQ9: "PHQ-9",
  GAD7: "GAD-7",
  WHO5: "WHO-5",
  PHQ2: "PHQ-2",
  GAD2: "GAD-2",
}

export const escalationStatusOrder: EscalationStatus[] = [
  "QUEUED",
  "ASSIGNED",
  "CONTACT_ATTEMPTED",
  "CONTACTED",
  "REFERRED",
  "CLOSED",
]

export const outcomeCodes: OutcomeCode[] = [
  "SUPPORT_PROVIDED",
  "REFERRED_TO_SERVICE",
  "NO_CONTACT_POSSIBLE",
  "NOT_ACTIONABLE",
]

export const journalDomains: JournalDomain[] = [
  "MOOD",
  "INTEREST",
  "SLEEP",
  "ENERGY",
  "WORRY",
  "CONCENTRATION",
  "SELF_WORTH",
]

export const suggestedActions: SuggestedAction[] = [
  "SELF_CARE",
  "MONITOR",
  "CONSIDER_PROFESSIONAL",
  "PRIORITY_REFERRAL",
  "CRISIS_SUPPORT",
]

export const reviewStatuses: ReviewStatus[] = ["DRAFT", "CLINICALLY_REVIEWED", "PUBLISHED", "RETIRED"]

// --- tone classes (Tailwind) for badges and bars ---

type Tone = "neutral" | "ok" | "info" | "warn" | "high" | "crisis"

export const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300",
  crisis: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
}

export const severityTone: Record<SeverityCode | "CRISIS", Tone> = {
  MINIMAL: "ok",
  GOOD: "ok",
  MILD: "info",
  MODERATE: "warn",
  POOR: "warn",
  MODERATELY_SEVERE: "high",
  SEVERE: "crisis",
  LIKELY_DEPRESSION: "crisis",
  CRISIS: "crisis",
}

/** Bar fill per severity, ordered light to dark so stacked bars read as a scale. */
export const severityBarClass: Record<SeverityCode, string> = {
  MINIMAL: "bg-emerald-400",
  GOOD: "bg-emerald-400",
  MILD: "bg-sky-400",
  MODERATE: "bg-amber-400",
  POOR: "bg-amber-400",
  MODERATELY_SEVERE: "bg-orange-500",
  SEVERE: "bg-red-600",
  LIKELY_DEPRESSION: "bg-red-600",
}

export const riskLevelTone: Record<RiskLevel, Tone> = {
  MODERATE: "warn",
  HIGH: "high",
  CRISIS: "crisis",
}

export const escalationTone: Record<EscalationStatus, Tone> = {
  QUEUED: "crisis",
  ASSIGNED: "warn",
  CONTACT_ATTEMPTED: "warn",
  CONTACTED: "info",
  REFERRED: "info",
  CLOSED: "neutral",
}

export const reviewTone: Record<ReviewStatus, Tone> = {
  DRAFT: "neutral",
  CLINICALLY_REVIEWED: "info",
  PUBLISHED: "ok",
  RETIRED: "neutral",
}

// --- barangay map shading ---

/** ColorBrewer "Purples", light to dark, to sit with the EunoiApp brand colour. */
export const MAP_STEPS = ["#efedf5", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"]
export const MAP_SUPPRESSED = "#d1d5db"

/** Which colour step a count falls in, given the largest visible count. */
export function stepFor(count: number, max: number) {
  return Math.min(MAP_STEPS.length - 1, Math.floor((count / Math.max(1, max)) * MAP_STEPS.length))
}

// --- dates (stored UTC, displayed in Philippine Time) ---

const PHT = "Asia/Manila"

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PHT,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PHT,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso))
}

export function minutesBetween(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)
}
