export interface BlueGreenDecision {
  status: 'SWITCHED_TO_GREEN' | 'ROLLED_BACK_TO_BLUE';
  activeContainerId: string;
  containerToStopId: string;
}

/**
 * Decides traffic cutover or automatic rollback during zero-downtime Blue-Green deployments.
 */
export class BlueGreenRolloutService {
  decideRolloutAction(
    blueContainerId: string,
    greenContainerId: string,
    isGreenHealthy: boolean,
  ): BlueGreenDecision {
    if (isGreenHealthy === true) {
      return {
        status: 'SWITCHED_TO_GREEN',
        activeContainerId: greenContainerId,
        containerToStopId: blueContainerId,
      };
    } else {
      return {
        status: 'ROLLED_BACK_TO_BLUE',
        activeContainerId: blueContainerId,
        containerToStopId: greenContainerId,
      };
    }
  }
}
