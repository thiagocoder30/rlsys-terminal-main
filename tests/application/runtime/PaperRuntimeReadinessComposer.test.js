const {
  PaperRuntimeReadinessComposer,
} = require('../../../dist/application/runtime/PaperRuntimeReadinessComposer.js');

function configuration(overrides = {}) {
  return {
    status: 'CONFIGURED',
    sessionId: 'paper-ready-001',
    bankroll: 150,
    provider: 'EVOLUTION',
    minimumChipValue: 0.50,
    operatorId: 'Thiago',
    riskMode: 'CONSERVATIVE',
    allowMartingale: false,
    ...overrides,
  };
}

function runtimeCertificationInput(overrides = {}) {
  return {
    hasInteractiveLoop: true,
    hasOperationalGate: true,
    hasSessionSupervisor: true,
    hasHudComposer: true,
    hasReplAdapter: true,
    allowsPrepareWithoutOperationGateConfusion: true,
    ...overrides,
  };
}

function readyEndurance() {
  return {
    sources: [
      {
        name: 'runtime-soak-report.json',
        content: JSON.stringify({
          generatedAtEpochMs: 1000,
          durationMs: 60000,
          result: {
            stable: true,
            iterations: 50000,
            heapDriftBytes: 1024,
            peakEventLoopLagMs: 10,
            pressureViolations: 0,
          },
        }),
      },
    ],
    baseline: 'MOBILE_CONSERVATIVE',
  };
}

describe('PaperRuntimeReadinessComposer', () => {
  test('composes real readiness evidence and releases PREPARE eligibility', () => {
    const composer =
      new PaperRuntimeReadinessComposer();

    const result = composer.compose({
      configuration: configuration(),

      runtimeCertification:
        runtimeCertificationInput(),

      endurance:
        readyEndurance(),

      operatorSupervised: true,

      sessionState: 'IDLE',

      nowEpochMs: 10000,
    });

    expect(
      result.runtimeCertification.status,
    ).toBe('CERTIFIED');

    expect(
      result.endurance.status,
    ).toBe('READY');

    expect([
      'RISK_ALLOW',
      'RISK_REVIEW',
      'RISK_BLOCK',
    ]).toContain(
      result.risk.decision.verdict,
    );

    expect(
      result.readiness.runtimePaperAvailable,
    ).toBe(true);

    expect(
      result.readiness.enduranceStatus,
    ).toBe('CERTIFIED');

    expect(
      result.paperOnly,
    ).toBe(true);

    expect(
      result.liveMoneyAuthorization,
    ).toBe(false);

    expect(
      result.automaticExecutionAllowed,
    ).toBe(false);
  });

  test('returns not ready when endurance evidence is absent', () => {
    const composer =
      new PaperRuntimeReadinessComposer();

    const result = composer.compose({
      configuration: configuration(),

      runtimeCertification:
        runtimeCertificationInput(),

      endurance: {
        sources: [],
        baseline: 'MOBILE_CONSERVATIVE',
      },

      operatorSupervised: true,

      sessionState: 'IDLE',

      nowEpochMs: 20000,
    });

    expect(
      result.endurance.status,
    ).toBe('NO_DATA');

    expect(
      result.readyForPrepare,
    ).toBe(false);

    expect(
      result.readiness.blockers,
    ).toContain(
      'ENDURANCE_NO_DATA',
    );
  });

  test('returns not ready when runtime certification fails', () => {
    const composer =
      new PaperRuntimeReadinessComposer();

    const result = composer.compose({
      configuration: configuration(),

      runtimeCertification:
        runtimeCertificationInput({
          hasOperationalGate: false,
        }),

      endurance:
        readyEndurance(),

      operatorSupervised: true,

      sessionState: 'IDLE',

      nowEpochMs: 30000,
    });

    expect(
      result.runtimeCertification.status,
    ).toBe('FAILED');

    expect(
      result.readyForPrepare,
    ).toBe(false);

    expect(
      result.readiness.blockers,
    ).toContain(
      'PAPER_RUNTIME_NOT_CERTIFIED',
    );
  });

  test('returns not ready when human supervision is absent', () => {
    const composer =
      new PaperRuntimeReadinessComposer();

    const result = composer.compose({
      configuration: configuration(),

      runtimeCertification:
        runtimeCertificationInput(),

      endurance:
        readyEndurance(),

      operatorSupervised: false,

      sessionState: 'IDLE',

      nowEpochMs: 40000,
    });

    expect(
      result.readyForPrepare,
    ).toBe(false);

    expect(
      result.readiness.operatorMode,
    ).toBe('UNSUPERVISED');

    expect(
      result.readiness.warnings,
    ).toContain(
      'OPERATOR_SUPERVISION_REQUIRED',
    );
  });

  test('preserves risk block from underlying evaluator', () => {
    const runtimeCertification = {
      certify() {
        return {
          status: 'CERTIFIED',
          certified: true,
          score: 100,
          reasons: ['certified'],
        };
      },
    };

    const enduranceResolver = {
      resolve() {
        return {
          status: 'READY',
          baseline: {},
          summary: {},
          report: {
            status: 'READY',
          },
          sourceCount: 1,
          hasEvidence: true,
          paperOnly: true,
          liveMoneyAuthorization: false,
        };
      },
    };

    const riskEvaluator = {
      evaluate() {
        return {
          profile: {},
          decision: {
            verdict: 'RISK_BLOCK',
            reason: 'Bankroll protection blocked.',
          },
          currentBalance: 150,
          currentSessionPnl: 0,
          requestedStake: 1.50,
          martingaleStep: 0,
          paperOnly: true,
          liveMoneyAuthorization: false,
          automaticExecutionAllowed: false,
          humanSupervisionRequired: true,
        };
      },
    };

    const composer =
      new PaperRuntimeReadinessComposer(
        runtimeCertification,
        enduranceResolver,
        riskEvaluator,
      );

    const result = composer.compose({
      configuration: configuration(),

      runtimeCertification:
        runtimeCertificationInput(),

      endurance:
        readyEndurance(),

      operatorSupervised: true,

      sessionState: 'IDLE',

      nowEpochMs: 50000,
    });

    expect(
      result.risk.decision.verdict,
    ).toBe('RISK_BLOCK');

    expect(
      result.readiness.riskReadiness,
    ).toBe('BLOCKED');

    expect(
      result.readyForPrepare,
    ).toBe(false);

    expect(
      result.readiness.blockers,
    ).toContain(
      'RISK_BLOCKED:Bankroll protection blocked.',
    );
  });
});
