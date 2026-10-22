export type ServiceCategory =
  | 'WEB_APP'
  | 'NETWORK_VPN'
  | 'GAME_VOICE'
  | 'DBAAS'
  | 'GIT_DEPLOY'
  | 'WEB_VDI';

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
 * Container deployment payload sent from api-core to host-agent.
 */
export interface ContainerDeploySpec {
  serviceId: string;
  projectId: string;
  category: ServiceCategory;
  image: string;
  env: Record<string, string>;
  resources: ContainerResourceLimits;
  ports: PortMapping[];
  volumes: VolumeMount[];
  linuxCapabilities?: ('NET_ADMIN' | 'SYS_TIME')[];
}
