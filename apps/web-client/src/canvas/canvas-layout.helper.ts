import { NodePosition, ProjectBlueprint } from '@paas/shared-types';

/**
 * Coordinate snapping and topology helper for the Visual Blueprint Architect canvas.
 */
export class CanvasLayoutHelper {
  snapToGrid(position: NodePosition, gridSize: number = 20): NodePosition {
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize,
    };
  }

  findIsolatedNodes(blueprint: ProjectBlueprint): string[] {
    return blueprint.nodes
      .filter((node) => {
        const isConnected = blueprint.edges.some(
          (edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id,
        );
        return !isConnected;
      })
      .map((node) => node.id);
  }
}
