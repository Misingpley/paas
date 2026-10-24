import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Service for hashing and verifying user passwords using scrypt + random salt.
 */
export class PasswordHashService {
  hashPassword(plainPassword: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(plainPassword, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(plainPassword: string, storedHash: string): boolean {
    const [salt, originalHash] = storedHash.split(':');
    const hashBuffer = scryptSync(plainPassword, salt, 64);
    const originalBuffer = Buffer.from(originalHash, 'hex');
    return timingSafeEqual(hashBuffer, originalBuffer);
  }
}
