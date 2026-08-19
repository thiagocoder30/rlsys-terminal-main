const {
  PaperSessionSetupCoordinator,
} = require('../../../dist/application/runtime/PaperSessionSetupCoordinator.js');

function configurationInput(overrides = {}) {
  return {
    sessionId: 'paper-001',
    bankroll: 100,
    provider: 'PRAGMATIC',
    riskMode: 'CONSERVATIVE',
    allowMartingale: false,
    ...overrides,
  };
}

function qualificationReport({
  status,
  supervisedObservationAllowed,
  supervisedOperationAllowed,
}) {
  return {
    qualified:
      status === 'QUALIFIED' &&
      supervisedOperationAllowed,

    observationAllowed:
      supervisedObservationAllowed,

    synchronizedRounds: 3,
    syncVersion: 1,

    qualification: {
      service: 'WarmupQualificationRuntimePipeline',
      schemaVersion: '1.0.0',
      generatedAt: '2026-08-14T00:00:00.000Z',
      source: 'manual',
      status,

      reason:
        status === 'QUALIFIED'
          ? 'WARMUP_TABLE_QUALIFIED'
          : status === 'OBSERVE'
            ? 'WARMUP_TABLE_OBSERVE'
            : 'WARMUP_TABLE_NO_GO',

      operationalGate: 'BLOCKED',

      extraction: {
        values: [1, 2, 3],
        accepted: 3,
        rejected: 0,
        declaredTotal: 3,
        confidence: 1,
        warnings: [],
        reliability: {},
      },

      confidenceScore: 1,

      decision: {
        tableQualified:
          status === 'QUALIFIED',

        supervisedObservationAllowed,
        supervisedOperationAllowed,

        liveMoneyAllowed: false,
        productionMoneyAllowed: false,
        requiresHumanReview: true,
      },

      humanExplanation: [],
    },

    paperOnly: true,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    humanSupervisionRequired: true,
  };
}

