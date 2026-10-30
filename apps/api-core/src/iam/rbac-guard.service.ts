export type ProjectRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';

export type RbacAction =
  | 'VIEW_TELEMETRY'
  | 'DEPLOY_SERVICE'
  | 'READ_SECRETS'
  | 'DELETE_PROJECT';

export interface AuditLogEntry {
  id: string;
  userId: string;
  projectId: string;
  action: RbacAction;
  ipAddress: string;
  timestampIso: string;
}

const ROLE_PERMISSIONS: Record<ProjectRole, RbacAction[]> = {
  OWNER: ['VIEW_TELEMETRY', 'DEPLOY_SERVICE', 'READ_SECRETS', 'DELETE_PROJECT'],
  ADMIN: ['VIEW_TELEMETRY', 'DEPLOY_SERVICE', 'READ_SECRETS'],
  DEVELOPER: ['VIEW_TELEMETRY', 'DEPLOY_SERVICE'],
  VIEWER: ['VIEW_TELEMETRY'],
};

/**
 * Enforces Role-Based Access Control (RBAC) policies and generates immutable security audit logs.
 */
export class RbacGuardService {
  /**
   * Checks whether a given project role is permitted to perform the requested action.
   */
  canPerformAction(role: ProjectRole, action: RbacAction): boolean {
    const allowed = ROLE_PERMISSIONS[role] ?? [];
    return allowed.includes(action);
  }

  /**
   * Creates an immutable security audit log entry for a privileged operation.
   */
  createAuditEntry(
    userId: string,
    projectId: string,
    action: RbacAction,
    ipAddress: string,
  ): AuditLogEntry {
    return {
      id: `audit-${Date.now()}`,
      userId,
      projectId,
      action,
      ipAddress,
      timestampIso: new Date().toISOString(),
    };
  }
}
