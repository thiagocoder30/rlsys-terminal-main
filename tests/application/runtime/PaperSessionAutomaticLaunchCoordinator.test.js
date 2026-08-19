const {
  PaperSessionAutomaticLaunchCoordinator,
} = require('../../../dist/application/runtime/PaperSessionAutomaticLaunchCoordinator.js');


function setup() {
  return {
    status: 'QUALIFIED',

    configuration: {
      status: 'CONFIGURED',
      sessionId: 'paper-auto-001',
      bankroll: 30,
      provider: 'PRAGMATIC',
      minimumChipValue: 0.10,
      riskMode: 'MODERATE',
      allowMartingale: false,
    },

    history: {
      status: 'SYNCED',
      rounds: [1, 2, 3],
      roundCount: 3,
      syncVersion: 1,
    },

    qualification: {
      qualified: true,
      qualification: {
        status: 'QUALIFIED',
      },
    },
  };
}


function readiness(
  overrides = {},
) {
  return {
    readyForPrepare: true,

    readiness: {
      enduranceStatus:
        'CERTIFIED',

      riskReadiness:
        'READY',

      operatorMode:
        'SUPERVISED',

      sessionState:
        'IDLE',

      ...overrides,
    },

    ...overrides,
  };
}


function successfulPreflight() {
  return {
    async execute() {
      return {
        result: {
          ok: true,

          value: {
            verdict:
              'PAPER_OPERATIONAL_GO',

            recommendation:
              'Proceed.',
          },
        },

        paperOnly: true,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        humanSupervisionRequired: true,
      };
    },
  };
}


