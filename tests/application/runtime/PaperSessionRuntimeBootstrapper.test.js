const {
  PaperSessionRuntimeBootstrapper,
} = require('../../../dist/application/runtime/PaperSessionRuntimeBootstrapper.js');

function configuration() {
  return {
    sessionId: 'paper-001',
    bankroll: 100,
    provider: 'PRAGMATIC',
    minimumChipValue: 0.10,
    status: 'CONFIGURED',
  };
}

function warmup() {
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
  };
}

describe('PaperSessionRuntimeBootstrapper', () => {
  test('connects bootstrap, preflight and supervisor using current paper session contract', async () => {
    const calls = [];

    const bootstrap = {
      execute(input) {
        calls.push(`bootstrap:${input.configuration.sessionId}`);

        return {
          status: 'READY',
          sessionId: input.configuration.sessionId,
          bankroll: input.configuration.bankroll,
          provider: input.configuration.provider,
          minimumChipValue: input.configuration.minimumChipValue,
          synchronizedRounds: input.warmup.synchronizedRounds,
          syncVersion: input.warmup.syncVersion,
          warmupStatus: input.warmup.qualification.status,
          warmupReason: input.warmup.qualification.reason,
          observationAllowed: input.warmup.observationAllowed,
          message: 'ready',
          paperOnly: true,
          liveMoneyAuthorization: false,
          automaticExecutionAllowed: false,
          humanSupervisionRequired: true,
        };
      },
    };

    const preflight = {
      async evaluate(input, generatedAtEpochMs) {
        calls.push(`preflight:${input.sessionId}:${generatedAtEpochMs}`);

        return {
          ok: true,
          value: {
            verdict: 'PAPER_OPERATIONAL_GO',
            generatedAtEpochMs,
            sessionId: input.sessionId,
          },
        };
      },
    };

    const supervisor = {
      supervise(input) {
        calls.push(`supervisor:${input.commandIntent}`);

        return {
          decision: 'SESSION_PREPARED',
          allowed: true,
          nextSessionState: 'READY',
          gate: {
            decision: 'ALLOW_PAPER_OPERATION',
            allowed: true,
            reasons: [],
          },
          messages: [],
        };
      },
    };

    const bootstrapper =
      new PaperSessionRuntimeBootstrapper(
        bootstrap,
        preflight,
        supervisor,
      );

    const result = await bootstrapper.launch({
      bootstrapInput: {
        configuration: configuration(),
        warmup: warmup(),
      },

      preflightInput: {
        sessionId: 'paper-001',
        operatorConfirmedLaunch: true,
        runtimePaperAvailable: true,
        snapshotPathAvailable: true,
        ledgerPathConfigured: true,
      },

      supervisorInput: {
        commandIntent: 'PREPARE',
        enduranceStatus: 'CERTIFIED',
        riskReadiness: 'READY',
        sessionState: 'IDLE',
        operatorMode: 'SUPERVISED',
      },

      generatedAtEpochMs: 123456,
    });

    expect(calls).toEqual([
      'bootstrap:paper-001',
      'preflight:paper-001:123456',
      'supervisor:PREPARE',
    ]);

    expect(result.bootstrap.status).toBe('READY');

    expect(result.preflight.ok).toBe(true);
    expect(result.preflight.value.verdict).toBe(
      'PAPER_OPERATIONAL_GO',
    );

    expect(result.supervisor.decision).toBe(
      'SESSION_PREPARED',
    );

    expect(result.paperOnly).toBe(true);
    expect(result.liveMoneyAuthorization).toBe(false);
    expect(result.automaticExecutionAllowed).toBe(false);
    expect(result.humanSupervisionRequired).toBe(true);
  });

  test('preserves blocked bootstrap without rewriting its decision', async () => {
    const bootstrapper =
      new PaperSessionRuntimeBootstrapper(
        {
          execute() {
            return {
              status: 'BLOCKED',
              sessionId: 'paper-blocked',
              bankroll: 100,
              provider: 'PRAGMATIC',
              minimumChipValue: 0.10,
              synchronizedRounds: 200,
              syncVersion: 1,
              warmupStatus: 'BLOCKED',
              warmupReason: 'WARMUP_TABLE_NO_GO',
              observationAllowed: false,
              message: 'blocked',
              paperOnly: true,
              liveMoneyAuthorization: false,
              automaticExecutionAllowed: false,
              humanSupervisionRequired: true,
            };
          },
        },

        {
          async evaluate() {
            return {
              ok: true,
              value: {
                verdict: 'PAPER_OPERATIONAL_BLOCKED',
              },
            };
          },
        },

        {
          supervise() {
            return {
              decision: 'COMMAND_BLOCKED',
              allowed: false,
            };
          },
        },
      );

    const result = await bootstrapper.launch({
      bootstrapInput: {
        configuration: configuration(),
        warmup: warmup(),
      },

      preflightInput: {
        sessionId: 'paper-blocked',
        operatorConfirmedLaunch: false,
      },

      supervisorInput: {
        commandIntent: 'PREPARE',
        enduranceStatus: 'CERTIFIED',
        riskReadiness: 'READY',
        sessionState: 'IDLE',
        operatorMode: 'SUPERVISED',
      },

      generatedAtEpochMs: 123456,
    });

    expect(result.bootstrap.status).toBe('BLOCKED');

    expect(result.preflight.value.verdict).toBe(
      'PAPER_OPERATIONAL_BLOCKED',
    );

    expect(result.supervisor.decision).toBe(
      'COMMAND_BLOCKED',
    );
  });
});
