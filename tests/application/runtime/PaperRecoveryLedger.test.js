const {
  PaperRecoveryLedger,
} = require(
  '../../../dist/application/runtime/PaperRecoveryLedger.js'
);


describe(
  'PaperRecoveryLedger',
  () => {
    test(
      'FOLLOWED loss creates session recovery debt',
      () => {
        const ledger =
          new PaperRecoveryLedger();

        const result =
          ledger.apply({
            settlement:
              'LOSS',

            stake:
              0.60,
          });

        expect(
          result.pendingLossDebt,
        ).toBe(0.60);

        expect(
          result.accumulatedLosses,
        ).toBe(0.60);
      },
    );


    test(
      'zero loss also creates recovery debt',
      () => {
        const ledger =
          new PaperRecoveryLedger();

        const result =
          ledger.apply({
            settlement:
              'ZERO_LOSS',

            stake:
              0.60,
          });

        expect(
          result.pendingLossDebt,
        ).toBe(0.60);
      },
    );


    test(
      'NO_EXPOSURE never changes debt',
      () => {
        const ledger =
          new PaperRecoveryLedger();

        ledger.apply({
          settlement:
            'LOSS',

          stake:
            0.60,
        });

        const result =
          ledger.apply({
            settlement:
              'NO_EXPOSURE',

            stake:
              0,
        });

        expect(
          result.pendingLossDebt,
        ).toBe(0.60);

        expect(
          result.exposedSettlements,
        ).toBe(1);
      },
    );


    test(
      'WIN reduces debt only by recovery component',
      () => {
        const ledger =
          new PaperRecoveryLedger();

        ledger.apply({
          settlement:
            'LOSS',

          stake:
            0.60,
        });

        const result =
          ledger.apply({
            settlement:
              'WIN',

            stake:
              0.80,

            recoveryComponent:
              0.30,
          });

        expect(
          result.pendingLossDebt,
        ).toBe(0.30);

        expect(
          result.recoveredAmount,
        ).toBe(0.30);
      },
    );


    test(
      'base stake profit does not falsely erase historical debt',
      () => {
        const ledger =
          new PaperRecoveryLedger();

        ledger.apply({
          settlement:
            'LOSS',

          stake:
            0.60,
        });

        const result =
          ledger.apply({
            settlement:
              'WIN',

            stake:
              0.50,

            recoveryComponent:
              0,
          });

        expect(
          result.pendingLossDebt,
        ).toBe(0.60);
      },
    );


    test(
      'recovery component cannot reduce debt below zero',
      () => {
        const ledger =
          new PaperRecoveryLedger();

        ledger.apply({
          settlement:
            'LOSS',

          stake:
            0.20,
        });

        const result =
          ledger.apply({
            settlement:
              'WIN',

            stake:
              1,

            recoveryComponent:
              0.50,
          });

        expect(
          result.pendingLossDebt,
        ).toBe(0);

        expect(
          result.recoveredAmount,
        ).toBe(0.20);
      },
    );


    test(
      'debt accumulates across independent strategies conceptually',
      () => {
        const ledger =
          new PaperRecoveryLedger();

        ledger.apply({
          settlement:
            'LOSS',

          stake:
            0.60,
        });

        const result =
          ledger.apply({
            settlement:
              'LOSS',

          stake:
              0.40,
        });

        expect(
          result.pendingLossDebt,
        ).toBe(1);
      },
    );


    test(
      'preserves permanent human-supervision invariants',
      () => {
        const ledger =
          new PaperRecoveryLedger();

        const result =
          ledger.snapshot();

        expect(
          result.paperOnly,
        ).toBe(true);

        expect(
          result.recommendationOnly,
        ).toBe(true);

        expect(
          result.humanExecutionRequired,
        ).toBe(true);

        expect(
          result.automaticBetExecutionAllowed,
        ).toBe(false);
      },
    );
  },
);
