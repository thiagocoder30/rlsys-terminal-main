import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

import { IntelligenceRuntime } from '../../src/runtime/IntelligenceRuntime';
import { TacticalRuntimeAdapter } from '../../src/adapters/pwa/TacticalRuntimeAdapter';
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
import { TacticalExecutionRequest } from '../../src/runtime/contracts/TacticalExecutionRequest';

describe('Runtime Integration Validation (Sprint 015 & 016)', () => {
  let adapter: TacticalRuntimeAdapter;
  let ledgerPath: string;

  beforeEach(() => {
    ledgerPath = path.join(process.cwd(), 'data', 'audit', `test-ledger-integration-${Date.now()}.jsonl`);
    
    const registry = new QuantitativeEngineRegistry();
    const markov = new MarkovProbabilityEngine();
    const shannon = new ShannonEntropyEngine();
    const vix = new OperationalVixEngine(markov, shannon);
    const zscore = new ZScoreEngine();
    
    const strategy = new StrategyRankingEngine(markov, shannon, vix, zscore, []);

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

    const runtime = new IntelligenceRuntime(
      pipeline,
      decisionEngine,
      explainabilityCoordinator,
      auditLedger
    );
    
    adapter = new TacticalRuntimeAdapter(runtime);
  });

  afterAll(() => {
    const dir = path.join(process.cwd(), 'data', 'audit');
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith('test-ledger-integration-')) {
          fs.unlinkSync(path.join(dir, file));
        }
      }
    }
  });

  it('Adapter should process full flow through Runtime successfully', async () => {
    const request: TacticalExecutionRequest = {
      sessionId: 'session-adapter-1',
      bankroll: 1000,
      provider: 'Evolution',
      recentSpins: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11]
    };

    const result = await adapter.execute(request);

    expect(result).toBeDefined();
    expect(result.runtimeStatus).toBe('SUCCESS');
    expect(result.summary).toBeDefined();
    expect(result.explanation).toBeDefined();
    expect(result.summary.globalConfidence).toBeGreaterThan(0);
    expect(result.explanation.transparencyReport.enginesConsulted.length).toBeGreaterThan(0);
    
    const auditLedger = new DecisionAuditLedgerRepository(ledgerPath);
    const history = auditLedger.getHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1].sessionId).toBe('session-adapter-1');
  });
});
