import {
  PaperSessionOperatorConfiguration,
  type PaperSessionOperatorConfigurationInput,
  type PaperSessionOperatorConfigurationSnapshot,
} from './PaperSessionOperatorConfiguration.js';

import {
  PaperSessionHistoryInputParser,
  type PaperSessionHistoryInputParserResult,
} from './PaperSessionHistoryInputParser.js';

import {
  PaperSessionHistorySyncState,
  type PaperSessionHistorySyncSnapshot,
} from './PaperSessionHistorySyncState.js';

import {
  PaperSessionHistoryChronologyNormalizer,
} from './PaperSessionHistoryChronologyNormalizer.js';

import {
  PaperSessionWarmupQualification,
  type PaperSessionWarmupQualificationReport,
} from './PaperSessionWarmupQualification.js';

import type {
  PaperSessionBootstrapInput,
} from './PaperSessionBootstrap.js';

export type PaperSessionSetupStatus =
  | 'PENDING_CONFIGURATION'
  | 'CONFIGURED'
  | 'SYNCHRONIZED'
  | 'QUALIFIED'
  | 'OBSERVE'
  | 'BLOCKED';

export interface PaperSessionSetupSnapshot {
  readonly status: PaperSessionSetupStatus;
  readonly configuration:
    PaperSessionOperatorConfigurationSnapshot | null;
  readonly history: PaperSessionHistorySyncSnapshot;
  readonly qualification:
    PaperSessionWarmupQualificationReport | null;
}

export interface PaperSessionSyncResult {
  readonly parsed: PaperSessionHistoryInputParserResult;
  readonly history?: PaperSessionHistorySyncSnapshot;
}

export interface PaperSessionQualificationResult {
  readonly qualification:
    PaperSessionWarmupQualificationReport;
  readonly bootstrapInput: PaperSessionBootstrapInput;
}

/**
 * Coordinates operator-controlled PAPER session setup.
 *
 * Responsibilities:
 * - configure session identity, bankroll and provider;
 * - parse manually pasted roulette history;
 * - maintain sync/resync state;
 * - invoke institutional warmup qualification;
 * - expose bootstrap-ready input.
 *
 * This component does not:
 * - read from stdin;
 * - render CLI output;
 * - calculate entropy or VIX;
 * - authorize live money;
 * - execute entries.
 *
 * Complexity:
 * - configure: O(1)
 * - sync/resync: O(n)
 * - qualify: O(n), delegated to warmup qualification
 */
export class PaperSessionSetupCoordinator {
  private configurationSnapshot:
    PaperSessionOperatorConfigurationSnapshot | null = null;

  private qualificationSnapshot:
    PaperSessionWarmupQualificationReport | null = null;

  public constructor(
    private readonly configuration:
      PaperSessionOperatorConfiguration =
        new PaperSessionOperatorConfiguration(),
    private readonly parser:
      PaperSessionHistoryInputParser =
        new PaperSessionHistoryInputParser(),
    private readonly historyState:
      PaperSessionHistorySyncState =
        new PaperSessionHistorySyncState(),
    private readonly warmupQualification:
      PaperSessionWarmupQualification =
        new PaperSessionWarmupQualification(),

    private readonly chronology:
      PaperSessionHistoryChronologyNormalizer =
        new PaperSessionHistoryChronologyNormalizer(),
  ) {}

  public configure(
    input: PaperSessionOperatorConfigurationInput,
  ): PaperSessionOperatorConfigurationSnapshot {
    const snapshot =
      this.configuration.configure(input);

    this.configurationSnapshot = snapshot;
    this.qualificationSnapshot = null;

    return snapshot;
  }

  public sync(
    rawHistory: string,
    synchronizedAtEpochMs?: number,
  ): PaperSessionSyncResult {
    this.ensureConfigured();

    const parsed = this.parser.parse(rawHistory);

    if (!parsed.accepted) {
      return {
        parsed,
      };
    }

    const canonicalHistory =
      this.chronology
        .normalizeNewestFirst(
          parsed.rounds,
        );

    const history = this.historyState.sync({
      rounds:
        canonicalHistory.rounds,

      synchronizedAtEpochMs,
    });

    this.qualificationSnapshot = null;

    return {
      parsed,
      history,
    };
  }

  public resync(
    rawHistory: string,
    synchronizedAtEpochMs?: number,
  ): PaperSessionSyncResult {
    this.ensureConfigured();

    const parsed = this.parser.parse(rawHistory);

    if (!parsed.accepted) {
      return {
        parsed,
      };
    }

    const canonicalHistory =
      this.chronology
        .normalizeNewestFirst(
          parsed.rounds,
        );

    const history = this.historyState.resync({
      rounds:
        canonicalHistory.rounds,

      synchronizedAtEpochMs,
    });

    this.qualificationSnapshot = null;

    return {
      parsed,
      history,
    };
  }

  public qualify(
    requiredWarmupSize?: number,
  ): PaperSessionQualificationResult {
    const configuration =
      this.ensureConfigured();

    const history =
      this.historyState.current();

    const qualification =
      this.warmupQualification.qualify({
        history,
        requiredWarmupSize,
      });

    this.qualificationSnapshot =
      qualification;

    return {
      qualification,
      bootstrapInput: {
        configuration,
        warmup: qualification,
      },
    };
  }

  public snapshot(): PaperSessionSetupSnapshot {
    const history =
      this.historyState.current();

    return Object.freeze({
      status: this.resolveStatus(
        this.configurationSnapshot,
        history,
        this.qualificationSnapshot,
      ),
      configuration:
        this.configurationSnapshot,
      history,
      qualification:
        this.qualificationSnapshot,
    });
  }

  private ensureConfigured():
    PaperSessionOperatorConfigurationSnapshot {
    if (
      this.configurationSnapshot === null ||
      this.configurationSnapshot.status !==
        'CONFIGURED'
    ) {
      throw new Error(
        'paper_session_setup_not_configured',
      );
    }

    return this.configurationSnapshot;
  }

  private resolveStatus(
    configuration:
      PaperSessionOperatorConfigurationSnapshot | null,
    history: PaperSessionHistorySyncSnapshot,
    qualification:
      PaperSessionWarmupQualificationReport | null,
  ): PaperSessionSetupStatus {
    if (
      configuration === null ||
      configuration.status !== 'CONFIGURED'
    ) {
      return 'PENDING_CONFIGURATION';
    }

    if (qualification !== null) {
      if (qualification.qualified) {
        return 'QUALIFIED';
      }

      if (qualification.observationAllowed) {
        return 'OBSERVE';
      }

      return 'BLOCKED';
    }

    if (history.status !== 'UNSYNCED') {
      return 'SYNCHRONIZED';
    }

    return 'CONFIGURED';
  }
}
