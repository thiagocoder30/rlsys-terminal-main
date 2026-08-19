import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';

import {
  dirname,
} from 'node:path';

import type {
  TriplicacaoProspectiveSignalRecord,
  TriplicacaoProspectiveSignalRepository,
} from '../../application/runtime/TriplicacaoProspectiveRecorder.js';


interface TriplicacaoProspectiveStore {
  readonly version:
    1;

  readonly signals:
    readonly TriplicacaoProspectiveSignalRecord[];
}


/**
 * JSON persistence adapter for Triplicação prospective evidence.
 *
 * Older records are normalized conservatively:
 *
 * baseStakeAmount = suggestedStake
 * recoveryComponent = 0
 *
 * Therefore historical records can never be retroactively interpreted
 * as recovery exposure.
 */
export class JsonTriplicacaoProspectiveSignalRepository
implements TriplicacaoProspectiveSignalRepository {
  public constructor(
    private readonly filePath:
      string =
        'data/paper/triplicacao-prospective-signals.json',
  ) {
    if (
      filePath.trim().length ===
      0
    ) {
      throw new Error(
        'triplicacao_repository_path_required',
      );
    }
  }


  public save(
    record:
      TriplicacaoProspectiveSignalRecord,
  ): void {
    const store =
      this.readStore();

    const index =
      store.signals.findIndex(
        (candidate) =>
          candidate.signalId ===
          record.signalId,
      );

    const signals =
      [...store.signals];

    if (
      index >= 0
    ) {
      const previous =
        signals[index];

      if (
        previous.status ===
          'SETTLED'
      ) {
        throw new Error(
          'triplicacao_repository_settled_signal_immutable',
        );
      }

      signals[index] =
        record;
    } else {
      signals.push(
        record,
      );
    }

    this.writeStore({
      version:
        1,

      signals:
        Object.freeze(
          signals,
        ),
    });
  }


  public findById(
    signalId:
      string,
  ): TriplicacaoProspectiveSignalRecord | null {
    const normalized =
      signalId.trim();

    if (
      normalized.length ===
      0
    ) {
      return null;
    }

    return (
      this.readStore()
        .signals
        .find(
          (candidate) =>
            candidate.signalId ===
            normalized,
        ) ??
      null
    );
  }


  public listBySession(
    sessionId:
      string,
  ): readonly TriplicacaoProspectiveSignalRecord[] {
    const normalized =
      sessionId.trim();

    return Object.freeze(
      this.readStore()
        .signals
        .filter(
          (record) =>
            record.sessionId ===
            normalized,
        )
        .sort(
          (left, right) =>
            left.createdAtEpochMs -
            right.createdAtEpochMs,
        ),
    );
  }


  private readStore():
    TriplicacaoProspectiveStore {
    if (
      !existsSync(
        this.filePath,
      )
    ) {
      return {
        version:
          1,

        signals:
          Object.freeze([]),
      };
    }

    const raw =
      readFileSync(
        this.filePath,
        'utf8',
      ).trim();

    if (
      raw.length ===
      0
    ) {
      return {
        version:
          1,

        signals:
          Object.freeze([]),
      };
    }

    const parsed =
      JSON.parse(
        raw,
      );

    if (
      parsed ===
        null ||
      typeof parsed !==
        'object' ||
      parsed.version !==
        1 ||
      !Array.isArray(
        parsed.signals,
      )
    ) {
      throw new Error(
        'triplicacao_repository_invalid_store',
      );
    }

    return {
      version:
        1,

      signals:
        Object.freeze(
          parsed.signals.map(
            (
              signal:
                Record<string, unknown>,
            ) =>
              this.normalizeSignal(
                signal,
              ),
          ),
        ),
    };
  }


  private normalizeSignal(
    signal:
      Record<string, unknown>,
  ): TriplicacaoProspectiveSignalRecord {
    const suggestedStake =
      typeof signal.suggestedStake ===
        'number'
        ? signal.suggestedStake
        : 0;

    return {
      ...(signal as unknown as
        TriplicacaoProspectiveSignalRecord),

      suggestedStake,

      baseStakeAmount:
        typeof signal.baseStakeAmount ===
          'number'
          ? signal.baseStakeAmount
          : suggestedStake,

      recoveryComponent:
        typeof signal.recoveryComponent ===
          'number'
          ? signal.recoveryComponent
          : 0,

      operatorDecision:
        signal.operatorDecision ===
          'FOLLOWED' ||
        signal.operatorDecision ===
          'IGNORED'
          ? signal.operatorDecision
          : 'UNDECIDED',

      operatorDecisionAtEpochMs:
        typeof signal.operatorDecisionAtEpochMs ===
          'number'
          ? signal.operatorDecisionAtEpochMs
          : null,

      recommendationOnly:
        true,

      humanExecutionRequired:
        true,

      liveMoneyAuthorization:
        false,

      automaticBetExecutionAllowed:
        false,
    };
  }


  private writeStore(
    store:
      TriplicacaoProspectiveStore,
  ): void {
    mkdirSync(
      dirname(
        this.filePath,
      ),
      {
        recursive:
          true,
      },
    );

    const temporaryPath =
      `${this.filePath}.tmp`;

    writeFileSync(
      temporaryPath,
      `${JSON.stringify(
        store,
        null,
        2,
      )}\n`,
      'utf8',
    );

    renameSync(
      temporaryPath,
      this.filePath,
    );
  }
}
