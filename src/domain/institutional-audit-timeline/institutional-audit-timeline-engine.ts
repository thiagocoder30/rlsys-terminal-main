export type InstitutionalAuditEventType =
  | 'SESSION_STARTED'
  | 'WARMUP_UPDATED'
  | 'GATE_EVALUATED'
  | 'CONSENSUS_EVALUATED'
  | 'CONFIDENCE_CALIBRATED'
  | 'HUD_DECISION'
  | 'EXPLANATION_CREATED'
  | 'TRACE_CREATED'
  | 'OPERATOR_EVENT'
  | 'RISK_EVENT'
  | 'SESSION_FINISHED';

export type InstitutionalAuditSeverity =
  | 'INFO'
  | 'WARNING'
  | 'BLOCKER';

export type InstitutionalAuditTimelineStatus =
  | 'AUDIT_STABLE'
  | 'AUDIT_REQUIRES_REVIEW'
  | 'AUDIT_BLOCKED';

export type InstitutionalAuditTimelineReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'EMPTY_TIMELINE'
  | 'TIMELINE_ORDERED'
  | 'TIMELINE_HAS_WARNINGS'
  | 'TIMELINE_HAS_BLOCKERS'
  | 'EXCESSIVE_BLOCKERS'
  | 'EXCESSIVE_WARNINGS'
  | 'SESSION_NOT_FINISHED'
  | 'POLICY_LOCK_ACTIVE';

export interface InstitutionalAuditTimelineEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly occurredAtEpochMs: number;
  readonly type: InstitutionalAuditEventType;
  readonly severity: InstitutionalAuditSeverity;
  readonly source: string;
  readonly message: string;
}

export interface InstitutionalAuditTimelineInput {
  readonly sessionId: string;
  readonly events: readonly InstitutionalAuditTimelineEvent[];
}

