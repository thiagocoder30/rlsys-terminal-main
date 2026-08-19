const {
  PaperSessionLaunchComposer,
} = require('../../../dist/application/runtime/PaperSessionLaunchComposer.js');

describe('PaperSessionLaunchComposer', () => {
  test('composes paper launch flow with institutional restrictions', async () => {
    const calls = [];

    const bootstrap = {
      execute(input) {
        calls.push(`bootstrap:${input.id}`);
        return {
          status: 'READY',
        };
      },
    };

    const preflight = {
      async evaluate(input) {
        calls.push(`preflight:${input.id}`);
        return {
          decision: 'PAPER_OPERATIONAL_GO',
        };
      },
    };

    const supervisor = {
      supervise(input) {
        calls.push(`supervisor:${input.id}`);
        return {
          state: 'READY',
        };
      },
    };

    const composer = new PaperSessionLaunchComposer(
      bootstrap,
      preflight,
      supervisor,
    );

    const result = await composer.compose({
      bootstrapInput: {
        id: 'session-001',
      },
      preflightInput: {
        id: 'session-001',
      },
      supervisorInput: {
        id: 'session-001',
      },
      generatedAtEpochMs: 123456,
    });

    expect(calls).toEqual([
      'bootstrap:session-001',
      'preflight:session-001',
      'supervisor:session-001',
    ]);

    expect(result.paperOnly).toBe(true);
    expect(result.liveMoneyAuthorization).toBe(false);
    expect(result.automaticExecutionAllowed).toBe(false);
    expect(result.humanSupervisionRequired).toBe(true);
  });

  test('preserves blocked results without applying decisions', async () => {
    const composer = new PaperSessionLaunchComposer(
      {
        execute() {
          return {
            status: 'BLOCKED',
          };
        },
      },
      {
        async evaluate() {
          return {
            decision: 'PAPER_OPERATIONAL_BLOCKED',
          };
        },
      },
      {
        supervise() {
          return {
            state: 'BLOCKED',
          };
        },
      },
    );

    const result = await composer.compose({
      bootstrapInput: {},
      preflightInput: {},
      supervisorInput: {},
      generatedAtEpochMs: 123456,
    });

    expect(result.bootstrap.status).toBe('BLOCKED');
    expect(result.preflight.decision).toBe(
      'PAPER_OPERATIONAL_BLOCKED',
    );
    expect(result.supervisor.state).toBe('BLOCKED');
  });
});
