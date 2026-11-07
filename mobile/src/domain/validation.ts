import { normalizePhMobile } from './mobile-number';
import { SECTORS, SEXES, type Sector, type Sex } from './profile';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_NAME_LENGTH = 150;
export const MIN_BIRTH_YEAR = 1900;

export function validatePassword(pw: string): string | null {
  if (pw.trim().length === 0) return 'Enter a password.';
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** No age gating: any year from 1900 up to the current year is accepted. */
export function validateBirthYear(raw: string, now: Date = new Date()): string | null {
  if (!/^\d{4}$/.test(raw.trim())) return 'Enter a 4-digit birth year.';
  const year = Number(raw);
  if (year < MIN_BIRTH_YEAR || year > now.getFullYear()) {
    return `Enter a year between ${MIN_BIRTH_YEAR} and ${now.getFullYear()}.`;
  }
  return null;
}

export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'This field is required.';
  if (name.length > MAX_NAME_LENGTH) return `Must be ${MAX_NAME_LENGTH} characters or fewer.`;
  return null;
}

export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;

/** The username is the only name shown in the app (it is stored as display_name). */
export function validateUsername(raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'Choose a username.';
  if (name.length < MIN_USERNAME_LENGTH) {
    return `Username must be at least ${MIN_USERNAME_LENGTH} characters.`;
  }
  if (name.length > MAX_USERNAME_LENGTH) {
    return `Username must be ${MAX_USERNAME_LENGTH} characters or fewer.`;
  }
  return null;
}

export type RegistrationFields = {
  username: string;
  first_name: string;
  last_name: string;
  mobile: string;
  password: string;
  confirm_password: string;
  birth_year: string;
  sex: Sex;
  sector: Sector;
  barangay_id: number;
};

/** Returns field → message. An empty object means the payload is valid. */
export function validateRegistration(
  f: Partial<RegistrationFields>,
  now: Date = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  const set = (field: string, msg: string | null) => {
    if (msg) errors[field] = msg;
  };

  set('username', validateUsername(f.username ?? ''));
  set('first_name', validateName(f.first_name ?? ''));
  set('last_name', validateName(f.last_name ?? ''));
  set(
    'mobile',
    normalizePhMobile(f.mobile ?? '') ? null : 'Enter a valid PH mobile number, e.g. 0917 123 4567.',
  );
  set('password', validatePassword(f.password ?? ''));
  if (!errors.password && f.password !== f.confirm_password) {
    errors.confirm_password = 'Passwords do not match.';
  }
  set('birth_year', validateBirthYear(f.birth_year ?? '', now));
  set('sex', f.sex && SEXES.includes(f.sex) ? null : 'Choose an option.');
  set('sector', f.sector && SECTORS.includes(f.sector) ? null : 'Choose an option.');
  set('barangay_id', f.barangay_id == null ? 'Choose your barangay.' : null);
  return errors;
}
