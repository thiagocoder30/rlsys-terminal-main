import test from 'node:test';

import assert from 'node:assert/strict';

import {
  LiveSessionOperatorAdapter,
} from '../dist/application/cli/LiveSessionOperatorAdapter.js';


function report({
  status = 'ACCEPTED',
  sessionId = 'operator-live-001',
  roundCount = 1,
  gate = 'INITIALIZING',
  reason = 'Collect more rounds.',
} = {}) {

  return {
    service:
      'LiveSessionRuntimeService',

    schemaVersion:
      '2.9.0',

    status,

    sessionId,

    snapshot: {
      engineVersion:
        'live-session-runtime-v1',

      sessionId,

      status:
        'INITIALIZING',

      roundCount,

      acceptedEvents:
        status === 'ACCEPTED'
          ? roundCount
          : 0,

      duplicateEvents:
        status === 'DUPLICATE_IGNORED'
          ? 1
          : 0,

      rejectedEvents:
        status === 'REJECTED'
          ? 1
          : 0,

      warmupProgress:
        roundCount / 100,

      readyForDecision:
        roundCount >= 100,

      historyWindow:
        [],

      warmupWindow:
        [],

      rolling: {
        windowSize:
          roundCount,

        uniqueNumbers:
          0,

        normalizedEntropy:
          0,

        repeatRate:
          0,

        maxNumberConcentration:
          0,

        alternationRate:
          0,
      },

      control: {
        phase:
          gate,

        nextAction:
          'INGEST_ROUND',

        spinsUntilWarmup:
          Math.max(
            0,
            100 - roundCount,
          ),

        spinsUntilDecision:
          Math.max(
            0,
            100 - roundCount,
          ),

        cooldownRemainingSpins:
          0,

        decisionWindowSize:
          100,

        reason,
      },

      checksum:
        'test-checksum',

      updatedAt:
        new Date()
          .toISOString(),
    },

    executiveSummary: {
      liveRuntimeGate:
        gate,

      operationalGate:
        'BLOCKED',

      reason,

      nextAction:
        'COLLECT_MORE_ROUNDS',
    },

    generatedAt:
      new Date()
        .toISOString(),
  };

}


test(
  'LiveSessionOperatorAdapter exposes pure initial supervised status',
  () => {

    let ingestCalls =
      0;


    const adapter =
      new LiveSessionOperatorAdapter(
        {
          ingest() {

            ingestCalls +=
              1;


            return report();

          },
        },

        {
          sessionId:
            'operator-live-001',

          bankroll:
            1000,
        },
      );


    const first =
      adapter.getOperatorStatus();


    const second =
      adapter.getOperatorStatus();


    assert.deepEqual(
      first,
      second,
    );


    assert.equal(
      first.sessionId,
      'operator-live-001',
    );


    assert.equal(
      first.phase,
      'INITIALIZING',
    );


    assert.equal(
      first.roundCount,
      0,
    );


    assert.equal(
      first.operatorMode,
      'SUPERVISED',
    );


    assert.equal(
      first.execution,
      'MANUAL_OPERATOR_ONLY',
    );


    assert.equal(
      first.automaticEntry,
      false,
    );


    assert.equal(
      ingestCalls,
      0,
    );

  },
);


test(
  'LiveSessionOperatorAdapter translates manual round into live runtime input',
  async () => {

    const inputs =
      [];


    const adapter =
      new LiveSessionOperatorAdapter(
        {
          ingest(input) {

            inputs.push(
              input,
            );


            return report({
              roundCount:
                inputs.length,
            });

          },
        },

        {
          sessionId:
            'operator-live-002',

          bankroll:
            750,
        },
      );


    const result =
      await adapter
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


    assert.equal(
      result.roundCount,
      1,
    );


    assert.equal(
      inputs.length,
      1,
    );


    assert.deepEqual(
      inputs[0],
      {
        sessionId:
          'operator-live-002',

        value:
          17,

        sequence:
          0,

        eventId:
          'operator-live-002:operator:0',

        bankroll:
          750,
      },
    );

  },
);


