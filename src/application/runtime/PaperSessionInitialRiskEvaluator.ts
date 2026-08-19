import {
  OperatorRiskProfileCalculator,
  type OperatorRiskProfile,
} from '../../domain/risk/OperatorRiskProfile.js';

import {
  RuntimeRiskDecisionGateway,
  type RuntimeRiskDecisionResult,
} from './RuntimeRiskDecisionGateway.js';

import type {
  PaperSessionOperatorConfigurationSnapshot,
} from './PaperSessionOperatorConfiguration.js';


export interface PaperSessionInitialRiskEvaluationInput {
  readonly configuration:
    PaperSessionOperatorConfigurationSnapshot;

  readonly nowEpochMs?: number;
}


export interface PaperSessionInitialRiskEvaluationReport {
  readonly profile:
    OperatorRiskProfile;

  readonly decision:
    RuntimeRiskDecisionResult;

  readonly currentBalance: number;

  readonly currentSessionPnl: 0;

  readonly requestedStake: number;

  readonly martingaleStep: 0;

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticExecutionAllowed: false;

  readonly humanSupervisionRequired: true;
}


/**
 * Produces the initial runtime risk decision for a configured PAPER session.
 *
 * Initial financial state is deterministic:
 * - current balance equals configured bankroll;
 * - session PnL is zero;
 * - martingale step is zero;
 * - requested stake is the calculated base stake.
 *
 * OTHER is used as the cooldown command type because this evaluation happens
 * before an operational ROUND/WIN/LOSS event. It remains subject to an active
 * cooldown without falsely recording an operational event.
 *
 * The risk verdict itself is never fabricated. It is produced by the
 * existing RuntimeRiskDecisionGateway.
 *
 * Complexity:
 * - Time: O(1)
 * - Memory: O(1)
 */
export class PaperSessionInitialRiskEvaluator {
  public constructor(
    private readonly profileCalculator:
      OperatorRiskProfileCalculator =
        new OperatorRiskProfileCalculator(),

    private readonly riskGateway:
      RuntimeRiskDecisionGateway =
        new RuntimeRiskDecisionGateway(),
  ) {}


  public evaluate(
    input:
      PaperSessionInitialRiskEvaluationInput,
  ): PaperSessionInitialRiskEvaluationReport {
    this.validate(
      input.configuration,
    );

    const profile =
      this.profileCalculator.calculate({
        bankroll:
          input.configuration.bankroll,

        riskMode:
          input.configuration.riskMode,

        allowMartingale:
          input.configuration.allowMartingale,
      });

    const currentBalance =
      input.configuration.bankroll;

    const currentSessionPnl =
      0 as const;

    const requestedStake =
      profile.baseStake;

    const martingaleStep =
      0 as const;

    const nowEpochMs =
      input.nowEpochMs ??
      Date.now();

    const decision =
      this.riskGateway.evaluate({
        profile,

        commandType:
          'OTHER',

        currentBalance,

        requestedStake,

        currentSessionPnl,

        martingaleStep,

        nowEpochMs,
      });

    return Object.freeze({
      profile,

      decision,

      currentBalance,

      currentSessionPnl,

      requestedStake,

      martingaleStep,

      paperOnly:
        true as const,

      liveMoneyAuthorization:
        false as const,

      automaticExecutionAllowed:
        false as const,

      humanSupervisionRequired:
        true as const,
    });
  }


  private validate(
    configuration:
      PaperSessionOperatorConfigurationSnapshot,
  ): void {
    if (
      configuration.status !==
      'CONFIGURED'
    ) {
      throw new Error(
        'paper_session_initial_risk_configuration_not_ready',
      );
    }

    if (
      !Number.isFinite(
        configuration.bankroll,
      ) ||
      configuration.bankroll <= 0
    ) {
      throw new Error(
        'paper_session_initial_risk_invalid_bankroll',
      );
    }

    if (
      configuration.riskMode !==
        'CONSERVATIVE' &&
      configuration.riskMode !==
        'MODERATE' &&
      configuration.riskMode !==
        'AGGRESSIVE'
    ) {
      throw new Error(
        'paper_session_initial_risk_invalid_mode',
      );
    }

    if (
      typeof
        configuration.allowMartingale !==
      'boolean'
    ) {
      throw new Error(
        'paper_session_initial_risk_invalid_martingale_policy',
      );
    }
  }
}
