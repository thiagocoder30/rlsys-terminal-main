import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TableReputationEngine,
  type TableReputationSample,
} from '../../../src/domain/table-reputation/table-reputation-engine';

const stableTableSamples: readonly TableReputationSample[] = [
  {
    tableId: 'table-alpha',
    sessionId: 'session-001',
    observedRounds: 80,
    paperSignals: 20,
    blockedSignals: 2,
    favorableSignals: 15,
    volatilityScore: 0.22,
    consensusScore: 0.86,
    confidenceScore: 0.84,
    maxDrawdownUnits: 2,
    certificationFailureCount: 0,
    operatorViolationCount: 0,
  },
  {
    tableId: 'table-alpha',
    sessionId: 'session-002',
    observedRounds: 70,
    paperSignals: 18,
    blockedSignals: 2,
    favorableSignals: 13,
    volatilityScore: 0.26,
    consensusScore: 0.82,
    confidenceScore: 0.8,
    maxDrawdownUnits: 3,
    certificationFailureCount: 0,
    operatorViolationCount: 0,
  },
  {
    tableId: 'table-alpha',
    sessionId: 'session-003',
    observedRounds: 65,
    paperSignals: 16,
    blockedSignals: 1,
    favorableSignals: 12,
    volatilityScore: 0.24,
    consensusScore: 0.84,
    confidenceScore: 0.82,
    maxDrawdownUnits: 2,
    certificationFailureCount: 0,
    operatorViolationCount: 0,
  },
];

describe('TableReputationEngine', () => {
  it('classifies stable tables as stable paper only', () => {
    const engine = new TableReputationEngine();
    const result = engine.evaluate(stableTableSamples);

    assert.equal(result.ok, true);

    if (result.ok) {
      const report = result.value[0];

      if (report === undefined) {
        throw new Error('expected table reputation report');
      }

      assert.equal(report.tableId, 'table-alpha');
      assert.equal(report.status, 'STABLE_PAPER');
      assert.equal(report.productionMoneyAllowed, false);
      assert.equal(report.liveMoneyAuthorization, false);
      assert.equal(report.paperOnly, true);
      assert.ok(report.reasons.includes('STABLE_CONTEXT'));
    }
  });

  it('blocks tables with excessive volatility', () => {
    const engine = new TableReputationEngine({
      minimumSamples: 1,
      minimumObservedRounds: 1,
      minimumStableScore: 0.72,
      minimumNeutralScore: 0.48,
      maximumVolatilityScore: 0.7,
      maximumBlockRate: 0.45,
      maximumDrawdownUnits: 8,
      maximumCertificationFailures: 0,
      maximumOperatorViolations: 0,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    const result = engine.evaluate([
      {
        ...stableTableSamples[0],
        volatilityScore: 0.92,
      },
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      const report = result.value[0];

      if (report === undefined) {
        throw new Error('expected table reputation report');
      }

      assert.equal(report.status, 'BLOCKED_PAPER');
      assert.ok(report.reasons.includes('EXCESSIVE_VOLATILITY'));
    }
  });

  it('blocks tables with excessive block rate', () => {
    const engine = new TableReputationEngine({
      minimumSamples: 1,
      minimumObservedRounds: 1,
      minimumStableScore: 0.72,
      minimumNeutralScore: 0.48,
      maximumVolatilityScore: 0.72,
      maximumBlockRate: 0.45,
      maximumDrawdownUnits: 8,
      maximumCertificationFailures: 0,
      maximumOperatorViolations: 0,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    const result = engine.evaluate([
      {
        ...stableTableSamples[0],
        paperSignals: 10,
        blockedSignals: 7,
        favorableSignals: 2,
      },
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      const report = result.value[0];

      if (report === undefined) {
        throw new Error('expected table reputation report');
      }

      assert.equal(report.status, 'BLOCKED_PAPER');
      assert.ok(report.reasons.includes('EXCESSIVE_BLOCK_RATE'));
    }
  });

  it('keeps low-sample tables neutral instead of over-trusting them', () => {
    const engine = new TableReputationEngine();
    const result = engine.evaluate([stableTableSamples[0]]);

    assert.equal(result.ok, true);

    if (result.ok) {
      const report = result.value[0];

      if (report === undefined) {
        throw new Error('expected table reputation report');
      }

      assert.equal(report.status, 'NEUTRAL_PAPER');
      assert.ok(report.reasons.includes('LOW_SAMPLE_SIZE'));
    }
  });

  it('rejects invalid table samples through Result without silent failure', () => {
    const engine = new TableReputationEngine();
    const result = engine.evaluate([
      {
        ...stableTableSamples[0],
        tableId: ' ',
      },
    ]);

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_TABLE_REPUTATION_INPUT');
    }
  });

  it('aggregates multiple tables in one O(n) pass', () => {
    const engine = new TableReputationEngine();
    const result = engine.evaluate([
      ...stableTableSamples,
      {
        tableId: 'table-beta',
        sessionId: 'session-004',
        observedRounds: 70,
        paperSignals: 10,
        blockedSignals: 4,
        favorableSignals: 3,
        volatilityScore: 0.62,
        consensusScore: 0.46,
        confidenceScore: 0.44,
        maxDrawdownUnits: 5,
        certificationFailureCount: 0,
        operatorViolationCount: 0,
      },
      {
        tableId: 'table-beta',
        sessionId: 'session-005',
        observedRounds: 70,
        paperSignals: 10,
        blockedSignals: 4,
        favorableSignals: 3,
        volatilityScore: 0.64,
        consensusScore: 0.44,
        confidenceScore: 0.42,
        maxDrawdownUnits: 5,
        certificationFailureCount: 0,
        operatorViolationCount: 0,
      },
      {
        tableId: 'table-beta',
        sessionId: 'session-006',
        observedRounds: 70,
        paperSignals: 10,
        blockedSignals: 4,
        favorableSignals: 3,
        volatilityScore: 0.66,
        consensusScore: 0.42,
        confidenceScore: 0.4,
        maxDrawdownUnits: 5,
        certificationFailureCount: 0,
        operatorViolationCount: 0,
      },
    ]);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.length, 2);

      const betaReport = result.value.find((report) => report.tableId === 'table-beta');

      if (betaReport === undefined) {
        throw new Error('expected table-beta report');
      }

      assert.equal(betaReport.status, 'DEGRADED_PAPER');
    }
  });
});
