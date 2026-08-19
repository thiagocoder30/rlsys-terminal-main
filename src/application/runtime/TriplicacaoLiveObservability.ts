import type {
  TriplicacaoProspectiveSessionResult,
  TriplicacaoProspectiveSessionSnapshot,
} from './TriplicacaoProspectiveSessionRuntime.js';


export type TriplicacaoLiveOperationalState =
  | 'FORMING'
  | 'INVALIDATED'
  | 'OBSERVING'
  | 'ACTION'
  | 'SETTLED'
  | 'VOID'
  | 'BLOCKED'
  | 'STOP';


export interface TriplicacaoLiveObservation {
  readonly state:
    TriplicacaoLiveOperationalState;

  readonly formationState:
    string;

  readonly summary:
    string;

  readonly reason:
    string;

  readonly recommendationPending:
    boolean;

  /**
   * Zero metadata is operational/read-only.
   *
   * zeroPosition identifies the fixed position in the trio that
   * invalidated the formation.
   *
   * positionsConsumed identifies how many positions of that same
   * fixed trio have already been consumed.
   */
  readonly zeroPosition:
    1 | 2 | 3 | null;

  readonly positionsConsumed:
    0 | 1 | 2 | 3;

  readonly paperOnly: true;

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly automaticBetExecutionAllowed: false;
}


/**
 * Read-only operational observability for the Triplicação live runtime.
 *
 * This component never changes strategy state, thresholds, bankroll,
 * recovery, probability or recommendation semantics.
 *
 * ZERO INTEGRITY
 * --------------
 *
 * A zero in positions 1 or 2 invalidates the fixed trio but does NOT
 * close it immediately.
 *
 * The remaining positions continue to be consumed and observability
 * explicitly exposes INVALIDATED until the third position closes the
 * trio as VOID.
 *
 * Examples:
 *
 *   0, 17, 24
 *   INVALIDATED
 *   INVALIDATED
 *   VOID
 *
 *   11, 0, 27
 *   FORMING
 *   INVALIDATED
 *   VOID
 *
 * This component remains presentation-only and has no execution power.
 */
