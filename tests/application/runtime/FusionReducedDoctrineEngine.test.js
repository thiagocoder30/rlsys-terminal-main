const assert =
  require('node:assert/strict');

const {
  FusionReducedDoctrineEngine,
} =
  require('../../../dist/application/runtime/FusionReducedDoctrineEngine.js');


describe(
  'FusionReducedDoctrineEngine',
  () => {

    it(
      'defines fixed center 23 with 19-number coverage',
      () => {

        const snapshot =
          new FusionReducedDoctrineEngine()
            .snapshot();

        assert.equal(
          snapshot.centerNumber,
          23,
        );

        assert.equal(
          snapshot.leftNeighbors,
          9,
        );

        assert.equal(
          snapshot.rightNeighbors,
          9,
        );

        assert.equal(
          snapshot.totalCoverage,
          19,
        );
      },
    );


    it(
      'returns exactly the fixed 23 ± 9 european wheel neighborhood',
      () => {

        const engine =
          new FusionReducedDoctrineEngine();

        assert.deepEqual(
          engine.targetNumbers(),
          [
            17, 34, 6,
            27, 13, 36,
            11, 30, 8,
            23,
            10, 5, 24,
            16, 33, 1,
            20, 14, 31,
          ],
        );
      },
    );


    it(
      'never exposes execution authority',
      () => {

        const snapshot =
          new FusionReducedDoctrineEngine()
            .snapshot();

        assert.equal(
          snapshot.paperOnly,
          true,
        );

        assert.equal(
          snapshot.recommendationOnly,
          true,
        );

        assert.equal(
          snapshot.automaticExecutionAllowed,
          false,
        );
      },
    );


    it(
      'keeps strategy identity separated from dynamic heatmap',
      () => {

        const snapshot =
          new FusionReducedDoctrineEngine()
            .snapshot();

        assert.equal(
          snapshot.strategyId,
          'fusion-reduced',
        );

        assert.equal(
          snapshot.wheel,
          'EUROPEAN',
        );
      },
    );

  },
);
