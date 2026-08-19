import {
  TriplicacaoProspectiveFormationCoordinator,
  type TriplicacaoFormationState,
  type TriplicacaoProspectiveResult,
} from './TriplicacaoProspectiveFormationCoordinator.js';

import {
  TriplicacaoProspectiveRecorder,
  type TriplicacaoProspectiveOperatorDecision,
  type TriplicacaoProspectiveSignalRecord,
} from './TriplicacaoProspectiveRecorder.js';

import {
  TriplicacaoProspectivePerformanceAnalyzer,
  type TriplicacaoProspectivePerformanceReport,
} from './TriplicacaoProspectivePerformanceAnalyzer.js';

import {
  PaperOperatorDecisionSemantics,
} from './PaperOperatorDecisionSemantics.js';

import {
  PostSyncCatchUpBoundary,
  type PostSyncCatchUpSnapshot,
} from './PostSyncCatchUpBoundary.js';

import {
  PaperInstitutionalRecoveryController,
  type PaperInstitutionalStakeRecommendation,
  type PaperInstitutionalSettlementReport,
} from './PaperInstitutionalRecoveryController.js';

import type {
  PaperCapitalRiskMode,
} from './PaperCapitalPreservationGuard.js';

import type {
  TriplicacaoAdvancedProbabilityAnalysis,
} from '../../domain/analytics/TriplicacaoAdvancedProbabilityEngine.js';


export type TriplicacaoProspectiveSessionEvent =
  | 'FORMATION_STARTED'
  | 'RECOMMENDATION_ISSUED'
  | 'NO_RECOMMENDATION'
  | 'RECOMMENDATION_SETTLED'
  | 'TRIO_VOID'
  | 'STAKE_BLOCKED'
  | 'CAPITAL_STOP';


export interface TriplicacaoProspectiveInstitutionalConfiguration {
  readonly initialBankroll:
    number;

  readonly riskMode:
    PaperCapitalRiskMode;

  readonly minimumStake:
    number;

  readonly martingaleEnabled?:
    boolean;

  readonly operatorDecisionSemantics?:
    PaperOperatorDecisionSemantics;

  readonly postSyncBoundary?:
    PostSyncCatchUpBoundary;

  readonly financialController?:
    PaperInstitutionalRecoveryController;
}


export interface TriplicacaoProspectiveSessionInput {
  readonly sessionId:
    string;

  readonly spin:
    number;

  readonly analysis:
    TriplicacaoAdvancedProbabilityAnalysis;

  /**
   * Legacy non-institutional testing path only.
   *
   * Institutional mode always ignores this and uses the shared
   * financial controller.
   */
  readonly suggestedStake?:
    number;
}


export interface TriplicacaoProspectiveSessionOperatorDecisionInput {
  readonly sessionId:
    string;

  readonly decision:
    Exclude<
      TriplicacaoProspectiveOperatorDecision,
      'UNDECIDED'
    >;
}


export interface TriplicacaoProspectiveSessionSnapshot {
  readonly sessionId:
    string;

  readonly formationState:
    TriplicacaoFormationState;

  readonly pendingSignalId:
    string | null;

  readonly pendingOperatorDecision:
    TriplicacaoProspectiveOperatorDecision | null;

  readonly totalRecordedSignals:
    number;

  readonly institutionalMode:
    boolean;

  readonly currentBankroll:
    number | null;

  readonly peakBankroll:
    number | null;

  readonly pendingLossDebt:
    number | null;

  readonly capitalDecision:
    string | null;

  readonly martingaleEnabled:
    boolean | null;

  readonly postSync:
    PostSyncCatchUpSnapshot | null;

  readonly paperOnly: true;

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticBetExecutionAllowed: false;
}


export interface TriplicacaoProspectiveSessionResult {
  readonly event:
    TriplicacaoProspectiveSessionEvent;

  readonly sessionId:
    string;

  readonly spin:
    number;

