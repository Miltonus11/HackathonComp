import type { ConsentRecord, ConsentType } from '@/domain/consent';
import type {
  LanguageCode,
  Sector,
  SessionIdentity,
  Sex,
  UserProfile,
} from '@/domain/profile';

export type RegistrationInput = {
  /** Any accepted PH format; the service normalizes it */
  mobile: string;
  password: string;
  /** Collected but never displayed */
  first_name: string;
  last_name: string;
  /** The username; the only name shown in the app */
  display_name: string;
  contact_for_followup: boolean;
  birth_year: number;
  sex: Sex;
  sector: Sector;
  barangay_id: number;
  language_code: LanguageCode;
  consents: Record<ConsentType, boolean>;
  notice_version: string;
};

/** Never contains password data. */
export type Session = {
  identity: SessionIdentity;
  profile: UserProfile;
  /** This user's consent ledger, oldest first */
  consents: ConsentRecord[];
};

export type AuthErrorCode =
  | 'INVALID_MOBILE'
  | 'WEAK_PASSWORD'
  | 'MOBILE_TAKEN'
  | 'BAD_CREDENTIALS'
  | 'CONSENT_REQUIRED'
  | 'INVALID_INPUT'
  | 'NOT_SIGNED_IN'
  /** Account exists but profile/consents were not saved; registering again finishes setup */
  | 'SETUP_INCOMPLETE'
  | 'NETWORK'
  | 'SERVER';

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    /** Per-input messages keyed by registration form field (e.g. mobile, password, username) */
    public fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthService {
  register(input: RegistrationInput): Promise<Session>;
  signIn(mobile: string, password: string): Promise<Session>;
  restore(): Promise<Session | null>;
  signOut(): Promise<void>;
  setConsent(type: ConsentType, granted: boolean, language: LanguageCode): Promise<Session>;
}
