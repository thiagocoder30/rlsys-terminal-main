import {
  ReplayVerdict,
  SessionReplayEvent,
  SessionReplayRepository
} from './SessionReplayContracts';

/**
 * SessionReplayStudio records causal runtime decisions without retaining
 * the full session history in memory.
 *
 * Memory model:
 * - O(1) for latest verdict
 * - O(k) for verdict counters, where k is bounded by the fixed verdict enum
 * - durable history is delegated to an append-only repository
 */
export class SessionReplayStudio {
  private lastVerdict: ReplayVerdict | null = null;
  private readonly verdictCounts = new Map<ReplayVerdict, number>();

  public constructor(
    private readonly repository?: SessionReplayRepository
  ) {}

  public async append(
    event: SessionReplayEvent
  ): Promise<void> {
    this.lastVerdict = event.verdict;

    this.verdictCounts.set(
      event.verdict,
      (this.verdictCounts.get(event.verdict) ?? 0) + 1
    );

    if (this.repository !== undefined) {
      await this.repository.append(event);
    }
  }

  public getLastVerdict(): ReplayVerdict | null {
    return this.lastVerdict;
  }

  public countVerdict(
    verdict: ReplayVerdict
  ): number {
    return this.verdictCounts.get(verdict) ?? 0;
  }
}
