'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createEmptyDisciplineState,
  getLossStreak,
  evaluateOperatorDiscipline
} = require(
  '../scripts/paper-runtime-operator-discipline-guard'
);

test(
  'getLossStreak counts only trailing losses',
  () => {
    assert.equal(
      getLossStreak([]),
      0
    );

    assert.equal(
      getLossStreak([
        { type: 'LOSS' },
        { type: 'LOSS' }
      ]),
      2
    );

    assert.equal(
      getLossStreak([
        { type: 'LOSS' },
        { type: 'WIN' },
        { type: 'LOSS' }
      ]),
      1
    );
  }
);

test(
  'evaluateOperatorDiscipline blocks unsafe resume after losses',
  () => {
    const result =
      evaluateOperatorDiscipline({
        command: 'resume',
        ledger: {
          entries: [
            { type: 'LOSS' },
            { type: 'LOSS' }
          ],
          summary: {
            maxDrawdown: 2
          }
        },
        state:
          createEmptyDisciplineState(),
        nowMs: 1000
      });

    assert.equal(
      result.blocked,
      true
    );

    assert.equal(
      result.reason,
      'UNSAFE_RESUME_AFTER_LOSSES'
    );
  }
);
