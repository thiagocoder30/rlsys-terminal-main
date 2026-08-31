import type {
  ManualRoundIngestionSourcePort,
  OperatorRecommendation,
  OperatorRoundResult,
  OperatorRuntimePort,
  OperatorRuntimeStatus,
  OperatorStatusSourcePort,
  RecommendationSourcePort,
} from './OperatorRuntimePorts.js';


/**
 * Stable application boundary between the Enterprise CLI
 * and the existing supervised operator runtime.
 *
 * Responsibilities:
 *
 * - expose one narrow operator-facing runtime port;
 * - validate roulette round input before delegation;
 * - preserve manual-only supervised operation;
 * - keep CLI commands independent from concrete engines.
 *
 * This facade MUST NOT:
 *
 * - own stdin/stdout;
 * - calculate strategy signals;
 * - calculate stake;
 * - settle entries;
 * - authorize automatic execution;
 * - duplicate Triplicacao or Fusion logic.
 */
export class OperatorRuntimeFacade
implements OperatorRuntimePort {

  public constructor(
    private readonly statusSource:
      OperatorStatusSourcePort,

    private readonly roundSource:
      ManualRoundIngestionSourcePort,

    private readonly recommendationSource:
      RecommendationSourcePort,
  ) {}


  public getStatus():
    OperatorRuntimeStatus {

    const status =
      this.statusSource
        .getOperatorStatus();


    this.assertSafeStatus(
      status,
    );


    return status;

  }


  public async ingestRound(
    round: number,
  ): Promise<OperatorRoundResult> {

    if (
      !Number.isInteger(round)
      || round < 0
      || round > 36
    ) {

      return {
        accepted: false,
        round,
        roundCount:
          this.getStatus()
            .roundCount,
        phase:
          this.getStatus()
            .phase,
        message:
          'round must be an integer between 0 and 36',
      };

    }


    return this.roundSource
      .ingestRound(
        round,
      );

  }


  public async getLatestRecommendation():
    Promise<OperatorRecommendation> {

    const recommendation =
      await this.recommendationSource
        .getLatestRecommendation();


    this.assertSafeRecommendation(
      recommendation,
    );


    return recommendation;

  }


  private assertSafeStatus(
    status: OperatorRuntimeStatus,
  ): void {

    if (
      status.operatorMode
        !== 'SUPERVISED'
    ) {

      throw new Error(
        'operator runtime must remain supervised',
      );

    }


    if (
      status.execution
        !== 'MANUAL_OPERATOR_ONLY'
    ) {

      throw new Error(
        'operator runtime must remain manual-only',
      );

    }


    if (
      status.automaticEntry
        !== false
    ) {

      throw new Error(
        'automatic entry must remain disabled',
      );

    }

  }


  private assertSafeRecommendation(
    recommendation:
      OperatorRecommendation,
  ): void {

    if (
      recommendation
        .operatorDecisionRequired
        !== true
    ) {

      throw new Error(
        'operator decision must remain required',
      );

    }


    if (
      recommendation
        .supervisedRecommendationOnly
        !== true
    ) {

      throw new Error(
        'recommendation must remain supervised-only',
      );

    }


    if (
      recommendation
        .automaticEntry
        !== false
    ) {

      throw new Error(
        'automatic entry must remain disabled',
      );

    }

  }

}
