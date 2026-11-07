// Types mirror mental-health-app-data-dictionary.md. Enum values are UPPER_SNAKE_CASE as in section 8.

export type LanguageCode = "en" | "fil" | "ilo"

export type Sex = "FEMALE" | "MALE" | "PREFER_NOT_TO_SAY"

export type Sector =
  | "STUDENT"
  | "EMPLOYEE"
  | "SELF_EMPLOYED"
  | "UNEMPLOYED"
  | "SENIOR"
  | "OUT_OF_SCHOOL_YOUTH"
  | "HEALTHCARE_WORKER"
  | "OTHER"

export type AgeBand = "UNDER_18" | "18_24" | "25_34" | "35_44" | "45_59" | "60_PLUS"

export type StaffRole = "ADMIN" | "CASE_OFFICER" | "CONTENT_MANAGER" | "DPO"

export type InstrumentCode = "PHQ9" | "GAD7" | "WHO5" | "PHQ2" | "GAD2"

export type SeverityCode =
  | "MINIMAL"
  | "MILD"
  | "MODERATE"
  | "MODERATELY_SEVERE"
  | "SEVERE"
  | "GOOD"
  | "POOR"
  | "LIKELY_DEPRESSION"

export type ReviewStatus = "DRAFT" | "CLINICALLY_REVIEWED" | "PUBLISHED" | "RETIRED"

export type RiskSource =
  | "PHQ9_ITEM9"
  | "WHO5_LOW"
  | "SEVERE_SCORE"
  | "JOURNAL_KEYWORD"
  | "JOURNAL_CLASSIFIER"
  | "CHAT_KEYWORD"
  | "CHAT_CLASSIFIER"
  | "MOOD_TREND"

export type RiskLevel = "MODERATE" | "HIGH" | "CRISIS"
export type RiskStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "FALSE_ALARM"

export type EscalationStatus =
  | "QUEUED"
  | "ASSIGNED"
  | "CONTACT_ATTEMPTED"
  | "CONTACTED"
  | "REFERRED"
  | "CLOSED"

export type OutcomeCode =
  | "SUPPORT_PROVIDED"
  | "REFERRED_TO_SERVICE"
  | "NO_CONTACT_POSSIBLE"
  | "NOT_ACTIONABLE"

export type ServiceType =
  | "BARANGAY_HEALTH_CENTER"
  | "CITY_HEALTH_OFFICE"
  | "HOTLINE"
  | "HOSPITAL"
  | "PRIVATE_PRACTICE"
  | "NGO"
  | "SCHOOL_GUIDANCE"
  | "PEER_SUPPORT"

export type CostType = "FREE" | "SUBSIDIZED" | "PAID"

export type JournalDomain =
  | "MOOD"
  | "INTEREST"
  | "SLEEP"
  | "ENERGY"
  | "WORRY"
  | "CONCENTRATION"
  | "SELF_WORTH"

export type SuggestedAction =
  | "SELF_CARE"
  | "MONITOR"
  | "CONSIDER_PROFESSIONAL"
  | "PRIORITY_REFERRAL"
  | "CRISIS_SUPPORT"

export type ReportType = "SEVERITY_BY_BARANGAY" | "SECTOR_SUMMARY" | "ENGAGEMENT" | "TREND" | "CUSTOM"

export type ConsentType = "APP_USE" | "AI_ANALYSIS" | "PROFESSIONAL_SHARING"

// --- Identity store ---

export type StaffUser = {
  staff_id: string
  full_name: string
  email: string
  mfa_enabled: boolean
  role: StaffRole
  license_no: string | null
  status: "ACTIVE" | "DISABLED"
  created_at: string
}

// --- Clinical store (as exposed to a Case Officer) ---

export type RiskFlag = {
  flag_id: string
  user_id: string
  source: RiskSource
  source_ref_type: "ASSESSMENT" | "JOURNAL_ENTRY" | "CHAT_MESSAGE" | "MOOD_ENTRY" | null
  source_ref_id: string | null
  level: RiskLevel
  status: RiskStatus
  created_at: string
}

