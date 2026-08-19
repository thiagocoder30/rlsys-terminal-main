import type {
  TriplicacaoActionSemanticsResult,
  TriplicacaoActionColor,
} from './TriplicacaoActionSemantics.js';

import type {
  TriplicacaoProspectiveResult,
  TriplicacaoSettlement,
} from './TriplicacaoProspectiveFormationCoordinator.js';

import type {
  TriplicacaoEnginePatternKind,
} from '../../domain/analytics/TriplicacaoPatternEngine.js';


export type TriplicacaoProspectiveSignalStatus =
  | 'PENDING'
  | 'SETTLED';


export type TriplicacaoProspectiveOperatorDecision =
  | 'UNDECIDED'
  | 'FOLLOWED'
  | 'IGNORED';


export type TriplicacaoProspectiveSignalResult =
  | 'WIN'
  | 'LOSS'
  | 'VOID'
  | null;


export interface TriplicacaoProspectiveSignalRecord {
  readonly signalId:
    string;

  readonly sessionId:
    string;

  readonly createdAtEpochMs:
    number;

  readonly settledAtEpochMs:
    number | null;

  readonly operatorDecisionAtEpochMs:
    number | null;

  readonly status:
    TriplicacaoProspectiveSignalStatus;

  readonly operatorDecision:
    TriplicacaoProspectiveOperatorDecision;

  readonly pattern:
    TriplicacaoEnginePatternKind;

  readonly firstNumber:
    number;

  readonly secondNumber:
    number;

  readonly thirdNumber:
    number | null;

  readonly firstColor:
    TriplicacaoActionColor;

  readonly secondColor:
    TriplicacaoActionColor;

  readonly thirdColor:
    TriplicacaoActionColor | 'ZERO' | null;

  readonly targetColor:
    TriplicacaoActionColor;

  /**
   * Final stake shown to the operator.
   */
  readonly suggestedStake:
    number;

  /**
   * Safe stake before any controlled recovery component.
   */
  readonly baseStakeAmount:
    number;

  /**
   * Portion added by Controlled Recovery.
   *
   * Always zero with Martingale OFF, without debt,
   * during CAUTION, or when recovery is otherwise unavailable.
   */
  readonly recoveryComponent:
    number;

  readonly confidenceScore:
    number;

  readonly evidenceScore:
    number;

  readonly riskScore:
    number;

  readonly result:
    TriplicacaoProspectiveSignalResult;

  readonly rationale:
    string;

  readonly reasons:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly paperOnly: true;

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticBetExecutionAllowed: false;
}


export interface TriplicacaoProspectiveSignalRepository {
  save(
    record:
      TriplicacaoProspectiveSignalRecord,
  ): void;

  findById(
    signalId:
      string,
  ): TriplicacaoProspectiveSignalRecord | null;

  listBySession(
    sessionId:
      string,
  ): readonly TriplicacaoProspectiveSignalRecord[];
}


export interface TriplicacaoProspectiveRecorderClock {
  now():
    number;
}


export interface TriplicacaoProspectiveRecorderIdFactory {
  next(
    input: {
      readonly sessionId:
        string;

      readonly createdAtEpochMs:
        number;
    },
  ): string;
}


export interface TriplicacaoProspectiveOpenInput {
  readonly sessionId:
    string;

  readonly action:
    TriplicacaoActionSemanticsResult;

  readonly suggestedStake:
    number;

  readonly baseStakeAmount?:
    number;

  readonly recoveryComponent?:
    number;
}


export interface TriplicacaoProspectiveOperatorDecisionInput {
  readonly signalId:
    string;

  readonly decision:
    Exclude<
      TriplicacaoProspectiveOperatorDecision,
      'UNDECIDED'
    >;
}


export interface TriplicacaoProspectiveSettleInput {
  readonly signalId:
    string;

  readonly formation:
    TriplicacaoProspectiveResult;
}


/**
 * Prospective recommendation recorder.
 *
 * The recommendation is frozen before the third spin exists.
 *
 * It also freezes the financial recommendation composition:
 *
 *   baseStakeAmount
 *   + recoveryComponent
 *   = suggestedStake
 *
 * This is necessary so a pending recovery recommendation can be
 * restored safely after process interruption without reconstructing
 * financial history retrospectively.
 *
 * No automatic execution exists here.
 */
export class TriplicacaoProspectiveRecorder {
  public constructor(
    private readonly repository:
      TriplicacaoProspectiveSignalRepository,

    private readonly clock:
      TriplicacaoProspectiveRecorderClock = {
        now() {
          return Date.now();
        },
      },

    private readonly idFactory:
      TriplicacaoProspectiveRecorderIdFactory = {
        next(input) {
          return [
            'trip',
            input.sessionId,
            input.createdAtEpochMs,
          ].join('-');
        },
      },
  ) {}


