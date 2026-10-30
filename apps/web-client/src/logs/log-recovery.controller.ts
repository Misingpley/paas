import { SmartLogDiagnostic } from '@paas/shared-types';

export interface RecoveryActionButton {
  serviceId: string;
  actionType: SmartLogDiagnostic['suggestedFix'];
  buttonLabel: string;
  apiEndpoint: string;
}

/**
 * Maps container crash diagnostics into interactive 1-Click Fix actions for the Web Terminal UI.
 */
export class LogRecoveryController {
  buildRecoveryAction(diagnostic: SmartLogDiagnostic): RecoveryActionButton {
    let buttonLabel: string;
    let apiEndpoint: string;

    switch (diagnostic.suggestedFix) {
      case 'INCREASE_MEMORY':
        buttonLabel = 'Increase RAM (+256 MB)';
        apiEndpoint = '/agent/telemetry/autoscale';
        break;
      case 'REALLOCATE_PORT':
        buttonLabel = 'Reassign Free Port';
        apiEndpoint = '/api/cluster/schedule';
        break;
      case 'SYNC_DB_CREDENTIALS':
        buttonLabel = 'Sync Vault Credentials';
        apiEndpoint = '/api/vault/encrypt';
        break;
      case 'RESTART_DEPENDENCY':
      default:
        buttonLabel = 'Restart Upstream Node';
        apiEndpoint = '/api/blueprint/plan';
        break;
    }

    return {
      serviceId: diagnostic.serviceId,
      actionType: diagnostic.suggestedFix,
      buttonLabel,
      apiEndpoint,
    };
  }

  formatTerminalBanner(diagnostic: SmartLogDiagnostic): string {
    return `[${diagnostic.errorCode}] ${diagnostic.humanExplanation} (service: ${diagnostic.serviceId})`;
  }
}
