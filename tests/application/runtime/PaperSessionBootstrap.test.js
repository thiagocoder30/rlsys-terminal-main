const {
  PaperSessionBootstrap,
} = require('../../../dist/application/runtime/PaperSessionBootstrap.js');

function configuration(overrides = {}) {
  return {
    sessionId: 'paper-001',
    bankroll: 100,
    provider: 'PRAGMATIC',
    minimumChipValue: 0.10,
    status: 'CONFIGURED',
    ...overrides,
  };
}

function warmup(overrides = {}) {
  return {
    qualified: true,
    observationAllowed: true,
    synchronizedRounds: 200,
    syncVersion: 1,
    qualification: {
      status: 'QUALIFIED',
      reason: 'WARMUP_TABLE_QUALIFIED',
      decision: {
        tableQualified: true,
        supervisedObservationAllowed: true,
        supervisedOperationAllowed: true,
        liveMoneyAllowed: false,
        productionMoneyAllowed: false,
        requiresHumanReview: true,
      },
    },
    paperOnly: true,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    humanSupervisionRequired: true,
    ...overrides,
  };
}

describe('PaperSessionBootstrap', () => {
  test('releases supervised paper session when warmup is qualified', () => {
    const bootstrap = new PaperSessionBootstrap();

    const result = bootstrap.execute({
      configuration: configuration(),
      warmup: warmup(),
    });

    expect(result.status).toBe('READY');
    expect(result.sessionId).toBe('paper-001');
    expect(result.bankroll).toBe(100);
    expect(result.provider).toBe('PRAGMATIC');
    expect(result.minimumChipValue).toBe(0.10);
    expect(result.synchronizedRounds).toBe(200);
    expect(result.syncVersion).toBe(1);
    expect(result.warmupStatus).toBe('QUALIFIED');
    expect(result.paperOnly).toBe(true);
    expect(result.liveMoneyAuthorization).toBe(false);
    expect(result.automaticExecutionAllowed).toBe(false);
    expect(result.humanSupervisionRequired).toBe(true);
  });

  test('blocks paper session when warmup requires observation', () => {
    const bootstrap = new PaperSessionBootstrap();

    const result = bootstrap.execute({
      configuration: configuration(),
      warmup: warmup({
        qualified: false,
        observationAllowed: true,
        qualification: {
          status: 'OBSERVE',
          reason: 'WARMUP_TABLE_OBSERVE',
          decision: {
            tableQualified: false,
            supervisedObservationAllowed: true,
            supervisedOperationAllowed: false,
            liveMoneyAllowed: false,
            productionMoneyAllowed: false,
            requiresHumanReview: true,
          },
        },
      }),
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.observationAllowed).toBe(true);
    expect(result.warmupStatus).toBe('OBSERVE');
    expect(result.message).toContain('novo Sync');
  });

  test('blocks paper session when institutional warmup rejects table', () => {
    const bootstrap = new PaperSessionBootstrap();

    const result = bootstrap.execute({
      configuration: configuration(),
      warmup: warmup({
        qualified: false,
        observationAllowed: false,
        qualification: {
          status: 'BLOCKED',
          reason: 'WARMUP_TABLE_NO_GO',
          decision: {
            tableQualified: false,
            supervisedObservationAllowed: false,
            supervisedOperationAllowed: false,
            liveMoneyAllowed: false,
            productionMoneyAllowed: false,
            requiresHumanReview: true,
          },
        },
      }),
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.warmupReason).toBe('WARMUP_TABLE_NO_GO');
    expect(result.message).toContain(
      'Mesa bloqueada pela qualificação institucional',
    );
  });

  test('rejects pending operator configuration', () => {
    const bootstrap = new PaperSessionBootstrap();

    expect(() =>
      bootstrap.execute({
        configuration: configuration({
          status: 'PENDING',
        }),
        warmup: warmup(),
      }),
    ).toThrow(
      'paper_session_bootstrap_configuration_not_ready',
    );
  });

  test('rejects missing synchronized history', () => {
    const bootstrap = new PaperSessionBootstrap();

    expect(() =>
      bootstrap.execute({
        configuration: configuration(),
        warmup: warmup({
          synchronizedRounds: 0,
        }),
      }),
    ).toThrow(
      'paper_session_bootstrap_history_not_synchronized',
    );
  });

  test('rejects invalid sync version', () => {
    const bootstrap = new PaperSessionBootstrap();

    expect(() =>
      bootstrap.execute({
        configuration: configuration(),
        warmup: warmup({
          syncVersion: 0,
        }),
      }),
    ).toThrow(
      'paper_session_bootstrap_invalid_sync_version',
    );
  });

  test('rejects violation of paper safety invariants', () => {
    const bootstrap = new PaperSessionBootstrap();

    expect(() =>
      bootstrap.execute({
        configuration: configuration(),
        warmup: warmup({
          liveMoneyAuthorization: true,
        }),
      }),
    ).toThrow(
      'paper_session_bootstrap_safety_invariant_violation',
    );
  });
});
