const {
  PaperSessionInstitutionalPreflight,
} = require('../../../dist/application/runtime/PaperSessionInstitutionalPreflight.js');

function setup(overrides = {}) {
  return {
    status: 'QUALIFIED',

    configuration: {
      status: 'CONFIGURED',
      sessionId: 'paper-preflight-001',
      bankroll: 30,
      provider: 'PRAGMATIC',
      minimumChipValue: 0.10,
      operatorId: 'Thiago',
      riskMode: 'MODERATE',
      allowMartingale: false,
    },

    history: {
      status: 'SYNCED',
      rounds: [1, 2, 3],
      roundCount: 3,
      syncVersion: 1,
      synchronizedAtEpochMs: 1000,
    },

    qualification: {
      qualified: true,
      observationAllowed: true,
      synchronizedRounds: 3,
      syncVersion: 1,

      qualification: {
        status: 'QUALIFIED',
        reason: 'WARMUP_TABLE_QUALIFIED',
      },
    },

    ...overrides,
  };
}

function runtimeReadiness(overrides = {}) {
  return {
    runtimeCertification: {
      status: 'CERTIFIED',
      certified: true,
      score: 100,
      reasons: ['certified'],
    },

    endurance: {
      status: 'READY',
    },

    risk: {
      decision: {
        verdict: 'RISK_ALLOW',
        reason: 'risk accepted',
      },
    },

    readiness: {
      runtimePaperAvailable: true,
      riskReadiness: 'READY',
    },

    readyForPrepare: true,

    paperOnly: true,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    humanSupervisionRequired: true,

    ...overrides,
  };
}

describe('PaperSessionInstitutionalPreflight', () => {
  test('forwards explicit operator confirmation and institutional evidence', async () => {
    const calls = [];

    const preflight = {
      async evaluate(input, generatedAtEpochMs) {
        calls.push({
          input,
          generatedAtEpochMs,
        });

        return {
          ok: true,
          value: {
            verdict: 'PAPER_OPERATIONAL_GO',
            sessionId: input.sessionId,
          },
        };
      },
    };

    const service =
      new PaperSessionInstitutionalPreflight(
        preflight,
      );

    const result = await service.execute({
      setup: setup(),

      runtimeReadiness:
        runtimeReadiness(),

      operatorConfirmedLaunch: true,

      snapshotPathAvailable: true,

      ledgerPathConfigured: true,

      generatedAtEpochMs: 123456,

      tableId: 'table-001',

      strategyName: 'RL.SYS PAPER',
    });

    expect(calls).toHaveLength(1);

    expect(
      calls[0].generatedAtEpochMs,
    ).toBe(123456);

    expect(
      calls[0].input.sessionId,
    ).toBe('paper-preflight-001');

    expect(
      calls[0].input.operatorConfirmedLaunch,
    ).toBe(true);

    expect(
      calls[0].input.runtimePaperAvailable,
    ).toBe(true);

    expect(
      calls[0].input.snapshotPathAvailable,
    ).toBe(true);

    expect(
      calls[0].input.ledgerPathConfigured,
    ).toBe(true);

    expect(
      calls[0].input.operatorId,
    ).toBe('Thiago');

    expect(
      calls[0].input.tableId,
    ).toBe('table-001');

    expect(
      calls[0].input.strategyName,
    ).toBe('RL.SYS PAPER');

    expect(
      calls[0].input.bankrollLabel,
    ).toBe('R$ 30,00');

    expect(
      calls[0].input.plannedRounds,
    ).toBe(3);

    expect(
      calls[0].input.notes,
    ).toContain(
      'runtimeCertification=CERTIFIED',
    );

    expect(
      calls[0].input.notes,
    ).toContain(
      'endurance=READY',
    );

    expect(
      calls[0].input.notes,
    ).toContain(
      'riskVerdict=RISK_ALLOW',
    );

    expect(result.paperOnly).toBe(true);
    expect(result.liveMoneyAuthorization).toBe(false);
    expect(result.automaticExecutionAllowed).toBe(false);
    expect(result.humanSupervisionRequired).toBe(true);
  });

  test('does not manufacture operator confirmation', async () => {
    let received = null;

    const service =
      new PaperSessionInstitutionalPreflight({
        async evaluate(input) {
          received = input;

          return {
            ok: true,
            value: {
              verdict: 'PAPER_OPERATIONAL_BLOCKED',
            },
          };
        },
      });

    await service.execute({
      setup: setup(),

      runtimeReadiness:
        runtimeReadiness(),

      operatorConfirmedLaunch: false,

      snapshotPathAvailable: true,

      ledgerPathConfigured: true,
    });

    expect(
      received.operatorConfirmedLaunch,
    ).toBe(false);
  });

  test('preserves unavailable snapshot for downstream review decision', async () => {
    let received = null;

    const service =
      new PaperSessionInstitutionalPreflight({
        async evaluate(input) {
          received = input;

          return {
            ok: true,
            value: {
              verdict: 'PAPER_OPERATIONAL_REVIEW',
            },
          };
        },
      });

    await service.execute({
      setup: setup(),

      runtimeReadiness:
        runtimeReadiness(),

      operatorConfirmedLaunch: true,

      snapshotPathAvailable: false,

      ledgerPathConfigured: true,
    });

    expect(
      received.snapshotPathAvailable,
    ).toBe(false);
  });

  test('preserves unavailable ledger for downstream blocking decision', async () => {
    let received = null;

    const service =
      new PaperSessionInstitutionalPreflight({
        async evaluate(input) {
          received = input;

          return {
            ok: true,
            value: {
              verdict: 'PAPER_OPERATIONAL_BLOCKED',
            },
          };
        },
      });

    await service.execute({
      setup: setup(),

      runtimeReadiness:
        runtimeReadiness(),

      operatorConfirmedLaunch: true,

      snapshotPathAvailable: true,

      ledgerPathConfigured: false,
    });

    expect(
      received.ledgerPathConfigured,
    ).toBe(false);
  });

  test('does not call preflight when runtime readiness is not eligible', async () => {
    let called = false;

    const service =
      new PaperSessionInstitutionalPreflight({
        async evaluate() {
          called = true;

          return {
            ok: true,
            value: {},
          };
        },
      });

    await expect(
      service.execute({
        setup: setup(),

        runtimeReadiness:
          runtimeReadiness({
            readyForPrepare: false,
          }),

        operatorConfirmedLaunch: true,

        snapshotPathAvailable: true,

        ledgerPathConfigured: true,
      }),
    ).rejects.toThrow(
      'paper_session_preflight_runtime_not_ready',
    );

    expect(called).toBe(false);
  });

  test('does not call preflight when warmup is not qualified', async () => {
    let called = false;

    const service =
      new PaperSessionInstitutionalPreflight({
        async evaluate() {
          called = true;

          return {
            ok: true,
            value: {},
          };
        },
      });

    const invalidSetup =
      setup({
        qualification: {
          qualified: false,
        },
      });

    await expect(
      service.execute({
        setup:
          invalidSetup,

        runtimeReadiness:
          runtimeReadiness(),

        operatorConfirmedLaunch:
          true,

        snapshotPathAvailable:
          true,

        ledgerPathConfigured:
          true,
      }),
    ).rejects.toThrow(
      'paper_session_preflight_warmup_not_qualified',
    );

    expect(called).toBe(false);
  });
});
