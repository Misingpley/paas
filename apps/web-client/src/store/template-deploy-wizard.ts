import { ContainerDeploySpec, ServiceCategory } from '@paas/shared-types';

export interface StoreTemplateManifest {
  id: string;
  name: string;
  category: ServiceCategory;
  image: string;
  defaultMemoryMb: number;
  defaultCpuCores: number;
  internalPort: number;
  protocol: 'tcp' | 'udp';
  defaultEnv: Record<string, string>;
}

/**
 * Builds a ContainerDeploySpec from a 1-Click App Store template manifest and user overrides.
 */
export class TemplateDeployWizard {
  buildDeploySpec(
    template: StoreTemplateManifest,
    projectId: string,
    serviceId: string,
    customEnv: Record<string, string>,
  ): ContainerDeploySpec {
    const mergedEnv = { ...template.defaultEnv, ...customEnv };
    return {
      serviceId,
      projectId,
      category: template.category,
      image: template.image,
      env: mergedEnv,
      resources: {
        memoryMb: template.defaultMemoryMb,
        cpuCores: template.defaultCpuCores,
      },
      ports: [{ internalPort: template.internalPort, protocol: template.protocol }],
      volumes: [],
    };
  }
}
