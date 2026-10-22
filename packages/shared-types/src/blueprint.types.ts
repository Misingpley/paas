import { ContainerDeploySpec } from './container.types';

export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Single service node on the visual canvas (Vue Flow) and in DAG execution.
 */
export interface BlueprintNode {
  id: string;
  label: string;
  position: NodePosition;
  spec: Omit<ContainerDeploySpec, 'serviceId' | 'projectId'>;
}

/**
 * Automatic environment variable injection across connected nodes.
 */
export interface EnvInjectionMapping {
  targetEnvKey: string;
  valueTemplate: string;
}

/**
 * Directed dependency edge (sourceNodeId -> targetNodeId) in the project DAG.
 */
export interface BlueprintEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  envInjections?: EnvInjectionMapping[];
}

export interface ProjectBlueprint {
  projectId: string;
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
}
