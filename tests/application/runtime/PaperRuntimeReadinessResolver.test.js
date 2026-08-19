const {
  PaperRuntimeReadinessResolver,
} = require('../../../dist/application/runtime/PaperRuntimeReadinessResolver.js');

function runtimeCertification(overrides = {}) {
  return {
    status: 'CERTIFIED',
    certified: true,
    score: 100,
    reasons: [
      'Paper Runtime v1.0 defensive shell is certified.',
    ],
    ...overrides,
  };
}

describe('PaperRuntimeReadinessResolver', () => {
  test('releases prepare readiness when runtime, endurance, risk and supervision are acceptable', () => {
    const resolver =
      new PaperRuntimeReadinessResolver();

    const result = resolver.resolve({
      runtimeCertification:
        runtimeCertification(),

      endurance: {
        status: 'READY',
      },

      riskDecision: {
        verdict: 'RISK_ALLOW',
        reason: 'Operação compatível com o perfil de risco.',
      },

      operatorSupervised: true,

      sessionState: 'IDLE',
    });

    expect(
      result.runtimePaperAvailable,
    ).toBe(true);

    expect(
      result.enduranceStatus,
    ).toBe('CERTIFIED');

    expect(
      result.riskReadiness,
    ).toBe('READY');

    expect(
      result.operatorMode,
    ).toBe('SUPERVISED');

    expect(
      result.readyForPrepare,
    ).toBe(true);

    expect(
      result.blockers,
    ).toEqual([]);

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


  test('maps endurance warning and risk review to caution without blocking preparation', () => {
    const resolver =
      new PaperRuntimeReadinessResolver();

    const result = resolver.resolve({
      runtimeCertification:
        runtimeCertification(),

      endurance: {
        status: 'WARNING',
      },

      riskDecision: {
        verdict: 'RISK_REVIEW',
        reason: 'Stake requer revisão.',
      },

      operatorSupervised: true,

      sessionState: 'IDLE',
    });

    expect(
      result.enduranceStatus,
    ).toBe('WARNING');

    expect(
      result.riskReadiness,
    ).toBe('CAUTION');

    expect(
      result.readyForPrepare,
    ).toBe(true);

    expect(
      result.blockers,
    ).toEqual([]);

    expect(
      result.warnings,
    ).toEqual([
      'ENDURANCE_WARNING',
      'RISK_CAUTION:Stake requer revisão.',
    ]);
  });


  test('blocks readiness when runtime certification failed', () => {
    const resolver =
      new PaperRuntimeReadinessResolver();

    const result = resolver.resolve({
      runtimeCertification:
        runtimeCertification({
          status: 'FAILED',
          certified: false,
          score: 80,
        }),

      endurance: {
        status: 'READY',
      },

      riskDecision: {
        verdict: 'RISK_ALLOW',
        reason: 'Sem bloqueio.',
      },

      operatorSupervised: true,

      sessionState: 'IDLE',
    });

    expect(
      result.runtimePaperAvailable,
    ).toBe(false);

    expect(
      result.readyForPrepare,
    ).toBe(false);

    expect(
      result.blockers,
    ).toContain(
      'PAPER_RUNTIME_NOT_CERTIFIED',
    );
  });


  test('blocks readiness when endurance has no evidence', () => {
    const resolver =
      new PaperRuntimeReadinessResolver();

    const result = resolver.resolve({
      runtimeCertification:
        runtimeCertification(),

      endurance: {
        status: 'NO_DATA',
      },

      riskDecision: {
        verdict: 'RISK_ALLOW',
        reason: 'Sem bloqueio.',
      },

      operatorSupervised: true,

      sessionState: 'IDLE',
    });

    expect(
      result.enduranceStatus,
    ).toBe('NO_DATA');

    expect(
      result.readyForPrepare,
    ).toBe(false);

    expect(
      result.blockers,
    ).toContain(
      'ENDURANCE_NO_DATA',
    );
  });


  test('blocks readiness when endurance failed', () => {
    const resolver =
      new PaperRuntimeReadinessResolver();

    const result = resolver.resolve({
      runtimeCertification:
        runtimeCertification(),

      endurance: {
        status: 'FAILED',
      },

      riskDecision: {
        verdict: 'RISK_ALLOW',
        reason: 'Sem bloqueio.',
      },

      operatorSupervised: true,

      sessionState: 'IDLE',
    });

    expect(
      result.readyForPrepare,
    ).toBe(false);

    expect(
      result.blockers,
    ).toContain(
      'ENDURANCE_FAILED',
    );
  });


  test('blocks readiness when risk gateway blocks operation', () => {
    const resolver =
      new PaperRuntimeReadinessResolver();

    const result = resolver.resolve({
      runtimeCertification:
        runtimeCertification(),

      endurance: {
        status: 'READY',
      },

      riskDecision: {
        verdict: 'RISK_BLOCK',
        reason: 'Limite de banca excedido.',
      },

      operatorSupervised: true,

      sessionState: 'IDLE',
    });

    expect(
      result.riskReadiness,
    ).toBe('BLOCKED');

    expect(
      result.readyForPrepare,
    ).toBe(false);

    expect(
      result.blockers,
    ).toContain(
      'RISK_BLOCKED:Limite de banca excedido.',
    );
  });


  test('requires active human supervision before preparation', () => {
    const resolver =
      new PaperRuntimeReadinessResolver();

    const result = resolver.resolve({
      runtimeCertification:
        runtimeCertification(),

      endurance: {
        status: 'READY',
      },

      riskDecision: {
        verdict: 'RISK_ALLOW',
        reason: 'Sem bloqueio.',
      },

      operatorSupervised: false,

      sessionState: 'IDLE',
    });

    expect(
      result.operatorMode,
    ).toBe('UNSUPERVISED');

    expect(
      result.readyForPrepare,
    ).toBe(false);

    expect(
      result.warnings,
    ).toContain(
      'OPERATOR_SUPERVISION_REQUIRED',
    );
  });


  test('blocks finished session from new preparation', () => {
    const resolver =
      new PaperRuntimeReadinessResolver();

    const result = resolver.resolve({
      runtimeCertification:
        runtimeCertification(),

      endurance: {
        status: 'READY',
      },

      riskDecision: {
        verdict: 'RISK_ALLOW',
        reason: 'Sem bloqueio.',
      },

      operatorSupervised: true,

      sessionState: 'FINISHED',
    });

    expect(
      result.readyForPrepare,
    ).toBe(false);

    expect(
      result.blockers,
    ).toContain(
      'SESSION_ALREADY_FINISHED',
    );
  });
});
