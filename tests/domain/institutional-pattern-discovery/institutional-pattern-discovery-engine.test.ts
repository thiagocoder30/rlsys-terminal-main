import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstitutionalPatternDiscoveryEngine,
  type PatternDiscoverySample,
} from '../../../src/domain/institutional-pattern-discovery/institutional-pattern-discovery-engine';

const supportiveSamples: readonly PatternDiscoverySample[] = [
  {
    sampleId: 'sample-001',
    patternKey: 'fusion:table-alpha:low-volatility',
    strategyId: 'fusion',
    tableId: 'table-alpha',
    occurredAtEpochMs: 1000,
    memoryScore: 0.82,
    similarityScore: 0.88,
    correlationScore: 0.84,
    outcomeScore: 0.82,
    riskScore: 0.18,
    operatorScore: 0.9,
    blocked: false,
  },
  {
    sampleId: 'sample-002',
    patternKey: 'fusion:table-alpha:low-volatility',
    strategyId: 'fusion',
    tableId: 'table-alpha',
    occurredAtEpochMs: 2000,
    memoryScore: 0.84,
    similarityScore: 0.86,
    correlationScore: 0.82,
    outcomeScore: 0.84,
    riskScore: 0.2,
    operatorScore: 0.88,
    blocked: false,
  },
  {
    sampleId: 'sample-003',
    patternKey: 'fusion:table-alpha:low-volatility',
    strategyId: 'fusion',
    tableId: 'table-alpha',
    occurredAtEpochMs: 3000,
    memoryScore: 0.86,
    similarityScore: 0.9,
    correlationScore: 0.86,
    outcomeScore: 0.86,
    riskScore: 0.16,
    operatorScore: 0.92,
    blocked: false,
  },
];

describe('InstitutionalPatternDiscoveryEngine', () => {
  it('discovers recurring supportive paper patterns', () => {
    const engine = new InstitutionalPatternDiscoveryEngine();
    const result = engine.discover(supportiveSamples);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'PATTERN_SUPPORTS_PAPER');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.equal(result.value.totalPatterns, 1);
      assert.equal(result.value.patterns[0]?.status, 'PATTERN_SUPPORTS_PAPER');
      assert.ok(result.value.patterns[0]?.reasons.includes('RECURRING_PATTERN'));
      assert.ok(result.value.patterns[0]?.reasons.includes('SUPPORTIVE_PATTERN'));
    }
  });

  it('keeps low-sample patterns neutral', () => {
    const engine = new InstitutionalPatternDiscoveryEngine();
    const result = engine.discover([supportiveSamples[0]]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'PATTERN_NEUTRAL');
      assert.ok(result.value.patterns[0]?.reasons.includes('LOW_SAMPLE_SIZE'));
    }
  });

  it('blocks patterns with excessive block rate', () => {
    const engine = new InstitutionalPatternDiscoveryEngine();
    const result = engine.discover(
      supportiveSamples.map((sample, index) => ({
        ...sample,
        blocked: index < 2,
      })),
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'PATTERN_BLOCKED');
      assert.ok(result.value.patterns[0]?.reasons.includes('EXCESSIVE_BLOCK_RATE'));
    }
  });

  it('blocks patterns with excessive risk', () => {
    const engine = new InstitutionalPatternDiscoveryEngine();
    const result = engine.discover(
      supportiveSamples.map((sample) => ({
        ...sample,
        riskScore: 0.9,
      })),
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'PATTERN_BLOCKED');
      assert.ok(result.value.patterns[0]?.reasons.includes('EXCESSIVE_RISK'));
    }
  });

  it('detects degraded patterns', () => {
    const engine = new InstitutionalPatternDiscoveryEngine();
    const result = engine.discover(
      supportiveSamples.map((sample) => ({
        ...sample,
        memoryScore: 0.25,
        similarityScore: 0.28,
        correlationScore: 0.24,
        outcomeScore: 0.2,
        riskScore: 0.5,
        operatorScore: 0.62,
      })),
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'PATTERN_DEGRADED');
      assert.equal(result.value.patterns[0]?.status, 'PATTERN_DEGRADED');
      assert.ok(result.value.patterns[0]?.reasons.includes('DEGRADED_PATTERN'));
    }
  });

  it('aggregates multiple pattern keys independently', () => {
    const engine = new InstitutionalPatternDiscoveryEngine();
    const result = engine.discover([
      ...supportiveSamples,
      {
        sampleId: 'sample-004',
        patternKey: 'triplicacao:table-beta:high-volatility',
        strategyId: 'triplicacao',
        tableId: 'table-beta',
        occurredAtEpochMs: 1000,
        memoryScore: 0.3,
        similarityScore: 0.34,
        correlationScore: 0.28,
        outcomeScore: 0.22,
        riskScore: 0.52,
        operatorScore: 0.65,
        blocked: false,
      },
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.totalPatterns, 2);
      assert.equal(result.value.patterns[0]?.patternKey, 'fusion:table-alpha:low-volatility');
      assert.equal(result.value.patterns[1]?.patternKey, 'triplicacao:table-beta:high-volatility');
    }
  });

  it('rejects invalid pattern samples through Result', () => {
    const engine = new InstitutionalPatternDiscoveryEngine();
    const result = engine.discover([
      {
        ...supportiveSamples[0],
        outcomeScore: 1.5,
      },
    ]);

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_PATTERN_DISCOVERY_INPUT');
    }
  });
});