export type Escalation = {
  escalation_id: string
  flag_id: string
  assigned_staff_id: string | null
  user_contactable: boolean
  status: EscalationStatus
  outcome_code: OutcomeCode | null
  notes: string | null
  queued_at: string
  first_response_at: string | null
  closed_at: string | null
}

export type UserProfile = {
  user_id: string
  birth_year: number
  sex: Sex
  sector: Sector
  barangay_id: number
  language_code: LanguageCode
}

export type Assessment = {
  assessment_id: string
  user_id: string
  instrument_code: InstrumentCode
  raw_score: number
  scaled_score: number | null
  severity_code: SeverityCode
  critical_item_positive: boolean
  taken_at: string
}

export type MoodEntry = { entry_date: string; mood_score: number }

export type Consent = {
  consent_type: ConsentType
  granted: boolean
  decided_at: string
}

// --- Content store ---

export type Instrument = {
  instrument_id: number
  code: InstrumentCode
  name: string
  item_count: number
  min_response: number
  max_response: number
  score_direction: "HIGHER_WORSE" | "HIGHER_BETTER"
  recall_period_days: number | null
  scoring_version: string
  source_citation: string | null
  is_active: boolean
}

export type SeverityBand = {
  band_id: number
  instrument_id: number
  min_value: number
  max_value: number
  severity_code: SeverityCode
  label: string
  triggers_crisis_flow: boolean
}

export type AdviceContent = {
  advice_id: number
  instrument_id: number | null
  severity_code: SeverityCode | "CRISIS"
  language_code: LanguageCode
  headline: string
  message_body: string
  suggested_action: SuggestedAction
  version: number
  review_status: ReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  is_active: boolean
}

export type JournalPrompt = {
  prompt_id: number
  domain_code: JournalDomain
  language_code: LanguageCode
  prompt_text: string
  rotation_weight: number
  review_status: ReviewStatus
  is_active: boolean
}

export type Service = {
  service_id: number
  name: string
  service_type: ServiceType
  barangay_id: number | null
  address: string | null
  phone: string | null
  email: string | null
  schedule_text: string | null
  cost_type: CostType
  accepts_walk_in: boolean
  min_severity: SeverityCode | null
  is_crisis_service: boolean
  last_verified_at: string
  is_active: boolean
  languages: LanguageCode[]
  sectors: Sector[]
}

export type KnowledgeDocument = {
  doc_id: string
  title: string
  source_org: "DOH" | "NCMH" | "WHO" | "CITY_HEALTH_OFFICE" | "OTHER_VETTED"
  source_url: string | null
  language_code: LanguageCode
  approved_by: string
  approved_at: string
  is_active: boolean
  chunk_count: number
}

export type Barangay = {
  barangay_id: number
  name: string
  psgc_code: string | null
  district: string | null
}

// --- Audit log ---

export type AuditLog = {
  audit_id: number
  occurred_at: string
  actor_type: "USER" | "STAFF" | "SYSTEM"
  actor_id: string
  action: string
  target_type: string | null
  target_id: string | null
  reason_code: string | null
  result: "ALLOWED" | "DENIED"
  client_ip_hash: string | null
}

// --- Analytics store ---

export type AggScreeningMonthly = {
  period_month: string
  barangay_id: number
  sector: Sector
  age_band: AgeBand
  sex: Sex
  instrument_code: InstrumentCode
  severity_code: SeverityCode
  user_count: number | null
  suppressed: boolean
}

export type AggMoodWeekly = {
  period_week: string
  barangay_id: number
  user_count: number | null
  avg_mood: number | null
  suppressed: boolean
}

export type AggEngagementMonthly = {
  period_month: string
  barangay_id: number
  registered_users: number
  active_users: number
  assessments_started: number
  assessments_completed: number
  rescreens_completed: number
  referrals_suggested: number
  referrals_initiated: number
  escalations_opened: number
  suppressed: boolean
}

export type Report = {
  report_id: string
  generated_by: string
  report_type: ReportType
  filters_json: { from: string; to: string; barangay_id?: number; sector?: Sector; age_band?: AgeBand }
  format: "PDF" | "CSV"
  ai_summary_text: string | null
  file_ref: string | null
  generated_at: string
}
