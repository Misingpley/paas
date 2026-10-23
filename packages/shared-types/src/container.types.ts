export type ServiceCategory =
  | 'WEB_APP'
  | 'GAME_VOICE'
  | 'DBAAS'
  | 'GIT_DEPLOY'
  | 'WEB_VDI'
  | 'MESSAGE_BROKER';

export type ContainerLifecycleStatus =
  | 'CREATING'
  | 'RUNNING'
  | 'HIBERNATING'
  | 'RESTARTING'
  | 'STOPPED'
  | 'FAILED';

/**
 * Resource limits translated to Linux cgroups v2 via Docker Engine API.
 */
export interface ContainerResourceLimits {
  memoryMb: number;
  cpuCores: number;
  pidsLimit?: number;
  autoScaleEnabled?: boolean;
  maxMemoryMb?: number;
}

export interface PortMapping {
  internalPort: number;
  externalPort?: number;
  protocol: 'tcp' | 'udp';
}

export interface VolumeMount {
  volumeName: string;
  mountPath: string;
  readOnly?: boolean;
}

/**
 * Container deployment payload sent from api-core to a target host-agent node.
 */
export interface ContainerDeploySpec {
  serviceId: string;
  projectId: string;
  targetNodeId?: string;
  category: ServiceCategory;
  image: string;
  env: Record<string, string>;
  resources: ContainerResourceLimits;
  ports: PortMapping[];
  volumes: VolumeMount[];
}
