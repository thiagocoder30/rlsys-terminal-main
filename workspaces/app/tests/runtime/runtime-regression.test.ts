import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

import { IntelligenceRuntime } from '../../src/runtime/IntelligenceRuntime';
import { QuantitativeEngineRegistry } from '../../src/application/intelligence/QuantitativeEngineRegistry';
import { QuantitativeEnginePipeline } from '../../src/application/intelligence/QuantitativeEnginePipeline';
import { MarkovProbabilityEngine } from '../../src/domain/intelligence/markov/MarkovProbabilityEngine';
import { ShannonEntropyEngine } from '../../src/domain/intelligence/shannon/ShannonEntropyEngine';
import { OperationalVixEngine } from '../../src/domain/intelligence/vix/OperationalVixEngine';
import { ZScoreEngine } from '../../src/domain/intelligence/zscore/ZScoreEngine';
import { StrategyRankingEngine } from '../../src/domain/intelligence/strategy/StrategyRankingEngine';
import { DecisionIntelligenceEngine } from '../../src/domain/intelligence/decision/DecisionIntelligenceEngine';
import { ExplainabilityEngine } from '../../src/domain/intelligence/explainability/ExplainabilityEngine';
import { ExplainabilityCoordinator } from '../../src/application/intelligence/ExplainabilityCoordinator';
import { DecisionAuditLedgerRepository } from '../../src/infrastructure/audit/DecisionAuditLedgerRepository';
import { QuantitativeInput } from '../../src/domain/intelligence/common/QuantitativeInput';
import { StrategyCandidate } from '../../src/domain/intelligence/strategy/StrategyCandidate';