describe('PaperSessionSetupCoordinator', () => {
  test('starts pending configuration', () => {
    const coordinator =
      new PaperSessionSetupCoordinator();

    const snapshot =
      coordinator.snapshot();

    expect(snapshot.status).toBe(
      'PENDING_CONFIGURATION',
    );

    expect(
      snapshot.configuration,
    ).toBeNull();

    expect(
      snapshot.history.status,
    ).toBe('UNSYNCED');

    expect(
      snapshot.qualification,
    ).toBeNull();
  });

  test('configures operator session with explicit risk policy', () => {
    const coordinator =
      new PaperSessionSetupCoordinator();

    const result =
      coordinator.configure(
        configurationInput({
          operatorId: 'Thiago',
        }),
      );

    expect(result.status).toBe(
      'CONFIGURED',
    );

    expect(
      result.minimumChipValue,
    ).toBe(0.10);

    expect(
      result.riskMode,
    ).toBe('CONSERVATIVE');

    expect(
      result.allowMartingale,
    ).toBe(false);

    expect(
      coordinator.snapshot().status,
    ).toBe('CONFIGURED');
  });

  test('parses and synchronizes pasted history', () => {
    const coordinator =
      new PaperSessionSetupCoordinator();

    coordinator.configure(
      configurationInput(),
    );

    const result =
      coordinator.sync(
        '32, 15 0;19 | 22\n7',
        1000,
      );

    expect(
      result.parsed.accepted,
    ).toBe(true);

    expect(
      result.parsed.rounds,
    ).toEqual([
      32,
      15,
      0,
      19,
      22,
      7,
    ]);

    expect(
      result.history.status,
    ).toBe('SYNCED');

    expect(
      result.history.syncVersion,
    ).toBe(1);

    expect(
      coordinator.snapshot().status,
    ).toBe('SYNCHRONIZED');
  });

  test('rejects sync before configuration', () => {
    const coordinator =
      new PaperSessionSetupCoordinator();

    expect(() =>
      coordinator.sync('1 2 3'),
    ).toThrow(
      'paper_session_setup_not_configured',
    );
  });

  test('returns parser failure without mutating sync state', () => {
    const coordinator =
      new PaperSessionSetupCoordinator();

    coordinator.configure(
      configurationInput(),
    );

    const result =
      coordinator.sync(
        '1 2 giro 3',
      );

    expect(
      result.parsed.accepted,
    ).toBe(false);

    expect(
      coordinator
        .snapshot()
        .history
        .status,
    ).toBe('UNSYNCED');
  });

  test('qualifies synchronized session and exposes risk policy in bootstrap configuration', () => {
    const warmupQualification = {
      qualify() {
        return qualificationReport({
          status: 'QUALIFIED',
          supervisedObservationAllowed: true,
          supervisedOperationAllowed: true,
        });
      },
    };

    const coordinator =
      new PaperSessionSetupCoordinator(
        undefined,
        undefined,
        undefined,
        warmupQualification,
      );

    coordinator.configure(
      configurationInput({
        riskMode: 'MODERATE',
        allowMartingale: true,
      }),
    );

    coordinator.sync(
      '1 2 3',
    );

    const result =
      coordinator.qualify(100);

    expect(
      result.qualification.qualified,
    ).toBe(true);

    expect(
      result.bootstrapInput
        .configuration
        .riskMode,
    ).toBe('MODERATE');

    expect(
      result.bootstrapInput
        .configuration
        .allowMartingale,
    ).toBe(true);

    expect(
      coordinator.snapshot().status,
    ).toBe('QUALIFIED');
  });

  test('maps observation qualification to OBSERVE setup state', () => {
    const coordinator =
      new PaperSessionSetupCoordinator(
        undefined,
        undefined,
        undefined,
        {
          qualify() {
            return qualificationReport({
              status: 'OBSERVE',
              supervisedObservationAllowed: true,
              supervisedOperationAllowed: false,
            });
          },
        },
      );

    coordinator.configure(
      configurationInput({
        sessionId:
          'paper-observe',

        provider:
          'EVOLUTION',
      }),
    );

    coordinator.sync(
      '1 2 3',
    );

    coordinator.qualify(
      100,
    );

    expect(
      coordinator.snapshot().status,
    ).toBe('OBSERVE');
  });

  test('maps rejected qualification to BLOCKED setup state', () => {
    const coordinator =
      new PaperSessionSetupCoordinator(
        undefined,
        undefined,
        undefined,
        {
          qualify() {
            return qualificationReport({
              status: 'BLOCKED',
              supervisedObservationAllowed: false,
              supervisedOperationAllowed: false,
            });
          },
        },
      );

    coordinator.configure(
      configurationInput({
        sessionId:
          'paper-blocked',
      }),
    );

    coordinator.sync(
      '1 2 3',
    );

    coordinator.qualify(
      100,
    );

    expect(
      coordinator.snapshot().status,
    ).toBe('BLOCKED');
  });

  test('resync replaces history and clears previous qualification', () => {
    const coordinator =
      new PaperSessionSetupCoordinator(
        undefined,
        undefined,
        undefined,
        {
          qualify() {
            return qualificationReport({
              status: 'QUALIFIED',
              supervisedObservationAllowed: true,
              supervisedOperationAllowed: true,
            });
          },
        },
      );

    coordinator.configure(
      configurationInput({
        sessionId:
          'paper-resync',
      }),
    );

    coordinator.sync(
      '1 2 3',
      1000,
    );

    coordinator.qualify(
      100,
    );

    expect(
      coordinator.snapshot().status,
    ).toBe('QUALIFIED');

    const resync =
      coordinator.resync(
        '4 5 6 7',
        2000,
      );

    expect(
      resync.history.status,
    ).toBe('RESYNCED');

    /*
     * Operator input is newest-to-oldest.
     *
     * Canonical RL.Sys history is oldest-to-newest,
     * therefore resync must persist the reversed chronology.
     */
    expect(
      resync.history.rounds,
    ).toEqual([
      7,
      6,
      5,
      4,
    ]);

    expect(
      resync.history.syncVersion,
    ).toBe(2);

    const snapshot =
      coordinator.snapshot();

    expect(
      snapshot.status,
    ).toBe('SYNCHRONIZED');

    expect(
      snapshot.qualification,
    ).toBeNull();
  });
});
