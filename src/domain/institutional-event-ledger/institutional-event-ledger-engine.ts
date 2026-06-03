export type InstitutionalLedgerEventType =
  | 'SESSION_STARTED'
  | 'WARMUP_CAPTURED'
  | 'CONTEXT_UPDATED'
  | 'GATE_EVALUATED'
  | 'CONSENSUS_EVALUATED'
  | 'CONFIDENCE_CALIBRATED'
  | 'HUD_DECISION'
  | 'EXPLANATION_CREATED'
  | 'TRACE_CREATED'
  | 'AUDIT_TIMELINE_CREATED'
  | 'OPERATOR_EVENT'
  | 'RISK_EVENT'
  | 'SESSION_FINISHED';

export type InstitutionalLedgerSeverity =
  | 'INFO'
  | 'WARNING'
  | 'BLOCKER';

export type InstitutionalLedgerStatus =
  | 'LEDGER_STABLE'
  | 'LEDGER_REQUIRES_REVIEW'
  | 'LEDGER_BLOCKED';

export type InstitutionalLedgerReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'LEDGER_EMPTY'
  | 'LEDGER_ORDERED'
  | 'LEDGER_DEDUPLICATED'
  | 'LEDGER_HAS_WARNINGS'
  | 'LEDGER_HAS_BLOCKERS'
  | 'EXCESSIVE_WARNINGS'
  | 'EXCESSIVE_BLOCKERS'
  | 'CHECKSUM_GENERATED'
  | 'POLICY_LOCK_ACTIVE';

export interface InstitutionalLedgerEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly occurredAtEpochMs: number;
  readonly type: InstitutionalLedgerEventType;
  readonly severity: InstitutionalLedgerSeverity;
  readonly source: string;
  readonly message: string;
}

export interface InstitutionalLedgerInput {
  readonly sessionId: string;
  readonly events: readonly InstitutionalLedgerEvent[];
}

