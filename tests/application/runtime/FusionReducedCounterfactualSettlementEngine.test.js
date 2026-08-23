const assert = require('node:assert/strict');
const {
  test,
} = require('@jest/globals');

const {
  FusionReducedCounterfactualSettlementEngine,
} = require('../../../dist/application/runtime/FusionReducedCounterfactualSettlementEngine.js');


function paperDecision() {
  return {
    status: 'PAPER_READY',
    hypothesis: {
      targetNumbers: [
        34, 6, 27, 13, 36,
        11, 30, 8, 23, 10,
        5, 24, 16, 33, 1,
        20, 14, 31, 9,
      ],
    },
  };
}


test(
  'registers PAPER hypothesis',
  () => {
    const engine =
      new FusionReducedCounterfactualSettlementEngine();

    const pending =
      engine.registerDecision(
        paperDecision(),
      );

    assert.ok(pending);
    assert.equal(
      pending.paperOnly,
      true,
    );
  },
);


test(
  'does not settle without next spin',
  () => {
    const engine =
      new FusionReducedCounterfactualSettlementEngine();

    engine.registerDecision(
      paperDecision(),
    );

    assert.equal(
      engine.snapshot().settledCount,
      0,
    );
  },
);


test(
  'settles WIN when next spin hits fixed target',
  () => {
    const engine =
      new FusionReducedCounterfactualSettlementEngine();

    engine.registerDecision(
      paperDecision(),
    );

    const result =
      engine.settleNextSpin(
        23,
      );

    assert.equal(
      result.outcome,
      'WIN',
    );
  },
);


test(
  'settles LOSS outside fixed target',
  () => {
    const engine =
      new FusionReducedCounterfactualSettlementEngine();

    engine.registerDecision(
      paperDecision(),
    );

    const result =
      engine.settleNextSpin(
        0,
      );

    assert.equal(
      result.outcome,
      'LOSS',
    );
  },
);


test(
  'never exposes execution authority',
  () => {
    const engine =
      new FusionReducedCounterfactualSettlementEngine();

    const snapshot =
      engine.snapshot();

    assert.equal(
      snapshot.automaticExecution,
      false,
    );

    assert.equal(
      snapshot.bankrollChanged,
      false,
    );
  },
);