export interface InstitutionalAuditTimelinePolicy {
  readonly maximumWarningsBeforeReview: number;
  readonly maximumBlockersBeforeBlocked: number;
  readonly requireSessionFinished: boolean;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface InstitutionalAuditTimelineItem {
  readonly order: number;
  readonly eventId: string;
  readonly occurredAtEpochMs: number;
  readonly type: InstitutionalAuditEventType;
  readonly severity: InstitutionalAuditSeverity;
  readonly source: string;
  readonly message: string;
}

export interface InstitutionalAuditTimelineReport {
  readonly sessionId: string;
  readonly status: InstitutionalAuditTimelineStatus;
  readonly totalEvents: number;
  readonly infoCount: number;
  readonly warningCount: number;
  readonly blockerCount: number;
  readonly firstEventAtEpochMs: number | null;
  readonly lastEventAtEpochMs: number | null;
  readonly timeline: readonly InstitutionalAuditTimelineItem[];
  readonly reasons: readonly InstitutionalAuditTimelineReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface InstitutionalAuditTimelineFailure {
  readonly code: 'INVALID_INSTITUTIONAL_AUDIT_TIMELINE_INPUT';
  readonly message: string;
}

export type InstitutionalAuditTimelineResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalAuditTimelineReport;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalAuditTimelineFailure;
    };

interface TimelineCounters {
  readonly infoCount: number;
  readonly warningCount: number;
  readonly blockerCount: number;
  readonly hasFinishedSession: boolean;
}

const DEFAULT_POLICY: InstitutionalAuditTimelinePolicy = Object.freeze({
  maximumWarningsBeforeReview: 3,
  maximumBlockersBeforeBlocked: 0,
  requireSessionFinished: false,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const severityRank = (severity: InstitutionalAuditSeverity): number => {
  if (severity === 'BLOCKER') {
    return 3;
  }

  if (severity === 'WARNING') {
    return 2;
  }

  return 1;
};

const compareEvents = (
  left: InstitutionalAuditTimelineEvent,
  right: InstitutionalAuditTimelineEvent,
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

export class InstitutionalAuditTimelineEngine {
  private readonly policy: InstitutionalAuditTimelinePolicy;

  public constructor(policy: InstitutionalAuditTimelinePolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      maximumWarningsBeforeReview: policy.maximumWarningsBeforeReview,
      maximumBlockersBeforeBlocked: policy.maximumBlockersBeforeBlocked,
      requireSessionFinished: policy.requireSessionFinished,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Builds a deterministic audit timeline.
   * Complexity: O(n log n) due chronological sorting, O(n) memory.
   */
  public buildTimeline(
    input: InstitutionalAuditTimelineInput,
  ): InstitutionalAuditTimelineResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const orderedEvents = [...input.events].sort(compareEvents);
    const timeline = this.createTimeline(orderedEvents);
    const counters = this.countEvents(orderedEvents);
    const reasons = this.resolveReasons(orderedEvents, counters);
    const status = this.resolveStatus(orderedEvents, counters);

    return {
      ok: true,
      value: Object.freeze({
        sessionId: input.sessionId,
        status,
        totalEvents: orderedEvents.length,
        infoCount: counters.infoCount,
        warningCount: counters.warningCount,
        blockerCount: counters.blockerCount,
        firstEventAtEpochMs: orderedEvents[0]?.occurredAtEpochMs ?? null,
        lastEventAtEpochMs:
          orderedEvents[orderedEvents.length - 1]?.occurredAtEpochMs ?? null,
        timeline: Object.freeze(timeline),
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private createTimeline(
    events: readonly InstitutionalAuditTimelineEvent[],
  ): InstitutionalAuditTimelineItem[] {
    const timeline: InstitutionalAuditTimelineItem[] = [];

    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];

      if (event === undefined) {
        continue;
      }

      timeline.push(
        Object.freeze({
          order: index + 1,
          eventId: event.eventId,
          occurredAtEpochMs: event.occurredAtEpochMs,
          type: event.type,
          severity: event.severity,
          source: event.source,
          message: event.message,
        }),
      );
    }

    return timeline;
  }

  private countEvents(
    events: readonly InstitutionalAuditTimelineEvent[],
  ): TimelineCounters {
    let infoCount = 0;
    let warningCount = 0;
    let blockerCount = 0;
    let hasFinishedSession = false;

    for (const event of events) {
      if (event.severity === 'INFO') {
        infoCount += 1;
      }

      if (event.severity === 'WARNING') {
        warningCount += 1;
      }

      if (event.severity === 'BLOCKER') {
        blockerCount += 1;
      }

      if (event.type === 'SESSION_FINISHED') {
        hasFinishedSession = true;
      }
    }

    return {
      infoCount,
      warningCount,
      blockerCount,
      hasFinishedSession,
    };
  }

  private resolveStatus(
    events: readonly InstitutionalAuditTimelineEvent[],
    counters: TimelineCounters,
  ): InstitutionalAuditTimelineStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'AUDIT_BLOCKED';
    }

    if (events.length === 0) {
      return 'AUDIT_REQUIRES_REVIEW';
    }

    if (counters.blockerCount > this.policy.maximumBlockersBeforeBlocked) {
      return 'AUDIT_BLOCKED';
    }

    if (
      this.policy.requireSessionFinished &&
      counters.hasFinishedSession === false
    ) {
      return 'AUDIT_REQUIRES_REVIEW';
    }

    if (counters.warningCount > this.policy.maximumWarningsBeforeReview) {
      return 'AUDIT_REQUIRES_REVIEW';
    }

    return 'AUDIT_STABLE';
  }

  private resolveReasons(
    events: readonly InstitutionalAuditTimelineEvent[],
    counters: TimelineCounters,
  ): InstitutionalAuditTimelineReason[] {
    const reasons: InstitutionalAuditTimelineReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (events.length === 0) {
      reasons.push('EMPTY_TIMELINE');
      return reasons;
    }

    reasons.push('TIMELINE_ORDERED');

    if (counters.warningCount > 0) {
      reasons.push('TIMELINE_HAS_WARNINGS');
    }

    if (counters.blockerCount > 0) {
      reasons.push('TIMELINE_HAS_BLOCKERS');
    }

    if (counters.warningCount > this.policy.maximumWarningsBeforeReview) {
      reasons.push('EXCESSIVE_WARNINGS');
    }

    if (counters.blockerCount > this.policy.maximumBlockersBeforeBlocked) {
      reasons.push('EXCESSIVE_BLOCKERS');
    }

    if (
      this.policy.requireSessionFinished &&
      counters.hasFinishedSession === false
    ) {
      reasons.push('SESSION_NOT_FINISHED');
    }

    return reasons;
  }

  private validate(
    input: InstitutionalAuditTimelineInput,
  ): InstitutionalAuditTimelineFailure | null {
    if (input.sessionId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_AUDIT_TIMELINE_INPUT',
        message: 'sessionId must not be empty',
      };
    }

    if (this.policy.maximumWarningsBeforeReview < 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_AUDIT_TIMELINE_INPUT',
        message: 'maximumWarningsBeforeReview must not be negative',
      };
    }

    if (this.policy.maximumBlockersBeforeBlocked < 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_AUDIT_TIMELINE_INPUT',
        message: 'maximumBlockersBeforeBlocked must not be negative',
      };
    }

    for (const event of input.events) {
      if (event.eventId.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_AUDIT_TIMELINE_INPUT',
          message: 'eventId must not be empty',
        };
      }

      if (event.sessionId !== input.sessionId) {
        return {
          code: 'INVALID_INSTITUTIONAL_AUDIT_TIMELINE_INPUT',
          message: 'event sessionId must match timeline sessionId',
        };
      }

      if (!Number.isFinite(event.occurredAtEpochMs) || event.occurredAtEpochMs < 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_AUDIT_TIMELINE_INPUT',
          message: 'occurredAtEpochMs must be a valid non-negative timestamp',
        };
      }

      if (event.source.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_AUDIT_TIMELINE_INPUT',
          message: 'source must not be empty',
        };
      }

      if (event.message.trim().length === 0) {
        return {
          code: 'INVALID_INSTITUTIONAL_AUDIT_TIMELINE_INPUT',
          message: 'message must not be empty',
        };
      }
    }

    return null;
  }
}
