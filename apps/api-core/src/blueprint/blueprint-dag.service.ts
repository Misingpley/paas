import { BlueprintNode, ProjectBlueprint } from '@paas/shared-types';

/**
 * Resolves container startup order (DAG topological sort) and environment variable injection.
 */
export class BlueprintDagService {
  /**
   * Replaces "{{HOST}}" placeholder in an env template with the internal Docker DNS hostname "svc-<sourceNodeId>".
   */
  interpolateEnvTemplate(template: string, sourceNodeId: string): string {
    return template.replaceAll('{{HOST}}', `svc-${sourceNodeId}`);
  }

  /**
   * Computes safe container launch order using Kahn's topological sort algorithm.
   */
  buildExecutionOrder(blueprint: ProjectBlueprint): BlueprintNode[] {
    const nodeMap = new Map<string, BlueprintNode>();
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of blueprint.nodes) {
      nodeMap.set(node.id, structuredClone(node));
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const edge of blueprint.edges) {
      adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
      inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);

      const targetNode = nodeMap.get(edge.targetNodeId);
      if (targetNode && edge.envInjections) {
        for (const injection of edge.envInjections) {
          targetNode.spec.env[injection.targetEnvKey] = this.interpolateEnvTemplate(
            injection.valueTemplate,
            edge.sourceNodeId,
          );
        }
      }
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const orderedNodes: BlueprintNode[] = [];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      orderedNodes.push(nodeMap.get(currentId)!);

      for (const neighborId of adjacency.get(currentId) ?? []) {
        const nextDegree = (inDegree.get(neighborId) ?? 1) - 1;
        inDegree.set(neighborId, nextDegree);
        if (nextDegree === 0) {
          queue.push(neighborId);
        }
      }
    }

    if (orderedNodes.length !== blueprint.nodes.length) {
      throw new Error('Cycle detected in blueprint graph');
    }

    return orderedNodes;
  }
}
