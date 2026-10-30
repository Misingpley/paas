import { randomBytes } from 'crypto';
import { ClusterNodeTelemetry } from '@paas/shared-types';

export interface UserSession {
  token: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'DEVELOPER';
  createdAtMs: number;
}

/**
 * Manages authenticated user sessions and dynamic server node registration for the Web Console.
 */
export class WorkspaceSessionService {
  /**
   * Issues an authenticated user session with a cryptographically random 24-byte token.
   */
  issueSession(email: string, role: 'OWNER' | 'ADMIN' | 'DEVELOPER' = 'OWNER'): UserSession {
    const cleanEmail = email.trim().toLowerCase();
    const token = randomBytes(24).toString('hex');
    return {
      token,
      email: cleanEmail,
      role,
      createdAtMs: Date.now(),
    };
  }

  /**
   * Registers a new Linux worker node into the active cluster pool.
   */
  registerServerNode(
    hostname: string,
    publicIp: string,
    totalMemoryMb: number,
    cpuCores: number,
  ): ClusterNodeTelemetry {
    return {
      nodeId: `node-${Date.now()}`,
      hostname: hostname.trim(),
      publicIp: publicIp.trim(),
      status: 'ONLINE',
      totalMemoryMb,
      usedMemoryMb: 512,
      cpuCores,
      cpuLoadPercent: 12,
      activeContainers: 1,
    };
  }
}