  readonly formation:
    TriplicacaoProspectiveResult;

  readonly recommendation:
    TriplicacaoProspectiveSignalRecord | null;

  readonly settledSignal:
    TriplicacaoProspectiveSignalRecord | null;

  readonly financialRecommendation:
    PaperInstitutionalStakeRecommendation | null;

  readonly financialSettlement:
    PaperInstitutionalSettlementReport | null;

  readonly performance:
    TriplicacaoProspectivePerformanceReport;

  readonly pendingSignalId:
    string | null;

  readonly formationState:
    TriplicacaoFormationState;

  readonly currentBankroll:
    number | null;

  readonly peakBankroll:
    number | null;

  readonly pendingLossDebt:
    number | null;

  readonly operatorMessage:
    string;

  readonly paperOnly: true;

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly liveMoneyAuthorization: false;

  readonly automaticBetExecutionAllowed: false;

  readonly operatorDecisionRequired: true;
}


export class TriplicacaoProspectiveSessionRuntime {
  private readonly sessionId:
    string;

  private pendingSignalId:
    string | null =
      null;

  private readonly institutional:
    TriplicacaoProspectiveInstitutionalConfiguration | null;

  private readonly operatorDecisionSemantics:
    PaperOperatorDecisionSemantics;

  private readonly postSyncBoundary:
    PostSyncCatchUpBoundary | null;

  private readonly financialController:
    PaperInstitutionalRecoveryController | null;


  public constructor(
    sessionId:
      string,

    private readonly formation:
      TriplicacaoProspectiveFormationCoordinator,

    private readonly recorder:
      TriplicacaoProspectiveRecorder,

    private readonly performanceAnalyzer:
      TriplicacaoProspectivePerformanceAnalyzer =
        new TriplicacaoProspectivePerformanceAnalyzer(),

    institutionalConfiguration:
      TriplicacaoProspectiveInstitutionalConfiguration | null =
        null,
  ) {
    const normalized =
      sessionId.trim();

    if (
      normalized.length ===
      0
    ) {
      throw new Error(
        'triplicacao_session_runtime_session_required',
      );
    }

    this.sessionId =
      normalized;

    this.institutional =
      institutionalConfiguration;

    this.operatorDecisionSemantics =
      institutionalConfiguration
        ?.operatorDecisionSemantics ??
      new PaperOperatorDecisionSemantics();

    this.postSyncBoundary =
      institutionalConfiguration
        ?.postSyncBoundary ??
      (
        institutionalConfiguration
          ? new PostSyncCatchUpBoundary()
          : null
      );

    if (
      institutionalConfiguration
    ) {
      this.validateInstitutionalConfiguration(
        institutionalConfiguration,
      );

      this.financialController =
        institutionalConfiguration
          .financialController ??
        new PaperInstitutionalRecoveryController({
          initialBankroll:
            institutionalConfiguration
              .initialBankroll,

          riskMode:
            institutionalConfiguration
              .riskMode,

          minimumStake:
            institutionalConfiguration
              .minimumStake,

          martingaleEnabled:
            institutionalConfiguration
              .martingaleEnabled ??
            false,
        });
    } else {
      this.financialController =
        null;
    }

    this.restorePendingSignal();
  }


  public confirmHistoryCurrent(
    raw:
      string,
  ): PostSyncCatchUpSnapshot {
    return this.requireBoundary()
      .confirmHistoryCurrent(
        raw,
      );
  }


  public recordCatchUpSpin(
    spin:
      number,
  ): PostSyncCatchUpSnapshot {
    return this.requireBoundary()
      .recordCatchUpSpin(
        spin,
      );
  }


  public finishCatchUp():
    PostSyncCatchUpSnapshot {
    return this.requireBoundary()
      .finishCatchUp();
  }