export class TriplicacaoLiveObservability {
  public observe(
    result:
      TriplicacaoProspectiveSessionResult,
  ): TriplicacaoLiveObservation {
    const formationState =
      result.formationState;

    const zeroMetadata =
      this.zeroMetadata(
        result,
      );


    /*
     * The intermediate invalidated state has priority over ordinary
     * FORMING / OBSERVING presentation.
     *
     * trioDiscarded remains false until fixed position 3 is consumed,
     * so this state never changes the canonical lifecycle itself.
     */
    if (
      zeroMetadata.invalidated &&
      !result.formation.trioDiscarded
    ) {
      return this.build({
        state:
          'INVALIDATED',

        formationState,

        summary:
          `${formationState} | trio invalidado por zero`,

        reason:
          zeroMetadata.positionsConsumed ===
            1
            ? 'TRIPLICACAO_ZERO_INVALIDATED_AWAITING_REMAINING_POSITIONS'
            : 'TRIPLICACAO_ZERO_INVALIDATED_AWAITING_THIRD_POSITION',

        recommendationPending:
          false,

        zeroPosition:
          zeroMetadata.zeroPosition,

        positionsConsumed:
          zeroMetadata.positionsConsumed,
      });
    }


    if (
      result.event ===
      'RECOMMENDATION_ISSUED'
    ) {
      const recommendation =
        result.recommendation;

      return this.build({
        state:
          'ACTION',

        formationState,

        summary:
          recommendation
            ? `ACTION ${recommendation.pattern} -> ${recommendation.targetColor}`
            : 'ACTION',

        reason:
          'TRIPLICACAO_PROSPECTIVE_ACTION_CONFIRMED',

        recommendationPending:
          true,

        zeroPosition:
          null,

        positionsConsumed:
          this.positionsConsumed(
            result,
          ),
      });
    }


    if (
      result.event ===
      'RECOMMENDATION_SETTLED'
    ) {
      return this.build({
        state:
          'SETTLED',

        formationState,

        summary:
          result.settledSignal
            ? `SETTLED ${result.settledSignal.result}`
            : 'SETTLED',

        reason:
          'TRIPLICACAO_PROSPECTIVE_SIGNAL_SETTLED',

        recommendationPending:
          false,

        zeroPosition:
          null,

        positionsConsumed:
          3,
      });
    }


    if (
      result.event ===
      'TRIO_VOID'
    ) {
      if (
        result.settledSignal !==
        null
      ) {
        return this.build({
          state:
            'VOID',

          formationState,

          summary:
            'VOID | zero encerrou recomendação pendente',

          reason:
            'TRIPLICACAO_ZERO_VOID_SETTLEMENT',

          recommendationPending:
            false,

          zeroPosition:
            zeroMetadata.zeroPosition,

          positionsConsumed:
            3,
        });
      }

      return this.build({
        state:
          'VOID',

        formationState,

        summary:
          'VOID | formação descartada por zero',

        reason:
          'TRIPLICACAO_ZERO_DISCARDED_FORMATION',

        recommendationPending:
          false,

        zeroPosition:
          zeroMetadata.zeroPosition,

        positionsConsumed:
          3,
      });
    }


    if (
      result.event ===
      'STAKE_BLOCKED'
    ) {
      const blockers =
        result
          .financialRecommendation
          ?.blockers ??
        [];

      return this.build({
        state:
          'BLOCKED',

        formationState,

        summary:
          'BLOCKED | oportunidade sem exposição segura',

        reason:
          blockers.length >
            0
            ? blockers.join(',')
            : 'TRIPLICACAO_STAKE_BLOCKED',

        recommendationPending:
          false,

        zeroPosition:
          null,

        positionsConsumed:
          this.positionsConsumed(
            result,
          ),
      });
    }


    if (
      result.event ===
      'CAPITAL_STOP'
    ) {
      return this.build({
        state:
          'STOP',

        formationState,

        summary:
          'STOP | Capital Preservation',

        reason:
          result
            .financialRecommendation
            ?.capital
            ?.stopReason ??
          'TRIPLICACAO_CAPITAL_STOP',

        recommendationPending:
          false,

        zeroPosition:
          null,

        positionsConsumed:
          this.positionsConsumed(
            result,
          ),
      });
    }


    if (
      result.event ===
      'FORMATION_STARTED'
    ) {
      return this.build({
        state:
          'FORMING',

        formationState,

        summary:
          `${formationState} | primeira posição registrada`,

        reason:
          'TRIPLICACAO_WAITING_FOR_SECOND_POSITION',

        recommendationPending:
          false,

        zeroPosition:
          null,

        positionsConsumed:
          1,
      });
    }


    if (
      result.event ===
      'NO_RECOMMENDATION'
    ) {
      const action =
        result.formation.action;

      if (
        action !==
          null &&
        action.status !==
          'ACTION'
      ) {
        return this.build({
          state:
            'OBSERVING',

          formationState,

          summary:
            `${formationState} | sem entrada`,

          reason:
            action.rationale ||
            'TRIPLICACAO_ACTION_SEMANTICS_OBSERVE',

          recommendationPending:
            false,

          zeroPosition:
            null,

          positionsConsumed:
            this.positionsConsumed(
              result,
            ),
        });
      }

      return this.build({
        state:
          'OBSERVING',

        formationState,

        summary:
          `${formationState} | sem entrada`,

        reason:
          result.operatorMessage ||
          'TRIPLICACAO_NO_RECOMMENDATION',

        recommendationPending:
          false,

        zeroPosition:
          null,

        positionsConsumed:
          this.positionsConsumed(
            result,
          ),
      });
    }


    return this.build({
      state:
        'OBSERVING',

      formationState,

      summary:
        `${formationState} | observando`,

      reason:
        'TRIPLICACAO_UNCLASSIFIED_OBSERVATION',

      recommendationPending:
        result.pendingSignalId !==
        null,

      zeroPosition:
        null,

      positionsConsumed:
        this.positionsConsumed(
          result,
        ),
    });
  }


