import type {
  LiveSessionRuntimeServiceInput,
  LiveSessionRuntimeServiceReport,
} from '../session/LiveSessionRuntimeService.js';

import type {
  ManualRoundIngestionSourcePort,
  OperatorRoundResult,
  OperatorRuntimeStatus,
  OperatorStatusSourcePort,
} from './OperatorRuntimePorts.js';


interface LiveSessionRuntimeServicePort {

  ingest(
    input:
      LiveSessionRuntimeServiceInput,
  ): LiveSessionRuntimeServiceReport;

}


export interface LiveSessionOperatorAdapterOptions {

  readonly sessionId:
    string;

  readonly bankroll?:
    number;

}


/**
 * Adapts manual Enterprise CLI round ingestion to the
 * existing LiveSessionRuntimeService.
 *
 * Responsibilities:
 *
 * - provide supervised operator status;
 * - translate a manually entered roulette number into
 *   LiveSessionRuntimeService input;
 * - preserve a local read-only projection of the last
 *   runtime state;
 * - generate deterministic per-session event ids and
 *   monotonic sequence numbers.
 *
 * This adapter MUST NOT:
 *
 * - own stdin/stdout;
 * - invoke readline;
 * - calculate strategies;
 * - calculate stake;
 * - settle entries;
 * - authorize live-money execution;
 * - fabricate Triplicacao/Fusion recommendations.
 */
export class LiveSessionOperatorAdapter
implements
  OperatorStatusSourcePort,
  ManualRoundIngestionSourcePort {

  private readonly sessionId:
    string;

  private readonly bankroll:
    number;

  private nextSequence =
    0;

  private lastReport:
    LiveSessionRuntimeServiceReport
    | null =
      null;


  public constructor(
    private readonly service:
      LiveSessionRuntimeServicePort,

    options:
      LiveSessionOperatorAdapterOptions,
  ) {

    const sessionId =
      options.sessionId
        ?.trim();


    if (!sessionId) {

      throw new Error(
        'operator live session id is required',
      );

    }


    const bankroll =
      Number(
        options.bankroll ?? 0,
      );


    if (
      !Number.isFinite(bankroll)
      || bankroll < 0
    ) {

      throw new Error(
        'operator bankroll must be a non-negative finite number',
      );

    }


    this.sessionId =
      sessionId;


    this.bankroll =
      bankroll;

  }


  public getOperatorStatus():
    OperatorRuntimeStatus {

    if (!this.lastReport) {

      return {
        sessionId:
          this.sessionId,

        phase:
          'INITIALIZING',

        roundCount:
          0,

        operatorMode:
          'SUPERVISED',

        execution:
          'MANUAL_OPERATOR_ONLY',

        automaticEntry:
          false,
      };

    }


    return {
      sessionId:
        this.lastReport
          .sessionId,

      phase:
        this.lastReport
          .executiveSummary
          .liveRuntimeGate,

      roundCount:
        this.lastReport
          .snapshot
          .roundCount,

      operatorMode:
        'SUPERVISED',

      execution:
        'MANUAL_OPERATOR_ONLY',

      automaticEntry:
        false,
    };

  }


  public async ingestRound(
    round: number,
  ): Promise<OperatorRoundResult> {

    if (
      !Number.isInteger(round)
      || round < 0
      || round > 36
    ) {

      const status =
        this.getOperatorStatus();


      return {
        accepted:
          false,

        round,

        roundCount:
          status.roundCount,

        phase:
          status.phase,

        message:
          'round must be an integer between 0 and 36',
      };

    }


    const sequence =
      this.nextSequence;


    const report =
      this.service.ingest({
        sessionId:
          this.sessionId,

        value:
          round,

        sequence,

        eventId:
          this.eventId(
            sequence,
          ),

        bankroll:
          this.bankroll,
      });


    this.nextSequence +=
      1;


    this.lastReport =
      report;


    return {
      accepted:
        report.status
          === 'ACCEPTED',

      round,

      roundCount:
        report.snapshot
          .roundCount,

      phase:
        report.executiveSummary
          .liveRuntimeGate,

      message:
        this.message(
          report,
        ),
    };

  }


  private eventId(
    sequence: number,
  ): string {

    return [
      this.sessionId,
      'operator',
      sequence,
    ].join(':');

  }


  private message(
    report:
      LiveSessionRuntimeServiceReport,
  ): string {

    if (
      report.status
        === 'ACCEPTED'
    ) {

      return [
        'round accepted',
        report
          .executiveSummary
          .reason,
      ].join(': ');

    }


    if (
      report.status
        === 'DUPLICATE_IGNORED'
    ) {

      return [
        'duplicate round ignored',
        report
          .executiveSummary
          .reason,
      ].join(': ');

    }


    return [
      'round rejected',
      report
        .executiveSummary
        .reason,
    ].join(': ');

  }

}