  public recordOperatorDecisionRaw(
    input: {
      readonly sessionId:
        string;

      readonly raw:
        string;
    },
  ): TriplicacaoProspectiveSignalRecord {
    this.validateSession(
      input.sessionId,
    );

    const parsed =
      this.operatorDecisionSemantics.parse(
        input.raw,
      );

    return this.recordOperatorDecision({
      sessionId:
        input.sessionId,

      decision:
        parsed.decision,
    });
  }


  public ingest(
    input:
      TriplicacaoProspectiveSessionInput,
  ): TriplicacaoProspectiveSessionResult {
    this.validateSession(
      input.sessionId,
    );

    if (
      this.institutional
    ) {
      this.requireBoundary()
        .assertProspectiveAllowed();
    }

    const formation =
      this.formation.ingest({
        spin:
          input.spin,

        analysis:
          input.analysis,
      });

    if (
      formation.stateBefore ===
        'WAITING_THIRD'
    ) {
      return this.handleThirdPosition(
        formation,
      );
    }

    if (
      formation.stateBefore ===
        'WAITING_FIRST'
    ) {
      return this.buildResult({
        event:
          formation.trioDiscarded
            ? 'TRIO_VOID'
            : 'FORMATION_STARTED',

        formation,

        recommendation:
          null,

        settledSignal:
          null,

        financialRecommendation:
          null,

        financialSettlement:
          null,

        operatorMessage:
          formation.trioDiscarded
            ? 'Zero recebido na primeira posição. Trio descartado.'
            : 'Primeira posição registrada. Aguardando o segundo giro.',
      });
    }

    if (
      formation.trioDiscarded
    ) {
      return this.buildResult({
        event:
          'TRIO_VOID',

        formation,

        recommendation:
          null,

        settledSignal:
          null,

        financialRecommendation:
          null,

        financialSettlement:
          null,

        operatorMessage:
          'Zero recebido na segunda posição. Trio descartado; nenhuma recomendação foi emitida.',
      });
    }

    if (
      formation.action ===
        null ||
      formation.action.status !==
        'ACTION'
    ) {
      return this.buildResult({
        event:
          'NO_RECOMMENDATION',

        formation,

        recommendation:
          null,

        settledSignal:
          null,

        financialRecommendation:
          null,

        financialSettlement:
          null,

        operatorMessage:
          'A formação atual não satisfaz os critérios para recomendação de Triplicação.',
      });
    }

    if (
      this.pendingSignalId !==
      null
    ) {
      throw new Error(
        'triplicacao_session_runtime_pending_signal_already_exists',
      );
    }

    const financialRecommendation =
      this.financialController
        ?.recommend(
          input.analysis
            .advancedRiskScore,
        ) ??
      null;

    if (
      financialRecommendation
        ?.decision ===
      'CAPITAL_STOP'
    ) {
      return this.buildResult({
        event:
          'CAPITAL_STOP',

        formation,

        recommendation:
          null,

        settledSignal:
          null,

        financialRecommendation,

        financialSettlement:
          null,

        operatorMessage:
          this.capitalStopMessage(
            financialRecommendation,
          ),
      });
    }

    if (
      financialRecommendation
        ?.decision ===
      'STAKE_BLOCKED'
    ) {
      return this.buildResult({
        event:
          'STAKE_BLOCKED',

        formation,

        recommendation:
          null,

        settledSignal:
          null,

        financialRecommendation,

        financialSettlement:
          null,

        operatorMessage:
          'Oportunidade estatística detectada, porém a exposição financeira segura não permite entrada.',
      });
    }

    const suggestedStake =
      financialRecommendation
        ?.suggestedStake ??
      input.suggestedStake;

    if (
      suggestedStake ===
        undefined ||
      suggestedStake ===
        null
    ) {
      throw new Error(
        'triplicacao_session_runtime_stake_required',
      );
    }

    const baseStakeAmount =
      financialRecommendation
        ?.baseStakeAmount ??
      suggestedStake;

    const recoveryComponent =
      financialRecommendation
        ?.recoveryComponent ??
      0;

    const recommendation =
      this.recorder.recordAction({
        sessionId:
          this.sessionId,

        action:
          formation.action,

        suggestedStake,

        baseStakeAmount,

        recoveryComponent,
      });

    this.pendingSignalId =
      recommendation.signalId;

    return this.buildResult({
      event:
        'RECOMMENDATION_ISSUED',

      formation,

      recommendation,

      settledSignal:
        null,

      financialRecommendation,

      financialSettlement:
        null,

      operatorMessage:
        this.recommendationMessage(
          recommendation,
          financialRecommendation,
        ),
    });
  }