  public recordAction(
    input:
      TriplicacaoProspectiveOpenInput,
  ): TriplicacaoProspectiveSignalRecord {
    const sessionId =
      input.sessionId.trim();

    if (
      sessionId.length ===
      0
    ) {
      throw new Error(
        'triplicacao_recorder_session_required',
      );
    }

    const action =
      input.action;

    if (
      action.status !==
        'ACTION' ||
      action.selectedPatternKind ===
        null ||
      action.targetColor ===
        null
    ) {
      throw new Error(
        'triplicacao_recorder_action_required',
      );
    }

    if (
      action.firstColor ===
        'ZERO' ||
      action.secondColor ===
        'ZERO'
    ) {
      throw new Error(
        'triplicacao_recorder_zero_action_invalid',
      );
    }

    this.validateStake(
      input.suggestedStake,
    );

    const baseStakeAmount =
      input.baseStakeAmount ??
      input.suggestedStake;

    const recoveryComponent =
      input.recoveryComponent ??
      0;

    this.validateStakeComposition({
      suggestedStake:
        input.suggestedStake,

      baseStakeAmount,

      recoveryComponent,
    });

    const createdAtEpochMs =
      this.clock.now();

    this.validateEpoch(
      createdAtEpochMs,
    );

    const signalId =
      this.idFactory.next({
        sessionId,
        createdAtEpochMs,
      });

    if (
      signalId.trim().length ===
      0
    ) {
      throw new Error(
        'triplicacao_recorder_invalid_signal_id',
      );
    }

    if (
      this.repository.findById(
        signalId,
      ) !== null
    ) {
      throw new Error(
        'triplicacao_recorder_duplicate_signal_id',
      );
    }

    const record:
      TriplicacaoProspectiveSignalRecord =
        Object.freeze({
          signalId,

          sessionId,

          createdAtEpochMs,

          settledAtEpochMs:
            null,

          operatorDecisionAtEpochMs:
            null,

          status:
            'PENDING' as const,

          operatorDecision:
            'UNDECIDED' as const,

          pattern:
            action.selectedPatternKind,

          firstNumber:
            action.firstNumber,

          secondNumber:
            action.secondNumber,

          thirdNumber:
            null,

          firstColor:
            action.firstColor,

          secondColor:
            action.secondColor,

          thirdColor:
            null,

          targetColor:
            action.targetColor,

          suggestedStake:
            this.money(
              input.suggestedStake,
            ),

          baseStakeAmount:
            this.money(
              baseStakeAmount,
            ),

          recoveryComponent:
            this.money(
              recoveryComponent,
            ),

          confidenceScore:
            action.confidenceScore,

          evidenceScore:
            action.evidenceScore,

          riskScore:
            action.riskScore,

          result:
            null,

          rationale:
            action.rationale,

          reasons:
            Object.freeze([
              ...action.reasons,
              'TRIPLICACAO_SIGNAL_RECORDED_BEFORE_THIRD_SPIN',
              'TRIPLICACAO_RECOMMENDATION_ONLY',
            ]),

          warnings:
            Object.freeze([
              ...action.warnings,
            ]),

          paperOnly:
            true as const,

          recommendationOnly:
            true as const,

          humanExecutionRequired:
            true as const,

          liveMoneyAuthorization:
            false as const,

          automaticBetExecutionAllowed:
            false as const,
        });

    this.repository.save(
      record,
    );

    return record;
  }


  public recordOperatorDecision(
    input:
      TriplicacaoProspectiveOperatorDecisionInput,
  ): TriplicacaoProspectiveSignalRecord {
    const existing =
      this.repository.findById(
        input.signalId,
      );

    if (
      existing ===
      null
    ) {
      throw new Error(
        'triplicacao_recorder_signal_not_found',
      );
    }

    if (
      existing.status !==
      'PENDING'
    ) {
      throw new Error(
        'triplicacao_recorder_operator_decision_after_settlement',
      );
    }

    if (
      existing.operatorDecision !==
      'UNDECIDED'
    ) {
      throw new Error(
        'triplicacao_recorder_operator_decision_already_recorded',
      );
    }

    if (
      input.decision !==
        'FOLLOWED' &&
      input.decision !==
        'IGNORED'
    ) {
      throw new Error(
        'triplicacao_recorder_invalid_operator_decision',
      );
    }

    const operatorDecisionAtEpochMs =
      this.clock.now();

    this.validateEpoch(
      operatorDecisionAtEpochMs,
    );

    if (
      operatorDecisionAtEpochMs <
      existing.createdAtEpochMs
    ) {
      throw new Error(
        'triplicacao_recorder_operator_decision_before_signal',
      );
    }

    const updated:
      TriplicacaoProspectiveSignalRecord =
        Object.freeze({
          ...existing,

          operatorDecision:
            input.decision,

          operatorDecisionAtEpochMs,

          reasons:
            Object.freeze([
              ...existing.reasons,
              `TRIPLICACAO_OPERATOR_DECISION:${input.decision}`,
            ]),
        });

    this.repository.save(
      updated,
    );

    return updated;
  }