test(
  'LiveSessionOperatorAdapter advances deterministic sequence per manual input',
  async () => {

    const inputs =
      [];


    const adapter =
      new LiveSessionOperatorAdapter(
        {
          ingest(input) {

            inputs.push(
              input,
            );


            return report({
              sessionId:
                'operator-live-003',

              roundCount:
                inputs.length,
            });

          },
        },

        {
          sessionId:
            'operator-live-003',
        },
      );


    await adapter.ingestRound(
      4,
    );


    await adapter.ingestRound(
      21,
    );


    assert.equal(
      inputs[0].sequence,
      0,
    );


    assert.equal(
      inputs[0].eventId,
      'operator-live-003:operator:0',
    );


    assert.equal(
      inputs[1].sequence,
      1,
    );


    assert.equal(
      inputs[1].eventId,
      'operator-live-003:operator:1',
    );

  },
);


test(
  'LiveSessionOperatorAdapter projects last ingested runtime state without snapshot side effects',
  async () => {

    let ingestCalls =
      0;


    const adapter =
      new LiveSessionOperatorAdapter(
        {
          ingest() {

            ingestCalls +=
              1;


            return report({
              sessionId:
                'operator-live-004',

              roundCount:
                100,

              gate:
                'DECISION_READY',

              reason:
                'Decision window ready for review.',
            });

          },
        },

        {
          sessionId:
            'operator-live-004',
        },
      );


    await adapter.ingestRound(
      9,
    );


    const first =
      adapter.getOperatorStatus();


    const second =
      adapter.getOperatorStatus();


    assert.equal(
      first.phase,
      'DECISION_READY',
    );


    assert.equal(
      first.roundCount,
      100,
    );


    assert.deepEqual(
      first,
      second,
    );


    assert.equal(
      ingestCalls,
      1,
    );

  },
);


test(
  'LiveSessionOperatorAdapter blocks invalid round before live runtime delegation',
  async () => {

    let ingestCalls =
      0;


    const adapter =
      new LiveSessionOperatorAdapter(
        {
          ingest() {

            ingestCalls +=
              1;


            return report();

          },
        },

        {
          sessionId:
            'operator-live-005',
        },
      );


    const result =
      await adapter
        .ingestRound(
          37,
        );


    assert.equal(
      result.accepted,
      false,
    );


    assert.equal(
      result.roundCount,
      0,
    );


    assert.match(
      result.message,
      /between 0 and 36/,
    );


    assert.equal(
      ingestCalls,
      0,
    );

  },
);


test(
  'LiveSessionOperatorAdapter reports rejected runtime ingestion without claiming acceptance',
  async () => {

    const adapter =
      new LiveSessionOperatorAdapter(
        {
          ingest() {

            return report({
              status:
                'REJECTED',

              sessionId:
                'operator-live-006',

              roundCount:
                0,

              gate:
                'BLOCKED',

              reason:
                'Runtime rejected round.',
            });

          },
        },

        {
          sessionId:
            'operator-live-006',
        },
      );


    const result =
      await adapter
        .ingestRound(
          12,
        );


    assert.equal(
      result.accepted,
      false,
    );


    assert.equal(
      result.phase,
      'BLOCKED',
    );


    assert.match(
      result.message,
      /round rejected/i,
    );

  },
);


test(
  'LiveSessionOperatorAdapter validates session identity and bankroll fail closed',
  () => {

    const service = {
      ingest() {

        return report();

      },
    };


    assert.throws(
      () =>
        new LiveSessionOperatorAdapter(
          service,
          {
            sessionId:
              '   ',
          },
        ),

      /session id is required/i,
    );


    assert.throws(
      () =>
        new LiveSessionOperatorAdapter(
          service,
          {
            sessionId:
              'operator-live-007',

            bankroll:
              -1,
          },
        ),

      /bankroll must be a non-negative finite number/i,
    );

  },
);