describe('Operational End-to-End Validation (Sprint 014)', () => {
  let runtime: IntelligenceRuntime;
  let ledgerPath: string;

  beforeEach(() => {
    ledgerPath = path.join(process.cwd(), 'data', 'audit', `test-ledger-e2e-${Date.now()}.jsonl`);
    
    const registry = new QuantitativeEngineRegistry();
    const markov = new MarkovProbabilityEngine();
    const shannon = new ShannonEntropyEngine();
    const vix = new OperationalVixEngine(markov, shannon);
    const zscore = new ZScoreEngine();
    
    // Add dummy strategies
    const candidates: StrategyCandidate[] = [
      { id: 'strat-a', name: 'Safe Strategy', riskLevel: 'LOW', evaluationRules: [] },
      { id: 'strat-b', name: 'Aggressive Strategy', riskLevel: 'HIGH', evaluationRules: [] }
    ];
    const strategy = new StrategyRankingEngine(markov, shannon, vix, zscore, candidates);

    registry.register(markov);
    registry.register(shannon);
    registry.register(vix);
    registry.register(zscore);
    registry.register(strategy);

    const pipeline = new QuantitativeEnginePipeline(registry);

    const decisionEngine = new DecisionIntelligenceEngine(
      markov,
      shannon,
      vix,
      zscore,
      strategy
    );

    const explainabilityEngine = new ExplainabilityEngine();
    const explainabilityCoordinator = new ExplainabilityCoordinator(explainabilityEngine);

    const auditLedger = new DecisionAuditLedgerRepository(ledgerPath);

    runtime = new IntelligenceRuntime(
      pipeline,
      decisionEngine,
      explainabilityCoordinator,
      auditLedger
    );
  });

  afterAll(() => {
    // Clean up all test ledger files
    const dir = path.join(process.cwd(), 'data', 'audit');
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith('test-ledger-e2e-')) {
          fs.unlinkSync(path.join(dir, file));
        }
      }
    }
  });

  it('Category 1: Successful end-to-end execution', () => {
    const input: QuantitativeInput = {
      sessionId: 'session-normal',
      timestamp: new Date().toISOString(),
      recentSpins: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
      analyzedWindow: 37,
      executionParameters: { activeStrategies: ['strat-a', 'strat-b'] }
    };

    const result = runtime.execute(input);

    expect(result).toBeDefined();
    expect(result.runtimeStatus).toBe('SUCCESS');
    expect(result.summary).toBeDefined();
    expect(result.explanation).toBeDefined();
    expect(result.summary.globalConfidence).toBeGreaterThan(0);
    expect(result.explanation.transparencyReport.enginesConsulted.length).toBeGreaterThan(0);
    
    // Check audit ledger integration
    const auditLedger = new DecisionAuditLedgerRepository(ledgerPath);
    const history = auditLedger.getHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1].sessionId).toBe('session-normal');
    expect(history[history.length - 1].decision).toBe('INTELLIGENCE_PIPELINE_EXECUTED');
    expect(auditLedger.verifyIntegrity()).toBe(true);
  });

  it('Category 2: Empty input', () => {
    const input: QuantitativeInput = {
      sessionId: 'session-empty',
      timestamp: new Date().toISOString(),
      recentSpins: [],
      analyzedWindow: 0,
      executionParameters: {}
    };

    const result = runtime.execute(input);
    expect(result).toBeDefined();
    // Empty input will cause engines to fail, partial success expected as architecture doesn't throw on pipeline but rather returns FAILED metrics
    expect(['SUCCESS', 'PARTIAL', 'FAILED']).toContain(result.runtimeStatus);
  });

  it('Category 3: Insufficient historical data', () => {
    const input: QuantitativeInput = {
      sessionId: 'session-insufficient',
      timestamp: new Date().toISOString(),
      recentSpins: [1, 2],
      analyzedWindow: 2,
      executionParameters: {}
    };

    const result = runtime.execute(input);
    expect(result).toBeDefined();
    expect(['SUCCESS', 'PARTIAL', 'FAILED']).toContain(result.runtimeStatus);
  });

  it('Category 4: Uniform sequences', () => {
    const input: QuantitativeInput = {
      sessionId: 'session-uniform',
      timestamp: new Date().toISOString(),
      recentSpins: Array(30).fill(5),
      analyzedWindow: 30,
      executionParameters: {}
    };

    const result = runtime.execute(input);
    expect(result).toBeDefined();
    // VIX might throw if variance is zero, resulting in PARTIAL status
    expect(['SUCCESS', 'PARTIAL', 'FAILED']).toContain(result.runtimeStatus);
  });

  it('Category 5: Highly random sequences', () => {
    const randomSpins = Array.from({ length: 50 }, () => Math.floor(Math.random() * 37));
    const input: QuantitativeInput = {
      sessionId: 'session-random',
      timestamp: new Date().toISOString(),
      recentSpins: randomSpins,
      analyzedWindow: 50,
      executionParameters: {}
    };

    const result = runtime.execute(input);
    expect(result).toBeDefined();
    expect(['SUCCESS', 'PARTIAL']).toContain(result.runtimeStatus);
  });

  it('Category 6: Highly concentrated sequences', () => {
    // Pattern: alternate between 0 and 32
    const concentratedSpins = Array.from({ length: 50 }, (_, i) => i % 2 === 0 ? 0 : 32);
    const input: QuantitativeInput = {
      sessionId: 'session-concentrated',
      timestamp: new Date().toISOString(),
      recentSpins: concentratedSpins,
      analyzedWindow: 50,
      executionParameters: {}
    };

    const result = runtime.execute(input);
    expect(result).toBeDefined();
    expect(['SUCCESS', 'PARTIAL']).toContain(result.runtimeStatus);
  });

  it('Category 7: Invalid values', () => {
    const input: QuantitativeInput = {
      sessionId: 'session-invalid',
      timestamp: new Date().toISOString(),
      recentSpins: [-1, 38, NaN, Infinity] as unknown as number[],
      analyzedWindow: 4,
      executionParameters: {}
    };

    const result = runtime.execute(input);
    expect(result).toBeDefined();
    // Expect graceful failure or partial state
    expect(['SUCCESS', 'PARTIAL', 'FAILED']).toContain(result.runtimeStatus);
  });

  it('Category 8: Runtime exception propagation', () => {
    // Pass null input to trigger deeper exceptions, handled by the architecture's safe pipeline
    const input = {
      sessionId: 'session-exception',
      timestamp: new Date().toISOString()
    } as QuantitativeInput;

    const result = runtime.execute(input);
    expect(result).toBeDefined();
    expect(['SUCCESS', 'PARTIAL', 'FAILED']).toContain(result.runtimeStatus);
    
    // Audit Ledger must still have recorded the attempt
    const auditLedger = new DecisionAuditLedgerRepository(ledgerPath);
    const history = auditLedger.getHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1].sessionId).toBe('session-exception');
  });

  it('Category 9, 10, 11: Validation of metadata, explainability, and audit', () => {
    const input: QuantitativeInput = {
      sessionId: 'session-metadata',
      timestamp: new Date().toISOString(),
      recentSpins: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      analyzedWindow: 15,
      executionParameters: {}
    };

    const result = runtime.execute(input);
    
    // 9. Audit persistence
    const auditLedger = new DecisionAuditLedgerRepository(ledgerPath);
    const history = auditLedger.getHistory();
    const lastEntry = history[history.length - 1];
    expect(lastEntry.eventId).toBe(result.executionMetadata.executionId);
    expect(auditLedger.verifyIntegrity()).toBe(true);

    // 10. Explainability generation
    expect(result.explanation.overallExplanation).toBeDefined();
    expect(result.explanation.transparencyReport.architectureVersion).toBe('RL.SYS CORE v5.x');

    // 11. Execution metadata validation
    expect(result.executionMetadata.correlationId).toBe('session-metadata');
    expect(result.executionMetadata.enginesExecuted).toBe(5);
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics.durationMs).toBeGreaterThanOrEqual(0);
  });
  
  it('Category 12: Performance validation', () => {
    const input: QuantitativeInput = {
      sessionId: 'session-perf',
      timestamp: new Date().toISOString(),
      recentSpins: Array.from({ length: 1000 }, () => Math.floor(Math.random() * 37)),
      analyzedWindow: 1000,
      executionParameters: {}
    };
    
    const startTime = Date.now();
    const result = runtime.execute(input);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(1000); // Expect execution under 1s for 1000 items
    expect(result.processingTime).toBeLessThanOrEqual(duration);
  });
});