  public settle(
    input:
      TriplicacaoProspectiveSettleInput,
  ): TriplicacaoProspectiveSignalRecord {
    const existing =
      this.repository.findById(
        input.signalId,
      );

    if (
      existing ===
      null
    ) {
      throw new Error(
        'triplicacao_recorder_signal_not_found',
      );
    }

    if (
      existing.status !==
      'PENDING'
    ) {
      throw new Error(
        'triplicacao_recorder_signal_already_settled',
      );
    }

    const formation =
      input.formation;

    if (
      formation.settlement ===
        null
    ) {
      throw new Error(
        'triplicacao_recorder_settlement_required',
      );
    }

    const settledAtEpochMs =
      this.clock.now();

    this.validateEpoch(
      settledAtEpochMs,
    );

    if (
      settledAtEpochMs <
      existing.createdAtEpochMs
    ) {
      throw new Error(
        'triplicacao_recorder_settlement_before_signal',
      );
    }

    const thirdColor =
      formation.settledSpinColor;

    if (
      thirdColor ===
      null
    ) {
      throw new Error(
        'triplicacao_recorder_third_color_required',
      );
    }

    this.validateSettlementConsistency({
      existing,

      settlement:
        formation.settlement,

      thirdColor,
    });

    const settled:
      TriplicacaoProspectiveSignalRecord =
        Object.freeze({
          ...existing,

          settledAtEpochMs,

          status:
            'SETTLED' as const,

          thirdNumber:
            formation.spin,

          thirdColor,

          result:
            formation.settlement,

          reasons:
            Object.freeze([
              ...existing.reasons,
              `TRIPLICACAO_SIGNAL_SETTLED:${formation.settlement}`,
            ]),
        });

    this.repository.save(
      settled,
    );

    return settled;
  }


  public listSession(
    sessionId:
      string,
  ): readonly TriplicacaoProspectiveSignalRecord[] {
    const normalized =
      sessionId.trim();

    if (
      normalized.length ===
      0
    ) {
      throw new Error(
        'triplicacao_recorder_session_required',
      );
    }

    return this.repository.listBySession(
      normalized,
    );
  }


  private validateSettlementConsistency(
    input: {
      readonly existing:
        TriplicacaoProspectiveSignalRecord;

      readonly settlement:
        Exclude<
          TriplicacaoSettlement,
          null
        >;

      readonly thirdColor:
        TriplicacaoActionColor | 'ZERO';
    },
  ): void {
    if (
      input.settlement ===
      'VOID'
    ) {
      if (
        input.thirdColor !==
        'ZERO'
      ) {
        throw new Error(
          'triplicacao_recorder_void_requires_zero',
        );
      }

      return;
    }

    if (
      input.thirdColor ===
      'ZERO'
    ) {
      throw new Error(
        'triplicacao_recorder_zero_requires_void',
      );
    }

    const expected =
      input.existing.targetColor ===
      input.thirdColor
        ? 'WIN'
        : 'LOSS';

    if (
      expected !==
      input.settlement
    ) {
      throw new Error(
        'triplicacao_recorder_inconsistent_settlement',
      );
    }
  }


  private validateStakeComposition(
    input: {
      readonly suggestedStake:
        number;

      readonly baseStakeAmount:
        number;

      readonly recoveryComponent:
        number;
    },
  ): void {
    if (
      !Number.isFinite(
        input.baseStakeAmount,
      ) ||
      input.baseStakeAmount <= 0
    ) {
      throw new Error(
        'triplicacao_recorder_invalid_base_stake',
      );
    }

    if (
      !Number.isFinite(
        input.recoveryComponent,
      ) ||
      input.recoveryComponent < 0
    ) {
      throw new Error(
        'triplicacao_recorder_invalid_recovery_component',
      );
    }

    const composed =
      this.money(
        input.baseStakeAmount +
        input.recoveryComponent,
      );

    if (
      composed !==
      this.money(
        input.suggestedStake,
      )
    ) {
      throw new Error(
        'triplicacao_recorder_inconsistent_stake_composition',
      );
    }
  }


  private validateStake(
    value:
      number,
  ): void {
    if (
      !Number.isFinite(
        value,
      ) ||
      value <= 0
    ) {
      throw new Error(
        'triplicacao_recorder_invalid_suggested_stake',
      );
    }
  }


  private validateEpoch(
    value:
      number,
  ): void {
    if (
      !Number.isFinite(
        value,
      ) ||
      value < 0
    ) {
      throw new Error(
        'triplicacao_recorder_invalid_epoch',
      );
    }
  }


  private money(
    value:
      number,
  ): number {
    return Math.round(
      value *
      100,
    ) / 100;
  }
}
