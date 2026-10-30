import {
  BlueprintEdge,
  EnvInjectionMapping,
  ProjectBlueprint,
  ServiceCategory,
} from '@paas/shared-types';

/**
 * State controller for the Visual Blueprint Architect (DAG Canvas).
 * Handles node connections and automatic environment variable injection templates.
 */
export class BlueprintCanvasStore {
  inferDefaultEnvInjections(sourceCategory: ServiceCategory): EnvInjectionMapping[] {
    if (sourceCategory === 'DBAAS') {
      return [
        {
          targetEnvKey: 'DATABASE_URL',
          valueTemplate: 'postgresql://postgres:postgres@{{HOST}}:5432/app',
        },
      ];
    } else if (sourceCategory === 'MESSAGE_BROKER') {
      return [
        {
          targetEnvKey: 'BROKER_URL',
          valueTemplate: 'amqp://guest:guest@{{HOST}}:5672',
        },
      ];
    } else {
      return [
        {
          targetEnvKey: 'UPSTREAM_HOST',
          valueTemplate: '{{HOST}}',
        },
      ];
    }
  }

  connectNodes(
    blueprint: ProjectBlueprint,
    sourceNodeId: string,
    targetNodeId: string,
  ): BlueprintEdge {
    if (sourceNodeId === targetNodeId) {
      throw new Error('Cannot connect a node to itself');
    }

    const sourceNode = blueprint.nodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode) {
      throw new Error('Source node not found');
    }

    const envInjections = this.inferDefaultEnvInjections(sourceNode.spec.category);
    const newEdge: BlueprintEdge = {
      id: `edge-${sourceNodeId}-${targetNodeId}`,
      sourceNodeId,
      targetNodeId,
      envInjections,
    };

    blueprint.edges.push(newEdge);
    return newEdge;
  }
}
