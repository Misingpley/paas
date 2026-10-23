import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Cryptographic vault for encrypting service environment variables (AES-256-GCM).
 */
export class SecretVaultService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(masterSecret?: string) {
    this.key = scryptSync(masterSecret || 'default-secret-key', 'paas-vault-salt', 32);
  }

  encryptEnv(env: Record<string, string>): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const jsonString = JSON.stringify(env);
    const encrypted = Buffer.concat([cipher.update(jsonString, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptEnv(encryptedPayload: string): Record<string, string> {
    const [ivHex, authTagHex, cipherHex] = encryptedPayload.split(':');
    const decipher = createDecipheriv(this.algorithm, this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, 'hex')),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8'));
  }
}
