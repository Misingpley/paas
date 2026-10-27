/**
 * Evaluates live container RAM usage and computes vertical cgroups scale-up limits without container restart.
 */
export class VerticalAutoScalerService {
  evaluateMemoryScaleUp(
    currentUsageMb: number,
    currentLimitMb: number,
    maxMemoryMb: number,
    autoScaleEnabled: boolean,
  ): number | null {
    if (!autoScaleEnabled || currentLimitMb >= maxMemoryMb) {
      return null;
    }
    const usageRatio = currentUsageMb / currentLimitMb;
    if (usageRatio >= 0.85) {
      return Math.min(currentLimitMb + 256, maxMemoryMb);
    }
    return null;
  }
}
