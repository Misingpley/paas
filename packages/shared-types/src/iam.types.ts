export type ProjectRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';

export type ClusterNodeStatus = 'ONLINE' | 'OFFLINE' | 'DRAINING';

export interface UserProfileDto {
  id: string;
  email: string;
  displayName: string;
  githubUsername?: string;
  createdAt: string;
}

export interface ClusterNodeTelemetry {
  nodeId: string;
  hostname: string;
  publicIp: string;
  status: ClusterNodeStatus;
  totalMemoryMb: number;
  usedMemoryMb: number;
  cpuCores: number;
  cpuLoadPercent: number;
  activeContainers: number;
}
