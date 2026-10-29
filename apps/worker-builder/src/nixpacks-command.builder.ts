/**
 * Builds deterministic OCI image tags and Nixpacks CLI arguments for Git-to-Deploy builds.
 */
export class NixpacksCommandBuilder {
  buildImageTag(serviceId: string, commitSha: string): string {
    const shortSha = commitSha.slice(0, 7);
    return `localhost:5000/app-${serviceId}:${shortSha}`;
  }

  buildNixpacksArgs(workDir: string, imageTag: string): string[] {
    return ['build', workDir, '--name', imageTag];
  }
}
