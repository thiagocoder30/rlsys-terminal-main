import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InstitutionalReplayEngine
} from '../dist/domain/supervision/institutional-replay-engine.js';

const engine =
  new InstitutionalReplayEngine();

test(
  'InstitutionalReplayEngine reconstructs assisted replay',
  () => {
    const report = engine.replay({
      sessionId: 'assist-session',
      replayId: 'assist-replay',
      events: [
        {
          eventId: 'e1',
          timestamp: 1,
          type: 'SESSION_STARTED'
        },
        {
          eventId: 'e2',
          timestamp: 2,
          type: 'ROUND_OBSERVED'
        },
        {
          eventId: 'e3',
          timestamp: 3,
          type: 'ASSISTED_SUGGESTION',
          riskPressure: 24
        }
      ]
    });

    assert.equal(
      report.finalState,
      'ASSISTED'
    );

    assert.equal(
      report.counters.assistedSuggestions,
      1
    );

    assert.equal(
      report.gate,
      'BLOCKED'
    );
  }
);

test(
  'InstitutionalReplayEngine prioritizes interruption state',
  () => {
    const report = engine.replay({
      events: [
        {
          eventId: 'e1',
          timestamp: 1,
          type: 'ASSISTED_SUGGESTION'
        },
        {
          eventId: 'e2',
          timestamp: 2,
          type: 'SESSION_INTERRUPTED',
          riskPressure: 95
        }
      ]
    });

    assert.equal(
      report.finalState,
      'INTERRUPTED'
    );

    assert.equal(
      report.hasTerminalInterruption,
      true
    );
  }
);

test(
  'InstitutionalReplayEngine applies integrity penalties to unordered timelines',
  () => {
    const report = engine.replay({
      events: [
        {
          eventId: 'e1',
          timestamp: 10,
          type: 'SESSION_STARTED'
        },
        {
          eventId: 'e2',
          timestamp: 5,
          type: 'ROUND_OBSERVED'
        }
      ]
    });

    assert.ok(
      report.integrityScore < 100
    );
  }
);

test(
  'InstitutionalReplayEngine is deterministic',
  () => {
    const input = {
      events: [
        {
          eventId: 'e1',
          timestamp: 1,
          type: 'SESSION_STARTED'
        }
      ]
    };

    const first =
      engine.replay(input);

    const second =
      engine.replay(input);

    assert.deepEqual(
      first,
      second
    );
  }
);
