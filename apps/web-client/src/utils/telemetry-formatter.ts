import { ClusterNodeTelemetry } from '@paas/shared-types';

export type UsageSeverity = 'healthy' | 'warning' | 'critical';

export interface NodeDashboardCardViewModel {
  nodeId: string;
  hostname: string;
  memoryUsagePercent: number;
  severity: UsageSeverity;
}

/**
 * Formats raw cluster node telemetry into UI dashboard progress bars and severity badges.
 */
export class TelemetryFormatter {
  formatNodeCard(node: ClusterNodeTelemetry): NodeDashboardCardViewModel {
    const memoryUsagePercent = Math.round((node.usedMemoryMb / node.totalMemoryMb) * 100);
    let severity: UsageSeverity;

    if (memoryUsagePercent >= 85 || node.cpuLoadPercent >= 85) {
      severity = 'critical';
    } else if (memoryUsagePercent >= 65 || node.cpuLoadPercent >= 65) {
      severity = 'warning';
    } else {
      severity = 'healthy';
    }

    return {
      nodeId: node.nodeId,
      hostname: node.hostname,
      memoryUsagePercent,
      severity,
    };
  }
}
