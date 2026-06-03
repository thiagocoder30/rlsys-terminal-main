import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

const modules = [
  ['220', 'InstitutionalEventLedger', 'src/domain/institutional-event-ledger/institutional-event-ledger-engine.ts', ['InstitutionalEventLedgerEngine', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
  ['221', 'LearningMemoryLayer', 'src/domain/learning-memory/learning-memory-layer.ts', ['LearningMemoryLayer', 'MEMORY_SUPPORTS_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
  ['222', 'InstitutionalKnowledgeGraph', 'src/domain/institutional-knowledge-graph/institutional-knowledge-graph-engine.ts', ['InstitutionalKnowledgeGraphEngine', 'GRAPH_SUPPORTS_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
  ['223', 'ContextSimilarity', 'src/domain/context-similarity/context-similarity-engine.ts', ['ContextSimilarityEngine', 'SIMILARITY_SUPPORTS_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
  ['224', 'OutcomeCorrelation', 'src/domain/outcome-correlation/outcome-correlation-engine.ts', ['OutcomeCorrelationEngine', 'CORRELATION_SUPPORTS_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
  ['225', 'InstitutionalPatternDiscovery', 'src/domain/institutional-pattern-discovery/institutional-pattern-discovery-engine.ts', ['InstitutionalPatternDiscoveryEngine', 'PATTERN_SUPPORTS_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
  ['226', 'LearningWeightAdjustment', 'src/domain/learning-weight-adjustment/learning-weight-adjustment-engine.ts', ['LearningWeightAdjustmentEngine', 'WEIGHTS_SUPPORT_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
  ['227', 'LearningConfidenceValidation', 'src/domain/learning-confidence-validation/learning-confidence-validation-engine.ts', ['LearningConfidenceValidationEngine', 'LEARNING_TRUSTED', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
  ['228', 'InstitutionalRecommendation', 'src/domain/institutional-recommendation/institutional-recommendation-engine.ts', ['InstitutionalRecommendationEngine', 'PAPER_FAVORAVEL', 'OBSERVAR', 'NAO_UTILIZAR', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
  ['229', 'InstitutionalRecommendationTraceBridge', 'src/domain/institutional-recommendation-trace-bridge/institutional-recommendation-trace-bridge.ts', ['InstitutionalRecommendationTraceBridge', 'BRIDGE_TRACE_READY', 'LEDGER_EVENT_CREATED', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
  ['230', 'InstitutionalReadinessReviewV2', 'src/domain/institutional-readiness-review-v2/institutional-readiness-review-v2.ts', ['InstitutionalReadinessReviewV2', 'PAPER_READY', 'NEEDS_REVIEW', 'BLOCKED', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true']],
];

const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('Sprint 220–230 official JS coverage guard: all institutional source files exist', () => {
  for (const [, , source] of modules) {
    assert.equal(existsSync(join(root, source)), true, `${source} must exist`);
  }
});

for (const [sprint, name, source, expectedTokens] of modules) {
  test(`Sprint ${sprint}: ${name} official JS guard validates institutional contract`, () => {
    const content = read(source);

    for (const token of expectedTokens) {
      assert.equal(content.includes(token), true, `${source} must include ${token}`);
    }
  });
}

for (const [sprint, name, source] of modules) {
  test(`Sprint ${sprint}: ${name} keeps Result/Either-style branches`, () => {
    const content = read(source);

    assert.equal(content.includes('readonly ok: true'), true, `${source} must expose ok:true`);
    assert.equal(content.includes('readonly ok: false'), true, `${source} must expose ok:false`);
  });
}

test('Sprint 220–230 official JS coverage guard: no live-money flag is introduced', () => {
  for (const [, , source] of modules) {
    const content = read(source);

    assert.equal(content.includes('productionMoneyAllowed: true'), false, `${source} must not allow production money`);
    assert.equal(content.includes('liveMoneyAuthorization: true'), false, `${source} must not authorize live money`);
  }
});