  public status(
    snapshot:
      TriplicacaoProspectiveSessionSnapshot,
  ): readonly string[] {
    const bankroll =
      snapshot.currentBankroll;

    const peak =
      snapshot.peakBankroll;

    const debt =
      snapshot.pendingLossDebt;

    return Object.freeze([
      '========================================',
      ' RL.SYS — STATUS LIVE',
      '========================================',
      '',
      ` Sessão .............. ${snapshot.sessionId}`,
      ` Formação ............ ${snapshot.formationState}`,
      ` Sinais registrados .. ${snapshot.totalRecordedSignals}`,
      ` Sinal pendente ...... ${snapshot.pendingSignalId ?? 'nenhum'}`,
      ` Decisão pendente .... ${snapshot.pendingOperatorDecision ?? 'nenhuma'}`,
      '',
      ` Banca PAPER ......... ${bankroll === null ? 'N/A' : `R$ ${this.money(bankroll)}`}`,
      ` Pico ................ ${peak === null ? 'N/A' : `R$ ${this.money(peak)}`}`,
      ` Recovery debt ....... ${debt === null ? 'N/A' : `R$ ${this.money(debt)}`}`,
      ` Capital ............. ${snapshot.capitalDecision ?? 'N/A'}`,
      ` Martingale .......... ${
        snapshot.martingaleEnabled ===
          null
          ? 'N/A'
          : snapshot.martingaleEnabled
            ? 'ON'
            : 'OFF'
      }`,
      '',
      ` Fronteira ........... ${snapshot.postSync?.mode ?? 'N/A'}`,
      '',
      ' Execução automática . NÃO',
      ' Supervisão humana ... OBRIGATÓRIA',
      '========================================',
    ]);
  }


  private zeroMetadata(
    result:
      TriplicacaoProspectiveSessionResult,
  ): {
    readonly invalidated:
      boolean;

    readonly zeroPosition:
      1 | 2 | 3 | null;

    readonly positionsConsumed:
      0 | 1 | 2 | 3;
  } {
    const formation =
      result.formation;

    let zeroPosition:
      1 | 2 | 3 | null =
        null;

    if (
      formation.firstNumber ===
      0
    ) {
      zeroPosition =
        1;
    } else if (
      formation.secondNumber ===
      0
    ) {
      zeroPosition =
        2;
    } else if (
      formation.spin ===
        0 &&
      formation.stateBefore ===
        'WAITING_THIRD'
    ) {
      zeroPosition =
        3;
    } else {
      const marker =
        formation.reasons.find(
          (reason) =>
            reason.startsWith(
              'TRIPLICACAO_ZERO_POSITION:',
            ),
        );

      if (
        marker
      ) {
        const parsed =
          Number(
            marker.split(':')[1],
          );

        if (
          parsed ===
            1 ||
          parsed ===
            2 ||
          parsed ===
            3
        ) {
          zeroPosition =
            parsed;
        }
      }
    }

    const invalidated =
      zeroPosition !==
      null;

    return Object.freeze({
      invalidated,

      zeroPosition,

      positionsConsumed:
        this.positionsConsumed(
          result,
        ),
    });
  }


  private positionsConsumed(
    result:
      TriplicacaoProspectiveSessionResult,
  ): 0 | 1 | 2 | 3 {
    if (
      result.formation.trioCompleted ||
      result.formation.trioDiscarded ||
      result.formation.stateBefore ===
        'WAITING_THIRD'
    ) {
      return 3;
    }

    if (
      result.formationState ===
      'WAITING_THIRD'
    ) {
      return 2;
    }

    if (
      result.formationState ===
      'WAITING_SECOND'
    ) {
      return 1;
    }

    return 0;
  }


  private build(
    input: {
      readonly state:
        TriplicacaoLiveOperationalState;

      readonly formationState:
        string;

      readonly summary:
        string;

      readonly reason:
        string;

      readonly recommendationPending:
        boolean;

      readonly zeroPosition:
        1 | 2 | 3 | null;

      readonly positionsConsumed:
        0 | 1 | 2 | 3;
    },
  ): TriplicacaoLiveObservation {
    return Object.freeze({
      state:
        input.state,

      formationState:
        input.formationState,

      summary:
        input.summary,

      reason:
        input.reason,

      recommendationPending:
        input.recommendationPending,

      zeroPosition:
        input.zeroPosition,

      positionsConsumed:
        input.positionsConsumed,

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  private money(
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
