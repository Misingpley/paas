/**
 * Allocates free external TCP/UDP host ports for user containers.
 */
export class PortAllocatorService {
  findAvailablePort(
    usedPorts: number[],
    minPort = 10000,
    maxPort = 20000,
  ): number {
    for (let port = minPort; port <= maxPort; port++) {
      if (!usedPorts.includes(port)) {
        return port;
      }
    }
    throw new Error('No free ports available');
  }
}
