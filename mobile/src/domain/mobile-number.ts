/**
 * Normalizes a Philippine mobile number to the canonical `+639XXXXXXXXX`.
 * Accepts 09XXXXXXXXX, 9XXXXXXXXX, 639XXXXXXXXX and +639XXXXXXXXX; spaces, dashes,
 * dots and parentheses are ignored. Returns null for anything else.
 */
export function normalizePhMobile(input: string): string | null {
  const cleaned = input.replace(/[\s\-.()]/g, '');
  const match = /^(?:\+?63|0)?(9\d{9})$/.exec(cleaned);
  return match ? `+63${match[1]}` : null;
}
