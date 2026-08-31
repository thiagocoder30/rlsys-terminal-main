import test from 'node:test';

import assert from 'node:assert/strict';

import {
  OperatorRuntimeFacade,
} from '../dist/application/cli/OperatorRuntimeFacade.js';


function createHarness() {

  let ingestedRounds = [];

  let recommendationCalls = 0;


  const status = {
    sessionId:
      'operator-session-001',

    phase:
      'OBSERVATION',

    roundCount:
      12,

    operatorMode:
      'SUPERVISED',

    execution:
      'MANUAL_OPERATOR_ONLY',

    automaticEntry:
      false,
  };


  const statusSource = {

    getOperatorStatus() {

      return status;

    },

  };


  const roundSource = {

    async ingestRound(
      round,
    ) {

      ingestedRounds.push(
        round,
      );


      return {
        accepted:
          true,

        round,

        roundCount:
          status.roundCount + 1,

        phase:
          'OBSERVATION',

        message:
          `round ${round} accepted`,
      };

    },

  };


  const recommendationSource = {

    async getLatestRecommendation() {

      recommendationCalls += 1;


      return {
        available:
          true,

        strategyId:
          'TRIPLICACAO',

        target:
          'RED',

        stake:
          1,

        confidencePercent:
          78,

        rationale:
          'institutional supervised recommendation',

        operatorDecisionRequired:
          true,

        supervisedRecommendationOnly:
          true,

        automaticEntry:
          false,
      };

    },

  };


  const facade =
    new OperatorRuntimeFacade(
      statusSource,
      roundSource,
      recommendationSource,
    );


  return {
    facade,

    status,

    getIngestedRounds:
      () => [
        ...ingestedRounds,
      ],

    getRecommendationCalls:
      () => recommendationCalls,
  };

}


test(
  'OperatorRuntimeFacade exposes supervised manual-only status',
  () => {

    const {
      facade,
    } = createHarness();


    const status =
      facade.getStatus();


    assert.equal(
      status.sessionId,
      'operator-session-001',
    );


    assert.equal(
      status.operatorMode,
      'SUPERVISED',
    );


    assert.equal(
      status.execution,
      'MANUAL_OPERATOR_ONLY',
    );


    assert.equal(
      status.automaticEntry,
      false,
    );

  },
);


test(
  'OperatorRuntimeFacade delegates valid roulette round ingestion',
  async () => {

    const harness =
      createHarness();


    const result =
      await harness.facade
        .ingestRound(
          17,
        );


    assert.equal(
      result.accepted,
      true,
    );


    assert.equal(
      result.round,
      17,
    );


    assert.deepEqual(
      harness
        .getIngestedRounds(),
      [
        17,
      ],
    );

  },
);


test(
  'OperatorRuntimeFacade blocks invalid roulette round before delegation',
  async () => {

    const harness =
      createHarness();


    const result =
      await harness.facade
        .ingestRound(
          37,
        );


    assert.equal(
      result.accepted,
      false,
    );


    assert.match(
      result.message,
      /between 0 and 36/,
    );


    assert.deepEqual(
      harness
        .getIngestedRounds(),
      [],
    );

  },
);


test(
  'OperatorRuntimeFacade exposes recommendation as supervised operator guidance only',
  async () => {

    const harness =
      createHarness();


    const recommendation =
      await harness.facade
        .getLatestRecommendation();


    assert.equal(
      recommendation.available,
      true,
    );


    assert.equal(
      recommendation.strategyId,
      'TRIPLICACAO',
    );


    assert.equal(
      recommendation.operatorDecisionRequired,
      true,
    );


    assert.equal(
      recommendation.supervisedRecommendationOnly,
      true,
    );


    assert.equal(
      recommendation.automaticEntry,
      false,
    );


    assert.equal(
      harness
        .getRecommendationCalls(),
      1,
    );

  },
);


test(
  'OperatorRuntimeFacade fails closed when runtime status violates manual-only contract',
  () => {

    const facade =
      new OperatorRuntimeFacade(
        {
          getOperatorStatus() {

            return {
              sessionId:
                'unsafe-session',

              phase:
                'RUNNING',

              roundCount:
                1,

              operatorMode:
                'SUPERVISED',

              execution:
                'AUTOMATIC',

              automaticEntry:
                true,
            };

          },
        },

        {
          async ingestRound(
            round,
          ) {

            return {
              accepted:
                true,

              round,

              roundCount:
                1,

              phase:
                'RUNNING',

              message:
                'unsafe',
            };

          },
        },

        {
          async getLatestRecommendation() {

            return {
              available:
                false,

              operatorDecisionRequired:
                true,

              supervisedRecommendationOnly:
                true,

              automaticEntry:
                false,
            };

          },
        },
      );


    assert.throws(
      () =>
        facade.getStatus(),

      /manual-only|automatic entry/i,
    );

  },
);


test(
  'OperatorRuntimeFacade fails closed when recommendation removes operator decision',
  async () => {

    const facade =
      new OperatorRuntimeFacade(
        {
          getOperatorStatus() {

            return {
              sessionId:
                'operator-session',

              phase:
                'OBSERVATION',

              roundCount:
                10,

              operatorMode:
                'SUPERVISED',

              execution:
                'MANUAL_OPERATOR_ONLY',

              automaticEntry:
                false,
            };

          },
        },

        {
          async ingestRound(
            round,
          ) {

            return {
              accepted:
                true,

              round,

              roundCount:
                11,

              phase:
                'OBSERVATION',

              message:
                'accepted',
            };

          },
        },

        {
          async getLatestRecommendation() {

            return {
              available:
                true,

              operatorDecisionRequired:
                false,

              supervisedRecommendationOnly:
                true,

              automaticEntry:
                false,
            };

          },
        },
      );


    await assert.rejects(
      facade
        .getLatestRecommendation(),

      /operator decision must remain required/i,
    );

  },
);
