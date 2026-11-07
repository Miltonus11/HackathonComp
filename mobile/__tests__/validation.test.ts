import {
  validateBirthYear,
  validateName,
  validatePassword,
  validateRegistration,
  validateUsername,
} from '@/domain/validation';

const NOW = new Date('2026-11-07T00:00:00Z');

describe('validatePassword', () => {
  it('rejects short and whitespace-only passwords', () => {
    expect(validatePassword('short')).toEqual(expect.any(String));
    expect(validatePassword('        ')).toEqual(expect.any(String));
  });
  it('accepts a long enough password', () => {
    expect(validatePassword('longenough1')).toBeNull();
  });
});

describe('validateBirthYear', () => {
  it.each(['2031', '1899', '19x5', ''])('rejects %j', (v) => {
    expect(validateBirthYear(v, NOW)).toEqual(expect.any(String));
  });
  it.each(['2010', '1990', '2026'])('accepts %j (minors are allowed, no gating)', (v) => {
    expect(validateBirthYear(v, NOW)).toBeNull();
  });
});

describe('validateName', () => {
  it('rejects empty, whitespace-only and over-long names', () => {
    expect(validateName('')).toEqual(expect.any(String));
    expect(validateName('   ')).toEqual(expect.any(String));
    expect(validateName('a'.repeat(151))).toEqual(expect.any(String));
  });
  it('accepts normal names including Filipino characters', () => {
    expect(validateName('Juan')).toBeNull();
    expect(validateName('Dela Cruz')).toBeNull();
    expect(validateName('Ñoño')).toBeNull();
  });
});

describe('validateUsername', () => {
  it('rejects empty, too short and too long usernames', () => {
    expect(validateUsername('')).toEqual(expect.any(String));
    expect(validateUsername('   ')).toEqual(expect.any(String));
    expect(validateUsername('ab')).toEqual(expect.any(String));
    expect(validateUsername('a'.repeat(31))).toEqual(expect.any(String));
  });
  it('accepts 3 to 30 characters, trimmed', () => {
    expect(validateUsername('juan_dc')).toBeNull();
    expect(validateUsername('  abc  ')).toBeNull();
    expect(validateUsername('a'.repeat(30))).toBeNull();
  });
});

const valid = {
  username: 'juan_dc',
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  mobile: '0917 123 4567',
  password: 'longenough1',
  confirm_password: 'longenough1',
  birth_year: '2010',
  sex: 'MALE',
  sector: 'STUDENT',
  barangay_id: 1,
} as const;

describe('validateRegistration', () => {
  it('returns {} for a valid payload, including a minor', () => {
    expect(validateRegistration(valid, NOW)).toEqual({});
  });
  it.each([
    ['username', { username: 'ab' }],
    ['first_name', { first_name: '  ' }],
    ['last_name', { last_name: '' }],
    ['mobile', { mobile: '0817 123 4567' }],
    ['password', { password: 'short', confirm_password: 'short' }],
    ['confirm_password', { confirm_password: 'different1' }],
    ['birth_year', { birth_year: '2031' }],
    ['sex', { sex: undefined }],
    ['sector', { sector: undefined }],
    ['barangay_id', { barangay_id: undefined }],
  ])('flags %s', (field, patch) => {
    const errors = validateRegistration({ ...valid, ...patch }, NOW);
    expect(errors[field]).toEqual(expect.any(String));
  });
});