export interface InstitutionalLedgerPolicy {
  readonly maximumWarningsBeforeReview: number;
  readonly maximumBlockersBeforeBlocked: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface InstitutionalLedgerEntry {
  readonly sequence: number;
  readonly eventId: string;
  readonly sessionId: string;
  readonly occurredAtEpochMs: number;
  readonly type: InstitutionalLedgerEventType;
  readonly severity: InstitutionalLedgerSeverity;
  readonly source: string;
  readonly message: string;
  readonly checksum: string;
}

export interface InstitutionalLedgerReport {
  readonly sessionId: string;
  readonly status: InstitutionalLedgerStatus;
  readonly totalInputEvents: number;
  readonly totalLedgerEntries: number;
  readonly duplicateEventsRemoved: number;
  readonly warningCount: number;
  readonly blockerCount: number;
  readonly ledgerChecksum: string;
  readonly entries: readonly InstitutionalLedgerEntry[];
  readonly reasons: readonly InstitutionalLedgerReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface InstitutionalLedgerFailure {
  readonly code: 'INVALID_INSTITUTIONAL_LEDGER_INPUT';
  readonly message: string;
}

export type InstitutionalLedgerResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalLedgerReport;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalLedgerFailure;
    };

interface LedgerCounters {
  readonly warningCount: number;
  readonly blockerCount: number;
}

const DEFAULT_POLICY: InstitutionalLedgerPolicy = Object.freeze({
  maximumWarningsBeforeReview: 3,
  maximumBlockersBeforeBlocked: 0,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const severityRank = (severity: InstitutionalLedgerSeverity): number => {
  if (severity === 'BLOCKER') {
    return 3;
  }

  if (severity === 'WARNING') {
    return 2;
  }

  return 1;
};

const compareEvents = (
  left: InstitutionalLedgerEvent,
  right: InstitutionalLedgerEvent,
): number => {
  const timeDelta = left.occurredAtEpochMs - right.occurredAtEpochMs;

  if (timeDelta !== 0) {
    return timeDelta;
  }

  const severityDelta = severityRank(right.severity) - severityRank(left.severity);

  if (severityDelta !== 0) {
    return severityDelta;
  }

  return left.eventId.localeCompare(right.eventId);
};

const checksumOf = (value: string): string => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

export class InstitutionalEventLedgerEngine {
  private readonly policy: InstitutionalLedgerPolicy;

  public constructor(policy: InstitutionalLedgerPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      maximumWarningsBeforeReview: policy.maximumWarningsBeforeReview,
      maximumBlockersBeforeBlocked: policy.maximumBlockersBeforeBlocked,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Builds an immutable institutional event ledger.
   * Complexity: O(n log n) because of deterministic chronological ordering.
   * Deduplication is O(n) using a Map keyed by eventId.
   */
  public buildLedger(input: InstitutionalLedgerInput): InstitutionalLedgerResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const deduplicatedEvents = this.deduplicate(input.events);
    const orderedEvents = [...deduplicatedEvents].sort(compareEvents);
    const entries = this.createEntries(orderedEvents);
    const counters = this.countEntries(entries);
    const ledgerChecksum = this.createLedgerChecksum(entries);
    const reasons = this.resolveReasons(input.events.length, entries, counters);
    const status = this.resolveStatus(entries, counters);

    return {
      ok: true,
      value: Object.freeze({
        sessionId: input.sessionId,
        status,
        totalInputEvents: input.events.length,
        totalLedgerEntries: entries.length,
        duplicateEventsRemoved: input.events.length - entries.length,
        warningCount: counters.warningCount,
        blockerCount: counters.blockerCount,
        ledgerChecksum,
        entries: Object.freeze(entries),
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private deduplicate(
    events: readonly InstitutionalLedgerEvent[],
  ): readonly InstitutionalLedgerEvent[] {
    const byEventId = new Map<string, InstitutionalLedgerEvent>();

    for (const event of events) {
      if (!byEventId.has(event.eventId)) {
        byEventId.set(event.eventId, event);
      }
    }

    return Object.freeze([...byEventId.values()]);
  }

  private createEntries(
    events: readonly InstitutionalLedgerEvent[],
  ): InstitutionalLedgerEntry[] {
    const entries: InstitutionalLedgerEntry[] = [];

    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];

      if (event === undefined) {
        continue;
      }

      const sequence = index + 1;
      const checksumPayload = [
        sequence,
        event.eventId,
        event.sessionId,
        event.occurredAtEpochMs,
        event.type,
        event.severity,
        event.source,
        event.message,
      ].join('|');

      entries.push(
        Object.freeze({
          sequence,
          eventId: event.eventId,
          sessionId: event.sessionId,
          occurredAtEpochMs: event.occurredAtEpochMs,
          type: event.type,
          severity: event.severity,
          source: event.source,
          message: event.message,
          checksum: checksumOf(checksumPayload),
        }),
      );
    }

    return entries;
  }

  private countEntries(
    entries: readonly InstitutionalLedgerEntry[],
  ): LedgerCounters {
    let warningCount = 0;
    let blockerCount = 0;

    for (const entry of entries) {
      if (entry.severity === 'WARNING') {
        warningCount += 1;
      }

      if (entry.severity === 'BLOCKER') {
        blockerCount += 1;
      }
    }

    return {
      warningCount,
      blockerCount,
    };
  }

  private createLedgerChecksum(
    entries: readonly InstitutionalLedgerEntry[],
  ): string {
    const payload = entries
      .map((entry) => `${entry.sequence}:${entry.eventId}:${entry.checksum}`)
      .join('#');

    return checksumOf(payload);
  }

  private resolveStatus(
    entries: readonly InstitutionalLedgerEntry[],
    counters: LedgerCounters,
  ): InstitutionalLedgerStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'LEDGER_BLOCKED';
    }

    if (entries.length === 0) {
      return 'LEDGER_REQUIRES_REVIEW';
    }

    if (counters.blockerCount > this.policy.maximumBlockersBeforeBlocked) {
      return 'LEDGER_BLOCKED';
    }

    if (counters.warningCount > this.policy.maximumWarningsBeforeReview) {
      return 'LEDGER_REQUIRES_REVIEW';
    }

    return 'LEDGER_STABLE';
  }

  private resolveReasons(
    totalInputEvents: number,
    entries: readonly InstitutionalLedgerEntry[],
    counters: LedgerCounters,
  ): InstitutionalLedgerReason[] {
    const reasons: InstitutionalLedgerReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (entries.length === 0) {
      reasons.push('LEDGER_EMPTY');
      return reasons;
    }

    reasons.push('LEDGER_ORDERED');

    if (totalInputEvents > entries.length) {
      reasons.push('LEDGER_DEDUPLICATED');
    }

    if (counters.warningCount > 0) {
      reasons.push('LEDGER_HAS_WARNINGS');
    }

    if (counters.blockerCount > 0) {
      reasons.push('LEDGER_HAS_BLOCKERS');
    }

    if (counters.warningCount > this.policy.maximumWarningsBeforeReview) {
      reasons.push('EXCESSIVE_WARNINGS');
    }

    if (counters.blockerCount > this.policy.maximumBlockersBeforeBlocked) {
      reasons.push('EXCESSIVE_BLOCKERS');
    }

    reasons.push('CHECKSUM_GENERATED');

    return reasons;
  }

  private validate(
    input: InstitutionalLedgerInput,
  ): InstitutionalLedgerFailure | null {
    if (input.sessionId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_LEDGER_INPUT',
        message: 'sessionId must not be empty',
      };
    }

    if (this.policy.maximumWarningsBeforeReview < 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_LEDGER_INPUT',
        message: 'maximumWarningsBeforeReview must not be negative',
      };
    }

    if (this.policy.maximumBlockersBeforeBlocked < 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_LEDGER_INPUT',
        message: 'maximumBlockersBeforeBlocked must not be negative',
      };
    }

    for (const event of input.events) {
      if (event.eventId.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_LEDGER_INPUT',
          message: 'eventId must not be empty',
        };
      }

      if (event.sessionId !== input.sessionId) {
        return {
          code: 'INVALID_INSTITUTIONAL_LEDGER_INPUT',
          message: 'event sessionId must match ledger sessionId',
        };
      }

      if (!Number.isFinite(event.occurredAtEpochMs) || event.occurredAtEpochMs < 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_LEDGER_INPUT',
          message: 'occurredAtEpochMs must be a valid non-negative timestamp',
        };
      }

      if (event.source.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_LEDGER_INPUT',
          message: 'source must not be empty',
        };
      }

      if (event.message.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_LEDGER_INPUT',
          message: 'message must not be empty',
        };
      }
    }

    return null;
  }
}
