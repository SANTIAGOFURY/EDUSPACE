import * as crypto from 'crypto';

/**
 * Generates a unique user ID in the format:
 * USE-xxxx-xxxxx-xxxxxxx-xxxxxxxx
 * Uses crypto.randomBytes for cryptographic randomness.
 */
export function generateUserId(): string {
  const segments = [4, 5, 7, 8]; // character counts for each segment
  const parts = segments.map((len) =>
    crypto.randomBytes(Math.ceil(len / 2))
      .toString('hex')
      .slice(0, len)
  );
  return `USE-${parts.join('-')}`;
}