import type {
  PaperSessionOperatorConfigurationSnapshot,
} from './PaperSessionOperatorConfiguration.js';

import type {
  PaperSessionWarmupQualificationReport,
} from './PaperSessionWarmupQualification.js';

export type PaperSessionBootstrapStatus =
  | 'READY'
  | 'BLOCKED';

export interface PaperSessionBootstrapInput {
  readonly configuration:
    PaperSessionOperatorConfigurationSnapshot;

  readonly warmup:
    PaperSessionWarmupQualificationReport;
}

export interface PaperSessionBootstrapReport {
  readonly status: PaperSessionBootstrapStatus;

  readonly sessionId: string;

  readonly bankroll: number;

  readonly provider:
    PaperSessionOperatorConfigurationSnapshot['provider'];

  readonly minimumChipValue: number;

  readonly synchronizedRounds: number;

  readonly syncVersion: number;

  readonly warmupStatus:
    PaperSessionWarmupQualificationReport['qualification']['status'];

  readonly warmupReason:
    PaperSessionWarmupQualificationReport['qualification']['reason'];

  readonly observationAllowed: boolean;

  readonly message: string;

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticExecutionAllowed: false;

  readonly humanSupervisionRequired: true;
}

/**
 * Final application gate between operator/session configuration,
 * institutional warmup qualification and PAPER launch composition.
 *
 * This component does not:
 * - parse manually pasted history;
 * - calculate entropy;
 * - calculate volatility/VIX;
 * - qualify the statistical table context;
 * - execute entries;
 * - authorize real money.
 *
 * It consumes already validated configuration and already calculated
 * institutional warmup qualification.
 *
 * Complexity:
 * - Time: O(1)
 * - Memory: O(1)
 */
export class PaperSessionBootstrap {
  public execute(
    input: PaperSessionBootstrapInput,
  ): PaperSessionBootstrapReport {
    this.validate(input);

    const configuration = input.configuration;
    const warmup = input.warmup;

    if (
      !warmup.qualified ||
      !warmup.qualification.decision
        .supervisedOperationAllowed
    ) {
      return Object.freeze({
        status: 'BLOCKED' as const,
        sessionId: configuration.sessionId,
        bankroll: configuration.bankroll,
        provider: configuration.provider,
        minimumChipValue:
          configuration.minimumChipValue,
        synchronizedRounds:
          warmup.synchronizedRounds,
        syncVersion:
          warmup.syncVersion,
        warmupStatus:
          warmup.qualification.status,
        warmupReason:
          warmup.qualification.reason,
        observationAllowed:
          warmup.observationAllowed,
        message:
          this.blockedMessage(warmup),
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      });
    }

    return Object.freeze({
      status: 'READY' as const,
      sessionId: configuration.sessionId,
      bankroll: configuration.bankroll,
      provider: configuration.provider,
      minimumChipValue:
        configuration.minimumChipValue,
      synchronizedRounds:
        warmup.synchronizedRounds,
      syncVersion:
        warmup.syncVersion,
      warmupStatus:
        warmup.qualification.status,
      warmupReason:
        warmup.qualification.reason,
      observationAllowed:
        warmup.observationAllowed,
      message:
        'Sessão PAPER qualificada para operação supervisionada.',
      paperOnly: true as const,
      liveMoneyAuthorization: false as const,
      automaticExecutionAllowed: false as const,
      humanSupervisionRequired: true as const,
    });
  }

  private validate(
    input: PaperSessionBootstrapInput,
  ): void {
    if (
      input === null ||
      typeof input !== 'object'
    ) {
      throw new Error(
        'paper_session_bootstrap_invalid_input',
      );
    }

    if (
      input.configuration.status !==
      'CONFIGURED'
    ) {
      throw new Error(
        'paper_session_bootstrap_configuration_not_ready',
      );
    }

    if (
      input.warmup.synchronizedRounds <= 0
    ) {
      throw new Error(
        'paper_session_bootstrap_history_not_synchronized',
      );
    }

    if (
      input.warmup.syncVersion <= 0
    ) {
      throw new Error(
        'paper_session_bootstrap_invalid_sync_version',
      );
    }

    if (
      input.warmup.liveMoneyAuthorization !==
      false ||
      input.warmup.automaticExecutionAllowed !==
      false
    ) {
      throw new Error(
        'paper_session_bootstrap_safety_invariant_violation',
      );
    }
  }

  private blockedMessage(
    warmup: PaperSessionWarmupQualificationReport,
  ): string {
    if (
      warmup.qualification.status ===
      'OBSERVE'
    ) {
      return [
        'Mesa ainda não qualificada para operação PAPER.',
        'Observação supervisionada permitida.',
        'Realize um novo Sync quando houver novas rodadas.',
      ].join(' ');
    }

    return [
      'Mesa bloqueada pela qualificação institucional.',
      `Motivo: ${warmup.qualification.reason}.`,
      'Realize novo Sync nesta mesa ou sincronize outra mesa.',
    ].join(' ');
  }
}
