const {
  PaperSessionWarmupQualification,
} = require('../../../dist/application/runtime/PaperSessionWarmupQualification.js');

function history(rounds, overrides = {}) {
  return {
    status: 'SYNCED',
    rounds,
    roundCount: rounds.length,
    syncVersion: 1,
    synchronizedAtEpochMs: 1000,
    ...overrides,
  };
}

function qualificationReport({
  status,
  supervisedObservationAllowed,
  supervisedOperationAllowed,
}) {
  return {
    service: 'WarmupQualificationRuntimePipeline',
    schemaVersion: '1.0.0',
    generatedAt: '2026-08-13T00:00:00.000Z',
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
      values: [],
      accepted: 0,
      rejected: 0,
      declaredTotal: 0,
      confidence: 1,
      warnings: [],
      reliability: {},
    },
    confidenceScore: 1,
    decision: {
      tableQualified: status === 'QUALIFIED',
      supervisedObservationAllowed,
      supervisedOperationAllowed,
      liveMoneyAllowed: false,
      productionMoneyAllowed: false,
      requiresHumanReview: true,
    },
    humanExplanation: [],
  };
}

describe('PaperSessionWarmupQualification', () => {
  test('forwards synchronized history to manual warmup pipeline', () => {
    const calls = [];

    const pipeline = {
      qualify(input) {
        calls.push(input);

        return qualificationReport({
          status: 'QUALIFIED',
          supervisedObservationAllowed: true,
          supervisedOperationAllowed: true,
        });
      },
    };

    const service = new PaperSessionWarmupQualification(pipeline);

    const result = service.qualify({
      history: history([32, 15, 0, 19]),
      requiredWarmupSize: 100,
    });

    expect(calls).toEqual([
      {
        source: 'manual',
        values: [32, 15, 0, 19],
        requiredWarmupSize: 100,
      },
    ]);

    expect(result.qualified).toBe(true);
    expect(result.observationAllowed).toBe(true);
    expect(result.synchronizedRounds).toBe(4);
    expect(result.syncVersion).toBe(1);
  });

  test('preserves OBSERVE without releasing paper operation', () => {
    const service = new PaperSessionWarmupQualification({
      qualify() {
        return qualificationReport({
          status: 'OBSERVE',
          supervisedObservationAllowed: true,
          supervisedOperationAllowed: false,
        });
      },
    });

    const result = service.qualify({
      history: history([1, 2, 3]),
    });

    expect(result.qualified).toBe(false);
    expect(result.observationAllowed).toBe(true);
    expect(result.qualification.status).toBe('OBSERVE');
  });

  test('preserves BLOCKED result', () => {
    const service = new PaperSessionWarmupQualification({
      qualify() {
        return qualificationReport({
          status: 'BLOCKED',
          supervisedObservationAllowed: false,
          supervisedOperationAllowed: false,
        });
      },
    });

    const result = service.qualify({
      history: history([1, 2, 3]),
    });

    expect(result.qualified).toBe(false);
    expect(result.observationAllowed).toBe(false);
    expect(result.qualification.status).toBe('BLOCKED');
  });

  test('preserves paper safety invariants', () => {
    const service = new PaperSessionWarmupQualification({
      qualify() {
        return qualificationReport({
          status: 'QUALIFIED',
          supervisedObservationAllowed: true,
          supervisedOperationAllowed: true,
        });
      },
    });

    const result = service.qualify({
      history: history([1, 2, 3]),
    });

    expect(result.paperOnly).toBe(true);
    expect(result.liveMoneyAuthorization).toBe(false);
    expect(result.automaticExecutionAllowed).toBe(false);
    expect(result.humanSupervisionRequired).toBe(true);
  });

  test('rejects unsynchronized history', () => {
    const service = new PaperSessionWarmupQualification({
      qualify() {
        throw new Error('pipeline_should_not_be_called');
      },
    });

    expect(() =>
      service.qualify({
        history: history([], {
          status: 'UNSYNCED',
          roundCount: 0,
          syncVersion: 0,
        }),
      }),
    ).toThrow(
      'paper_session_warmup_history_not_synchronized',
    );
  });

  test('rejects inconsistent round count', () => {
    const service = new PaperSessionWarmupQualification({
      qualify() {
        throw new Error('pipeline_should_not_be_called');
      },
    });

    expect(() =>
      service.qualify({
        history: history([1, 2, 3], {
          roundCount: 2,
        }),
      }),
    ).toThrow(
      'paper_session_warmup_history_count_mismatch',
    );
  });
});
