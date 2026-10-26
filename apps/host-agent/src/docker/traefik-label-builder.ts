import { ContainerDeploySpec } from '@paas/shared-types';

/**
 * Builds Docker container labels for Zero-Config Traefik routing and Sablier hibernation.
 */
export class TraefikLabelBuilder {
  buildLabels(spec: ContainerDeploySpec, subdomain?: string): Record<string, string> {
    const labels: Record<string, string> = {
      'paas.project.id': spec.projectId,
      'paas.service.id': spec.serviceId,
    };

    if (spec.category === 'WEB_APP' && subdomain) {
      labels['traefik.enable'] = 'true';
      labels[`traefik.http.routers.${spec.serviceId}.rule`] = `Host(\`${subdomain}.paas.local\`)`;
      labels['sablier.enable'] = 'true';
      labels['sablier.group'] = spec.projectId;
    }

    return labels;
  }
}
