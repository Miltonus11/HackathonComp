import type { LanguageCode, Sector, Sex } from '@/domain/profile';

type Labels = Record<LanguageCode, string>;

export const SEX_LABELS: Record<Sex, Labels> = {
  FEMALE: { en: 'Female', fil: 'Babae' },
  MALE: { en: 'Male', fil: 'Lalaki' },
  PREFER_NOT_TO_SAY: { en: 'Prefer not to say', fil: 'Ayaw kong sabihin' },
};

export const SECTOR_LABELS: Record<Sector, Labels> = {
  STUDENT: { en: 'Student', fil: 'Estudyante' },
  EMPLOYEE: { en: 'Employee', fil: 'Empleyado' },
  SELF_EMPLOYED: { en: 'Self-employed', fil: 'May sariling negosyo / trabaho' },
  UNEMPLOYED: { en: 'Unemployed', fil: 'Walang trabaho' },
  SENIOR: { en: 'Senior citizen', fil: 'Senior citizen' },
  OUT_OF_SCHOOL_YOUTH: { en: 'Out-of-school youth', fil: 'Out-of-school youth' },
  HEALTHCARE_WORKER: { en: 'Healthcare worker', fil: 'Manggagawang pangkalusugan' },
  OTHER: { en: 'Other', fil: 'Iba pa' },
};

/**
 * PLACEHOLDER subset of City of San Fernando (La Union) barangays for mock data.
 * [VERIFY] against the city's official list and PSGC codes before launch.
 */
export const BARANGAYS: { barangay_id: number; name: string }[] = [
  { barangay_id: 1, name: 'Biday' },
  { barangay_id: 2, name: 'Bungro' },
  { barangay_id: 3, name: 'Carlatan' },
  { barangay_id: 4, name: 'Catbangen' },
  { barangay_id: 5, name: 'Lingsat' },
  { barangay_id: 6, name: 'Madayegdeg' },
  { barangay_id: 7, name: 'Pagudpud' },
  { barangay_id: 8, name: 'Pagdalagan Sur' },
  { barangay_id: 9, name: 'Poro' },
  { barangay_id: 10, name: 'San Agustin' },
  { barangay_id: 11, name: 'Sevilla' },
  { barangay_id: 12, name: 'Tanqui' },
];
