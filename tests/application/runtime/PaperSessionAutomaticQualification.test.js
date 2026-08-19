const {
  PaperSessionAutomaticQualification,
} = require('../../../dist/application/runtime/PaperSessionAutomaticQualification.js');


function setup({
  syncAccepted = true,
  status = 'QUALIFIED',
} = {}) {
  const calls = [];

  return {
    calls,

    sync(rawHistory, synchronizedAtEpochMs) {
      calls.push([
        'sync',
        rawHistory,
        synchronizedAtEpochMs,
      ]);

      return {
        parsed: {
          accepted: syncAccepted,
          rounds: syncAccepted
            ? [1, 2, 3]
            : [],
          invalidTokens:
            syncAccepted
              ? []
              : ['x'],
        },

        history:
          syncAccepted
            ? {
                status: 'SYNCED',
                rounds: [1, 2, 3],
                roundCount: 3,
                syncVersion: 1,
              }
            : undefined,
      };
    },

    resync(rawHistory, synchronizedAtEpochMs) {
      calls.push([
        'resync',
        rawHistory,
        synchronizedAtEpochMs,
      ]);

      return {
        parsed: {
          accepted: true,
          rounds: [4, 5, 6],
          invalidTokens: [],
        },

        history: {
          status: 'RESYNCED',
          rounds: [4, 5, 6],
          roundCount: 3,
          syncVersion: 2,
        },
      };
    },

    qualify(requiredWarmupSize) {
      calls.push([
        'qualify',
        requiredWarmupSize,
      ]);

      return {
        qualification: {
          qualified:
            status === 'QUALIFIED',

          observationAllowed:
            status !== 'BLOCKED',

          qualification: {
            status:
              status === 'QUALIFIED'
                ? 'QUALIFIED'
                : status === 'OBSERVE'
                  ? 'OBSERVE'
                  : 'BLOCKED',
          },
        },

        bootstrapInput: {},
      };
    },

    snapshot() {
      return {
        status,
        configuration: {},
        history: {},
        qualification:
          status === 'QUALIFIED'
            ? {
                qualified: true,
              }
            : {
                qualified: false,
              },
      };
    },
  };
}


describe(
  'PaperSessionAutomaticQualification',
  () => {
    test(
      'automatically qualifies immediately after sync',
      () => {
        const coordinator =
          setup({
            status:
              'QUALIFIED',
          });

        const service =
          new PaperSessionAutomaticQualification(
            coordinator,
          );

        const result =
          service.syncAndQualify({
            rawHistory:
              '1 2 3',

            requiredWarmupSize:
              200,

            synchronizedAtEpochMs:
              1000,
          });

        expect(
          coordinator.calls,
        ).toEqual([
          [
            'sync',
            '1 2 3',
            1000,
          ],
          [
            'qualify',
            200,
          ],
        ]);

        expect(
          result.decision,
        ).toBe('APPROVED');

        expect(
          result.sessionMayProceed,
        ).toBe(true);
      },
    );


    test(
      'automatically qualifies after resync',
      () => {
        const coordinator =
          setup({
            status:
              'QUALIFIED',
          });

        const service =
          new PaperSessionAutomaticQualification(
            coordinator,
          );

        const result =
          service.resyncAndQualify({
            rawHistory:
              '4 5 6',

            requiredWarmupSize:
              200,

            synchronizedAtEpochMs:
              2000,
          });

        expect(
          coordinator.calls,
        ).toEqual([
          [
            'resync',
            '4 5 6',
            2000,
          ],
          [
            'qualify',
            200,
          ],
        ]);

        expect(
          result.decision,
        ).toBe('APPROVED');
      },
    );


    test(
      'blocks session when table qualification rejects',
      () => {
        const coordinator =
          setup({
            status:
              'BLOCKED',
          });

        const service =
          new PaperSessionAutomaticQualification(
            coordinator,
          );

        const result =
          service.syncAndQualify({
            rawHistory:
              '1 2 3',

            requiredWarmupSize:
              200,
          });

        expect(
          result.decision,
        ).toBe('REJECTED');

        expect(
          result.sessionMayProceed,
        ).toBe(false);
      },
    );


    test(
      'preserves observation state without releasing session',
      () => {
        const coordinator =
          setup({
            status:
              'OBSERVE',
          });

        const service =
          new PaperSessionAutomaticQualification(
            coordinator,
          );

        const result =
          service.syncAndQualify({
            rawHistory:
              '1 2 3',

            requiredWarmupSize:
              200,
          });

        expect(
          result.decision,
        ).toBe('OBSERVE');

        expect(
          result.sessionMayProceed,
        ).toBe(false);
      },
    );


    test(
      'does not qualify when sync parser rejects input',
      () => {
        const coordinator =
          setup({
            syncAccepted:
              false,
          });

        const service =
          new PaperSessionAutomaticQualification(
            coordinator,
          );

        const result =
          service.syncAndQualify({
            rawHistory:
              '1 x 3',

            requiredWarmupSize:
              200,
          });

        expect(
          coordinator.calls,
        ).toEqual([
          [
            'sync',
            '1 x 3',
            undefined,
          ],
        ]);

        expect(
          result.decision,
        ).toBe(
          'SYNC_REJECTED',
        );

        expect(
          result.sessionMayProceed,
        ).toBe(false);
      },
    );


    test(
      'preserves paper safety invariants',
      () => {
        const service =
          new PaperSessionAutomaticQualification(
            setup(),
          );

        const result =
          service.syncAndQualify({
            rawHistory:
              '1 2 3',

            requiredWarmupSize:
              200,
          });

        expect(
          result.paperOnly,
        ).toBe(true);

        expect(
          result.liveMoneyAuthorization,
        ).toBe(false);

        expect(
          result.automaticExecutionAllowed,
        ).toBe(false);

        expect(
          result.humanSupervisionRequired,
        ).toBe(true);
      },
    );
  },
);
