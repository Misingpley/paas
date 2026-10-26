import { ContainerResourceLimits } from '@paas/shared-types';

export interface DockerCgroupsHostConfig {
  Memory: number;
  NanoCpus: number;
  PidsLimit: number;
}

/**
 * Translates human-readable resource quotas (MB, cores) into Linux cgroups v2 parameters for Docker Engine.
 */
export class CgroupsConfigBuilder {
  buildHostResources(limits: ContainerResourceLimits): DockerCgroupsHostConfig {
    return {
      Memory: limits.memoryMb * 1024 * 1024,
      NanoCpus: Math.floor(limits.cpuCores * 1_000_000_000),
      PidsLimit: limits.pidsLimit ?? 256,
    };
  }
}
