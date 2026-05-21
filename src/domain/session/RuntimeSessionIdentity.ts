export interface RuntimeSessionIdentity {
  readonly sessionId: string;
  readonly startedAtEpochMs: number;
}

/**
 * Creates immutable runtime session identities.
 *
 * The ID is deterministic by timestamp input and contains no randomness,
 * making tests reproducible while still producing unique IDs at boot time.
 */
export class RuntimeSessionIdentityFactory {
  public create(nowEpochMs: number = Date.now()): RuntimeSessionIdentity {
    return {
      sessionId: `runtime-${this.formatUtc(nowEpochMs)}`,
      startedAtEpochMs: nowEpochMs,
    };
  }

  private formatUtc(epochMs: number): string {
    const date = new Date(epochMs);

    const year = date.getUTCFullYear();
    const month = this.pad(date.getUTCMonth() + 1);
    const day = this.pad(date.getUTCDate());
    const hour = this.pad(date.getUTCHours());
    const minute = this.pad(date.getUTCMinutes());
    const second = this.pad(date.getUTCSeconds());

    return `${year}${month}${day}-${hour}${minute}${second}`;
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
