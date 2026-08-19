const {
  PostSyncCatchUpBoundary,
} = require(
  '../../../dist/application/runtime/PostSyncCatchUpBoundary.js'
);


describe(
  'PostSyncCatchUpBoundary',
  () => {
    test(
      'starts awaiting current-history confirmation',
      () => {
        const boundary =
          new PostSyncCatchUpBoundary();

        const snapshot =
          boundary.snapshot();

        expect(
          snapshot.mode,
        ).toBe(
          'AWAITING_CONFIRMATION',
        );

        expect(
          snapshot.prospectiveSignalsAllowed,
        ).toBe(false);

        expect(
          snapshot.bankrollImpactAllowed,
        ).toBe(false);
      },
    );


    test(
      's marks synchronized history as current and opens LIVE boundary',
      () => {
        const boundary =
          new PostSyncCatchUpBoundary();

        const result =
          boundary.confirmHistoryCurrent(
            's',
          );

        expect(
          result.mode,
        ).toBe('LIVE');

        expect(
          result.prospectiveSignalsAllowed,
        ).toBe(true);

        expect(
          result.operatorDecisionPromptAllowed,
        ).toBe(true);
      },
    );


    test(
      'n enters CATCH_UP without allowing prospective signals',
      () => {
        const boundary =
          new PostSyncCatchUpBoundary();

        const result =
          boundary.confirmHistoryCurrent(
            'n',
          );

        expect(
          result.mode,
        ).toBe(
          'CATCH_UP',
        );

        expect(
          result.prospectiveSignalsAllowed,
        ).toBe(false);

        expect(
          result.bankrollImpactAllowed,
        ).toBe(false);

        expect(
          result.operatorDecisionPromptAllowed,
        ).toBe(false);
      },
    );


    test(
      'catch-up spins update count but remain non prospective',
      () => {
        const boundary =
          new PostSyncCatchUpBoundary();

        boundary.confirmHistoryCurrent(
          'n',
        );

        boundary.recordCatchUpSpin(
          17,
        );

        const result =
          boundary.recordCatchUpSpin(
            32,
          );

        expect(
          result.catchUpSpins,
        ).toBe(2);

        expect(
          result.mode,
        ).toBe(
          'CATCH_UP',
        );

        expect(
          result.prospectiveSignalsAllowed,
        ).toBe(false);
      },
    );


    test(
      'finish catch-up establishes prospective LIVE boundary',
      () => {
        const boundary =
          new PostSyncCatchUpBoundary();

        boundary.confirmHistoryCurrent(
          'n',
        );

        boundary.recordCatchUpSpin(
          17,
        );

        boundary.recordCatchUpSpin(
          32,
        );

        const result =
          boundary.finishCatchUp();

        expect(
          result.mode,
        ).toBe('LIVE');

        expect(
          result.catchUpSpins,
        ).toBe(2);

        expect(
          result.prospectiveSignalsAllowed,
        ).toBe(true);

        expect(
          result.bankrollImpactAllowed,
        ).toBe(true);
      },
    );


    test(
      'prospective signal is blocked before LIVE boundary',
      () => {
        const boundary =
          new PostSyncCatchUpBoundary();

        expect(
          () =>
            boundary.assertProspectiveAllowed(),
        ).toThrow(
          'post_sync_prospective_signal_not_allowed',
        );
      },
    );


    test(
      'prospective signal is allowed only after LIVE boundary',
      () => {
        const boundary =
          new PostSyncCatchUpBoundary();

        boundary.confirmHistoryCurrent(
          's',
        );

        expect(
          () =>
            boundary.assertProspectiveAllowed(),
        ).not.toThrow();
      },
    );


    test(
      'rejects invalid catch-up roulette spin',
      () => {
        const boundary =
          new PostSyncCatchUpBoundary();

        boundary.confirmHistoryCurrent(
          'n',
        );

        expect(
          () =>
            boundary.recordCatchUpSpin(
              37,
            ),
        ).toThrow(
          'post_sync_invalid_spin',
        );
      },
    );
  },
);