  public recordOperatorDecision(
    input:
      TriplicacaoProspectiveSessionOperatorDecisionInput,
  ): TriplicacaoProspectiveSignalRecord {
    this.validateSession(
      input.sessionId,
    );

    if (
      this.institutional &&
      !this.requireBoundary()
        .snapshot()
        .operatorDecisionPromptAllowed
    ) {
      throw new Error(
        'triplicacao_session_runtime_operator_decision_not_allowed',
      );
    }

    if (
      this.pendingSignalId ===
      null
    ) {
      throw new Error(
        'triplicacao_session_runtime_no_pending_recommendation',
      );
    }

    return this.recorder.recordOperatorDecision({
      signalId:
        this.pendingSignalId,

      decision:
        input.decision,
    });
  }


  public performance():
    TriplicacaoProspectivePerformanceReport {
    return this.performanceAnalyzer.analyze(
      this.recorder.listSession(
        this.sessionId,
      ),
    );
  }


  public snapshot():
    TriplicacaoProspectiveSessionSnapshot {
    const pending =
      this.pendingRecord();

    const financial =
      this.financialController
        ?.snapshot() ??
      null;

    return Object.freeze({
      sessionId:
        this.sessionId,

      formationState:
        this.formation.snapshot()
          .state,

      pendingSignalId:
        this.pendingSignalId,

      pendingOperatorDecision:
        pending?.operatorDecision ??
        null,

      totalRecordedSignals:
        this.recorder
          .listSession(
            this.sessionId,
          )
          .length,

      institutionalMode:
        this.institutional !==
        null,

      currentBankroll:
        financial?.currentBankroll ??
        null,

      peakBankroll:
        financial?.peakBankroll ??
        null,

      pendingLossDebt:
        financial
          ?.recoveryLedger
          .pendingLossDebt ??
        null,

      capitalDecision:
        financial
          ?.capital
          .decision ??
        null,

      martingaleEnabled:
        financial?.martingaleEnabled ??
        null,

      postSync:
        this.postSyncBoundary
          ?.snapshot() ??
        null,

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
  }


  private handleThirdPosition(
    formation:
      TriplicacaoProspectiveResult,
  ): TriplicacaoProspectiveSessionResult {
    if (
      this.pendingSignalId ===
      null
    ) {
      return this.buildResult({
        event:
          formation.trioDiscarded
            ? 'TRIO_VOID'
            : 'NO_RECOMMENDATION',

        formation,

        recommendation:
          null,

        settledSignal:
          null,

        financialRecommendation:
          null,

        financialSettlement:
          null,

        operatorMessage:
          formation.trioDiscarded
            ? 'Trio encerrado por zero sem recomendação prospectiva pendente.'
            : 'Trio concluído sem recomendação prospectiva registrada.',
      });
    }

    if (
      formation.settlement ===
      null
    ) {
      throw new Error(
        'triplicacao_session_runtime_pending_signal_without_settlement',
      );
    }

    const signalId =
      this.pendingSignalId;

    const settledSignal =
      this.recorder.settle({
        signalId,

        formation,
      });

    /*
     * Recorder.settle() guarantees these fields logically.
     *
     * We still validate them explicitly here so TypeScript and the
     * financial boundary both receive a fully narrowed settlement.
     * This avoids unsafe casts and prevents corrupt persistence from
     * reaching bankroll accounting.
     */
    const statisticalResult =
      settledSignal.result;

    if (
      statisticalResult ===
      null
    ) {
      throw new Error(
        'triplicacao_session_runtime_settled_result_missing',
      );
    }

    const thirdColor =
      settledSignal.thirdColor;

    if (
      thirdColor ===
      null
    ) {
      throw new Error(
        'triplicacao_session_runtime_settled_color_missing',
      );
    }

    this.pendingSignalId =
      null;

    const financialSettlement =
      this.financialController
        ? this.financialController.settle({
            operatorDecision:
              settledSignal
                .operatorDecision,

            statisticalResult,

            thirdColor,

            suggestedStake:
              settledSignal
                .suggestedStake,

            recoveryComponent:
              settledSignal
                .recoveryComponent,
          })
        : null;

    return this.buildResult({
      event:
        statisticalResult ===
        'VOID'
          ? 'TRIO_VOID'
          : 'RECOMMENDATION_SETTLED',

      formation,

      recommendation:
        null,

      settledSignal,

      financialRecommendation:
        null,

      financialSettlement,

      operatorMessage:
        this.settlementMessage(
          settledSignal,
          financialSettlement,
        ),
    });
  }


  private buildResult(
    input: {
      readonly event:
        TriplicacaoProspectiveSessionEvent;

      readonly formation:
        TriplicacaoProspectiveResult;

      readonly recommendation:
        TriplicacaoProspectiveSignalRecord | null;

      readonly settledSignal:
        TriplicacaoProspectiveSignalRecord | null;

      readonly financialRecommendation:
        PaperInstitutionalStakeRecommendation | null;

      readonly financialSettlement:
        PaperInstitutionalSettlementReport | null;

      readonly operatorMessage:
        string;
    },
  ): TriplicacaoProspectiveSessionResult {
    const financial =
      this.financialController
        ?.snapshot() ??
      null;

    return Object.freeze({
      event:
        input.event,

      sessionId:
        this.sessionId,

      spin:
        input.formation.spin,

      formation:
        input.formation,

      recommendation:
        input.recommendation,

      settledSignal:
        input.settledSignal,

      financialRecommendation:
        input.financialRecommendation,

      financialSettlement:
        input.financialSettlement,

      performance:
        this.performance(),

      pendingSignalId:
        this.pendingSignalId,

      formationState:
        this.formation.snapshot()
          .state,

      currentBankroll:
        financial?.currentBankroll ??
        null,

      peakBankroll:
        financial?.peakBankroll ??
        null,

      pendingLossDebt:
        financial
          ?.recoveryLedger
          .pendingLossDebt ??
        null,

      operatorMessage:
        input.operatorMessage,

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

      operatorDecisionRequired:
        true as const,
    });
  }


  private recommendationMessage(
    signal:
      TriplicacaoProspectiveSignalRecord,

    financial:
      PaperInstitutionalStakeRecommendation | null,
  ): string {
    const recoveryLabel =
      signal.recoveryComponent >
      0
        ? `Recovery controlado: R$ ${this.formatMoney(signal.recoveryComponent)}.`
        : 'Recovery: não aplicado.';

    return [
      'Oportunidade prospectiva de Triplicação identificada.',
      `Padrão: ${signal.pattern}.`,
      `Entrada sugerida: ${signal.targetColor}.`,
      `Stake base: R$ ${this.formatMoney(signal.baseStakeAmount)}.`,
      `Stake sugerida: R$ ${this.formatMoney(signal.suggestedStake)}.`,
      recoveryLabel,
      `Confiança: ${Math.round(signal.confidenceScore * 100)}%.`,
      `Evidência: ${signal.evidenceScore}.`,
      `Risco: ${Math.round(signal.riskScore * 100)}%.`,
      ...(financial
        ? [
            `Capital: ${financial.capital.decision}.`,
            `Martingale: ${financial.martingaleEnabled ? 'ON' : 'OFF'}.`,
          ]
        : []),
      'Seguiu? [s/n]',
      'A entrada é exclusivamente manual.',
    ].join(' ');
  }


  private settlementMessage(
    signal:
      TriplicacaoProspectiveSignalRecord,

    financial:
      PaperInstitutionalSettlementReport | null,
  ): string {
    return [
      'Recomendação prospectiva encerrada.',
      `Target: ${signal.targetColor}.`,
      `Resultado: ${signal.thirdColor}.`,
      `Settlement estatístico: ${signal.result}.`,
      `Operador: ${signal.operatorDecision}.`,
      ...(financial
        ? [
            `Settlement financeiro: ${financial.financialSettlement}.`,
            `Banca: R$ ${this.formatMoney(financial.bankrollAfter)}.`,
            `Pico: R$ ${this.formatMoney(financial.peakBankroll)}.`,
            `Drawdown: ${(financial.drawdownFraction * 100).toFixed(2)}%.`,
            `Recovery debt: R$ ${this.formatMoney(financial.recoveryLedger.pendingLossDebt)}.`,
          ]
        : []),
    ].join(' ');
  }


  private capitalStopMessage(
    financial:
      PaperInstitutionalStakeRecommendation,
  ): string {
    return [
      'CAPITAL PRESERVATION STOP.',
      `Motivo: ${financial.capital.stopReason}.`,
      `Banca atual: R$ ${this.formatMoney(financial.currentBankroll)}.`,
      `Pico: R$ ${this.formatMoney(financial.peakBankroll)}.`,
      'Novas recomendações e recovery estão bloqueados.',
    ].join(' ');
  }


  private pendingRecord():
    TriplicacaoProspectiveSignalRecord | null {
    if (
      this.pendingSignalId ===
      null
    ) {
      return null;
    }

    return (
      this.recorder
        .listSession(
          this.sessionId,
        )
        .find(
          (record) =>
            record.signalId ===
            this.pendingSignalId,
        ) ??
      null
    );
  }


  private restorePendingSignal(): void {
    const pending =
      this.recorder
        .listSession(
          this.sessionId,
        )
        .filter(
          (record) =>
            record.status ===
            'PENDING',
        );

    if (
      pending.length >
      1
    ) {
      throw new Error(
        'triplicacao_session_runtime_multiple_pending_signals',
      );
    }

    this.pendingSignalId =
      pending[0]?.signalId ??
      null;
  }


  private requireBoundary():
    PostSyncCatchUpBoundary {
    if (
      this.postSyncBoundary ===
      null
    ) {
      throw new Error(
        'triplicacao_session_runtime_post_sync_boundary_unavailable',
      );
    }

    return this.postSyncBoundary;
  }


  private validateInstitutionalConfiguration(
    input:
      TriplicacaoProspectiveInstitutionalConfiguration,
  ): void {
    if (
      !Number.isFinite(
        input.initialBankroll,
      ) ||
      input.initialBankroll <= 0
    ) {
      throw new Error(
        'triplicacao_session_runtime_invalid_bankroll',
      );
    }

    if (
      !Number.isFinite(
        input.minimumStake,
      ) ||
      input.minimumStake <= 0
    ) {
      throw new Error(
        'triplicacao_session_runtime_invalid_minimum_stake',
      );
    }

    if (
      input.riskMode !==
        'conservative' &&
      input.riskMode !==
        'moderate' &&
      input.riskMode !==
        'aggressive'
    ) {
      throw new Error(
        'triplicacao_session_runtime_invalid_risk_mode',
      );
    }
  }


  private validateSession(
    sessionId:
      string,
  ): void {
    if (
      sessionId.trim() !==
      this.sessionId
    ) {
      throw new Error(
        'triplicacao_session_runtime_session_mismatch',
      );
    }
  }


  private formatMoney(
    value:
      number,
  ): string {
    return value
      .toFixed(2)
      .replace(
        '.',
        ',',
      );
  }
}
