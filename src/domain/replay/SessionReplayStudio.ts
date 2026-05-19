import {
  SessionReplayEvent
} from './SessionReplayContracts';

export class SessionReplayStudio {
  private readonly events: SessionReplayEvent[] = [];

  public append(
    event: SessionReplayEvent
  ): void {
    this.events.push(event);
  }

  public getEvents(): readonly SessionReplayEvent[] {
    return this.events;
  }

  public getLastVerdict(): string | null {
    if (this.events.length === 0) {
      return null;
    }

    return this.events[this.events.length - 1].verdict;
  }

  public countVerdict(
    verdict: string
  ): number {
    let count = 0;

    for (const event of this.events) {
      if (event.verdict === verdict) {
        count++;
      }
    }

    return count;
  }
}
