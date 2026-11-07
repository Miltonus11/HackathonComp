import { normalizePhMobile } from '@/domain/mobile-number';

describe('normalizePhMobile', () => {
  it.each(['0917 123 4567', '+63 917-123-4567', '917 123 4567', '639171234567', '09171234567'])(
    'normalizes %s',
    (input) => {
      expect(normalizePhMobile(input)).toBe('+639171234567');
    },
  );

  it.each(['0817 123 4567', '091712345', '09171234567890', 'abc', '', '   ', '+1 917 123 4567'])(
    'rejects %j',
    (input) => {
      expect(normalizePhMobile(input)).toBeNull();
    },
  );
});