describe(
  'PaperSessionAutomaticLaunchCoordinator',
  () => {
    test(
      'waits for explicit human confirmation',
      async () => {
        let preflightCalled =
          false;

        let supervisorCalled =
          false;

        const coordinator =
          new PaperSessionAutomaticLaunchCoordinator(
            {
              async execute() {
                preflightCalled =
                  true;

                throw new Error(
                  'should_not_run',
                );
              },
            },

            {
              supervise() {
                supervisorCalled =
                  true;

                throw new Error(
                  'should_not_run',
                );
              },
            },
          );

        const result =
          await coordinator.execute({
            setup:
              setup(),

            runtimeReadiness:
              readiness(),

            operatorConfirmedLaunch:
              false,

            snapshotPathAvailable:
              true,

            ledgerPathConfigured:
              true,
          });

        expect(
          result.status,
        ).toBe(
          'AWAITING_CONFIRMATION',
        );

        expect(
          result.sessionState,
        ).toBe('IDLE');

        expect(
          preflightCalled,
        ).toBe(false);

        expect(
          supervisorCalled,
        ).toBe(false);
      },
    );


    test(
      'runs PREPARE and START using real readiness context',
      async () => {
        const supervisorInputs =
          [];

        const coordinator =
          new PaperSessionAutomaticLaunchCoordinator(
            successfulPreflight(),

            {
              supervise(input) {
                supervisorInputs.push(
                  input,
                );

                if (
                  input.commandIntent ===
                  'PREPARE'
                ) {
                  return {
                    decision:
                      'SESSION_PREPARED',

                    allowed: true,

                    nextSessionState:
                      'READY',

                    gate: {
                      decision:
                        'ALLOW_PAPER_OPERATION',

                      allowed: true,

                      reasons: [],
                    },

                    messages: [
                      'prepared',
                    ],
                  };
                }

                return {
                  decision:
                    'SESSION_STARTED',

                  allowed: true,

                  nextSessionState:
                    'RUNNING',

                  gate: {
                    decision:
                      'ALLOW_PAPER_OPERATION',

                    allowed: true,

                    reasons: [],
                  },

                  messages: [
                    'started',
                  ],
                };
              },
            },
          );

        const result =
          await coordinator.execute({
            setup:
              setup(),

            runtimeReadiness:
              readiness(),

            operatorConfirmedLaunch:
              true,

            snapshotPathAvailable:
              true,

            ledgerPathConfigured:
              true,

            generatedAtEpochMs:
              123456,
          });

        expect(
          result.status,
        ).toBe('RUNNING');

        expect(
          result.sessionState,
        ).toBe('RUNNING');

        expect(
          supervisorInputs,
        ).toEqual([
          {
            commandIntent:
              'PREPARE',

            enduranceStatus:
              'CERTIFIED',

            riskReadiness:
              'READY',

            operatorMode:
              'SUPERVISED',

            sessionState:
              'IDLE',
          },

          {
            commandIntent:
              'START',

            enduranceStatus:
              'CERTIFIED',

            riskReadiness:
              'READY',

            operatorMode:
              'SUPERVISED',

            sessionState:
              'READY',
          },
        ]);
      },
    );


    test(
      'does not start when prepare is blocked',
      async () => {
        let calls = 0;

        const coordinator =
          new PaperSessionAutomaticLaunchCoordinator(
            successfulPreflight(),

            {
              supervise() {
                calls += 1;

                return {
                  decision:
                    'COMMAND_BLOCKED',

                  allowed:
                    false,

                  nextSessionState:
                    'IDLE',

                  gate: {
                    decision:
                      'BLOCK_PAPER_OPERATION',

                    allowed:
                      false,

                    reasons: [
                      'blocked',
                    ],
                  },

                  messages: [
                    'prepare blocked',
                  ],
                };
              },
            },
          );

        const result =
          await coordinator.execute({
            setup:
              setup(),

            runtimeReadiness:
              readiness(),

            operatorConfirmedLaunch:
              true,

            snapshotPathAvailable:
              true,

            ledgerPathConfigured:
              true,
          });

        expect(
          result.status,
        ).toBe(
          'PREPARE_BLOCKED',
        );

        expect(calls).toBe(1);
      },
    );


    test(
      'preserves START block after successful PREPARE',
      async () => {
        let calls = 0;

        const coordinator =
          new PaperSessionAutomaticLaunchCoordinator(
            successfulPreflight(),

            {
              supervise(input) {
                calls += 1;

                if (
                  input.commandIntent ===
                  'PREPARE'
                ) {
                  return {
                    decision:
                      'SESSION_PREPARED',

                    allowed:
                      true,

                    nextSessionState:
                      'READY',

                    gate: {
                      decision:
                        'ALLOW_PAPER_OPERATION',

                      allowed:
                        true,

                      reasons: [],
                    },

                    messages: [
                      'prepared',
                    ],
                  };
                }

                return {
                  decision:
                    'COMMAND_BLOCKED',

                  allowed:
                    false,

                  nextSessionState:
                    'READY',

                  gate: {
                    decision:
                      'BLOCK_PAPER_OPERATION',

                    allowed:
                      false,

                    reasons: [
                      'risk blocked',
                    ],
                  },

                  messages: [
                    'start blocked',
                  ],
                };
              },
            },
          );

        const result =
          await coordinator.execute({
            setup:
              setup(),

            runtimeReadiness:
              readiness(),

            operatorConfirmedLaunch:
              true,

            snapshotPathAvailable:
              true,

            ledgerPathConfigured:
              true,
          });

        expect(
          result.status,
        ).toBe(
          'START_BLOCKED',
        );

        expect(
          result.sessionState,
        ).toBe('READY');

        expect(calls).toBe(2);
      },
    );


    test(
      'does not prepare or start when preflight blocks',
      async () => {
        let supervisorCalled =
          false;

        const coordinator =
          new PaperSessionAutomaticLaunchCoordinator(
            {
              async execute() {
                return {
                  result: {
                    ok: true,

                    value: {
                      verdict:
                        'PAPER_OPERATIONAL_BLOCKED',

                      recommendation:
                        'Blocked.',
                    },
                  },

                  paperOnly: true,
                  liveMoneyAuthorization: false,
                  automaticExecutionAllowed: false,
                  humanSupervisionRequired: true,
                };
              },
            },

            {
              supervise() {
                supervisorCalled =
                  true;

                return {};
              },
            },
          );

        const result =
          await coordinator.execute({
            setup:
              setup(),

            runtimeReadiness:
              readiness(),

            operatorConfirmedLaunch:
              true,

            snapshotPathAvailable:
              true,

            ledgerPathConfigured:
              true,
          });

        expect(
          result.status,
        ).toBe(
          'PREFLIGHT_BLOCKED',
        );

        expect(
          supervisorCalled,
        ).toBe(false);
      },
    );


    test(
      'rejects launch before runtime readiness',
      async () => {
        const coordinator =
          new PaperSessionAutomaticLaunchCoordinator(
            {},
            {},
          );

        await expect(
          coordinator.execute({
            setup:
              setup(),

            runtimeReadiness:
              readiness({
                readyForPrepare:
                  false,
              }),

            operatorConfirmedLaunch:
              true,

            snapshotPathAvailable:
              true,

            ledgerPathConfigured:
              true,
          }),
        ).rejects.toThrow(
          'paper_session_auto_launch_runtime_not_ready',
        );
      },
    );
  },
);
