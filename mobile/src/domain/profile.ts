export type LanguageCode = 'en' | 'fil';

export const SEXES = ['FEMALE', 'MALE', 'PREFER_NOT_TO_SAY'] as const;
export type Sex = (typeof SEXES)[number];

export const SECTORS = [
  'STUDENT',
  'EMPLOYEE',
  'SELF_EMPLOYED',
  'UNEMPLOYED',
  'SENIOR',
  'OUT_OF_SCHOOL_YOUTH',
  'HEALTHCARE_WORKER',
  'OTHER',
] as const;
export type Sector = (typeof SECTORS)[number];

/** Pseudonymous-ID-linked registration data; not directly identifying on its own. */
export type UserProfile = {
  user_id: string;
  birth_year: number;
  sex: Sex;
  sector: Sector;
  occupation_detail?: string;
  barangay_id: number;
  language_code: LanguageCode;
  onboarding_completed_at: string | null;
  created_at: string;
};

/**
 * Who the person is. Kept in a separate store from UserProfile, linked only by user_id.
 * first_name / last_name are collected and stored but are never shown in the app; the
 * username (display_name) is the only name the UI uses.
 */
export type Identity = {
  identity_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  /** The username chosen at registration; shown in the app */
  display_name: string;
  /** Canonical +639XXXXXXXXX */
  mobile_number: string;
  contact_for_followup: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETION_REQUESTED' | 'DELETED';
  created_at: string;
  last_login_at: string | null;
};

/** What the UI may hold: Identity without the real names, so they cannot be rendered. */
export type SessionIdentity = Omit<Identity, 'first_name' | 'last_name'>;
