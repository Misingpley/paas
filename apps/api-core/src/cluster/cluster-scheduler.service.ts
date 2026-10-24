import { ClusterNodeTelemetry } from '@paas/shared-types';

/**
 * Multi-node scheduler that selects the least-loaded cluster server for a new container.
 */
export class ClusterSchedulerService {
  selectOptimalNode(
    nodes: ClusterNodeTelemetry[],
    requiredMemoryMb: number,
  ): ClusterNodeTelemetry | null {
    const availableNodes = nodes.filter(
      (node) =>
        node.status === 'ONLINE' &&
        node.totalMemoryMb - node.usedMemoryMb >= requiredMemoryMb,
    );
    if (availableNodes.length === 0) {
      return null;
    }
    availableNodes.sort(
      (a, b) =>
        b.totalMemoryMb - b.usedMemoryMb - (a.totalMemoryMb - a.usedMemoryMb),
    );
    return availableNodes[0];
  }
}
