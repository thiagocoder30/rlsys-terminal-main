const assert =
  require('node:assert/strict');

const {
  FusionReducedDoctrineEngine,
} =
  require('../../../dist/application/runtime/FusionReducedDoctrineEngine.js');

const {
  FusionReducedProspectiveDecisionSemantics,
} =
  require('../../../dist/application/runtime/FusionReducedProspectiveDecisionSemantics.js');


describe(
  'FusionReducedProspectiveDecisionSemantics',
  () => {

    function createEngine() {

      const doctrine =
        new FusionReducedDoctrineEngine()
          .snapshot();

      return new FusionReducedProspectiveDecisionSemantics(
        doctrine,
      );
    }


    it(
      'blocks when evidence has blockers',
      () => {

        const decision =
          createEngine()
            .resolve({
              eligible: true,
              confidenceScore: 90,
              riskScore: 20,
              blockers: [
                'INSUFFICIENT_SAMPLE',
              ],
              warnings: [],
              reasons: [],
            });

        assert.equal(
          decision.status,
          'BLOCKED',
        );

        assert.equal(
          decision.hypothesis,
          null,
        );
      },
    );


    it(
      'observes when confirmation is not enough',
      () => {

        const decision =
          createEngine()
            .resolve({
              eligible: false,
              confidenceScore: 40,
              riskScore: 50,
              blockers: [],
              warnings: [],
              reasons: [],
            });

        assert.equal(
          decision.status,
          'OBSERVE',
        );
      },
    );


    it(
      'creates PAPER hypothesis using fixed doctrine target',
      () => {

        const decision =
          createEngine()
            .resolve({
              eligible: true,
              confidenceScore: 80,
              riskScore: 20,
              blockers: [],
              warnings: [],
              reasons: [],
            });

        assert.equal(
          decision.status,
          'PAPER_READY',
        );

        assert.deepEqual(
          decision.hypothesis.targetNumbers,
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
      'never creates execution authority',
      () => {

        const decision =
          createEngine()
            .resolve({
              eligible: true,
              confidenceScore: 80,
              riskScore: 20,
              blockers: [],
              warnings: [],
              reasons: [],
            });

        assert.equal(
          decision.automaticExecutionAllowed,
          false,
        );

        assert.equal(
          decision.paperOnly,
          true,
        );
      },
    );

  },
);
