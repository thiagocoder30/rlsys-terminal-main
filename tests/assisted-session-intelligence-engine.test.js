import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AssistedSessionIntelligenceEngine
} from '../dist/domain/supervision/assisted-session-intelligence-engine.js';

const engine =
  new AssistedSessionIntelligenceEngine();

test(
  'AssistedSessionIntelligenceEngine assists only under institutional alignment',
  () => {
    const report = engine.evaluate({
      tableQualificationScore: 82,
      hybridConsensusScore: 84,
      operatorReadinessScore: 88,
      strategyRiskWeight: 24
    });

    assert.equal(report.mode, 'ASSIST');
    assert.equal(report.gate, 'BLOCKED');
    assert.equal(report.paperSessionGate, 'BLOCKED');
    assert.equal(report.liveSessionGate, 'BLOCKED');
    assert.equal(report.canSuggest, true);
  }
);

test(
  'AssistedSessionIntelligenceEngine cooldowns high pressure sessions',
  () => {
    const report = engine.evaluate({
      tableQualificationScore: 45,
      hybridConsensusScore: 41,
      operatorReadinessScore: 30,
      strategyRiskWeight: 90
    });

    assert.equal(report.mode, 'COOLDOWN');
    assert.equal(report.requiresCooldown, true);
    assert.equal(report.canVeto, true);
  }
);

test(
  'AssistedSessionIntelligenceEngine interrupts cooldown active sessions',
  () => {
    const report = engine.evaluate({
      cooldownActive: true
    });

    assert.equal(report.mode, 'INTERRUPT');
    assert.equal(report.canInterrupt, true);
  }
);

test(
  'AssistedSessionIntelligenceEngine remains deterministic',
  () => {
    const input = {
      tableQualificationScore: 70,
      hybridConsensusScore: 70,
      operatorReadinessScore: 70,
      strategyRiskWeight: 40
    };

    const first =
      engine.evaluate(input);

    const second =
      engine.evaluate(input);

    assert.deepEqual(first, second);
  }
);
