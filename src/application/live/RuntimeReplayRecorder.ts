import {
  ReplayVerdict,
  SessionReplayEvent
} from '../../domain/replay/SessionReplayContracts';
import { SessionReplayStudio } from '../../domain/replay/SessionReplayStudio';

export interface RuntimeReplayRecordInput {
  readonly sessionId: string;
  readonly spinIndex: number;
  readonly verdict: ReplayVerdict;
  readonly trigger: string;
  readonly reason: string;
  readonly latencyMs: number;
  readonly timestamp?: number;
}

/**
 * Adapter used by live application flows to persist runtime verdict lineage
 * without coupling tactical coordination to filesystem details.
 */
export class RuntimeReplayRecorder {
  public constructor(
    private readonly replayStudio: SessionReplayStudio
  ) {}

  public async record(
    input: RuntimeReplayRecordInput
  ): Promise<SessionReplayEvent> {
    const timestamp = input.timestamp ?? Date.now();

    const event: SessionReplayEvent = {
      eventId: this.buildEventId(input.sessionId, input.spinIndex, timestamp),
      sessionId: input.sessionId,
      spinIndex: input.spinIndex,
      verdict: input.verdict,
      trigger: input.trigger,
      reason: input.reason,
      timestamp,
      latencyMs: input.latencyMs
    };

    await this.replayStudio.append(event);
    return event;
  }

  private buildEventId(
    sessionId: string,
    spinIndex: number,
    timestamp: number
  ): string {
    return `${sessionId}-${spinIndex}-${timestamp}`;
  }
}
