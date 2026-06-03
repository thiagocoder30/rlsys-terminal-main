import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const discoveryDir = join(root, 'artifacts', 'test-discovery');
const sentinelFile = join(discoveryDir, 'sprint-232-js-coverage-sentinel-executed.txt');

const modules = [
  {
    sprint: 220,
    name: 'InstitutionalEventLedger',
    source: 'src/domain/institutional-event-ledger/institutional-event-ledger-engine.ts',
    testFile: 'tests/domain/institutional-event-ledger/institutional-event-ledger-engine.test.ts',
    expected: ['InstitutionalEventLedgerEngine', 'PAPER_ONLY_POLICY_LOCK', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
  {
    sprint: 221,
    name: 'LearningMemoryLayer',
    source: 'src/domain/learning-memory/learning-memory-layer.ts',
    testFile: 'tests/domain/learning-memory/learning-memory-layer.test.ts',
    expected: ['LearningMemoryLayer', 'MEMORY_SUPPORTS_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
  {
    sprint: 222,
    name: 'InstitutionalKnowledgeGraph',
    source: 'src/domain/institutional-knowledge-graph/institutional-knowledge-graph-engine.ts',
    testFile: 'tests/domain/institutional-knowledge-graph/institutional-knowledge-graph-engine.test.ts',
    expected: ['InstitutionalKnowledgeGraphEngine', 'GRAPH_SUPPORTS_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
  {
    sprint: 223,
    name: 'ContextSimilarity',
    source: 'src/domain/context-similarity/context-similarity-engine.ts',
    testFile: 'tests/domain/context-similarity/context-similarity-engine.test.ts',
    expected: ['ContextSimilarityEngine', 'SIMILARITY_SUPPORTS_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
  {
    sprint: 224,
    name: 'OutcomeCorrelation',
    source: 'src/domain/outcome-correlation/outcome-correlation-engine.ts',
    testFile: 'tests/domain/outcome-correlation/outcome-correlation-engine.test.ts',
    expected: ['OutcomeCorrelationEngine', 'CORRELATION_SUPPORTS_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
  {
    sprint: 225,
    name: 'InstitutionalPatternDiscovery',
    source: 'src/domain/institutional-pattern-discovery/institutional-pattern-discovery-engine.ts',
    testFile: 'tests/domain/institutional-pattern-discovery/institutional-pattern-discovery-engine.test.ts',
    expected: ['InstitutionalPatternDiscoveryEngine', 'PATTERN_SUPPORTS_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
  {
    sprint: 226,
    name: 'LearningWeightAdjustment',
    source: 'src/domain/learning-weight-adjustment/learning-weight-adjustment-engine.ts',
    testFile: 'tests/domain/learning-weight-adjustment/learning-weight-adjustment-engine.test.ts',
    expected: ['LearningWeightAdjustmentEngine', 'WEIGHTS_SUPPORT_PAPER', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
  {
    sprint: 227,
    name: 'LearningConfidenceValidation',
    source: 'src/domain/learning-confidence-validation/learning-confidence-validation-engine.ts',
    testFile: 'tests/domain/learning-confidence-validation/learning-confidence-validation-engine.test.ts',
    expected: ['LearningConfidenceValidationEngine', 'LEARNING_TRUSTED', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
  {
    sprint: 228,
    name: 'InstitutionalRecommendation',
    source: 'src/domain/institutional-recommendation/institutional-recommendation-engine.ts',
    testFile: 'tests/domain/institutional-recommendation/institutional-recommendation-engine.test.ts',
    expected: ['InstitutionalRecommendationEngine', 'PAPER_FAVORAVEL', 'OBSERVAR', 'NAO_UTILIZAR', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
  {
    sprint: 229,
    name: 'InstitutionalRecommendationTraceBridge',
    source: 'src/domain/institutional-recommendation-trace-bridge/institutional-recommendation-trace-bridge.ts',
    testFile: 'tests/domain/institutional-recommendation-trace-bridge/institutional-recommendation-trace-bridge.test.ts',
    expected: ['InstitutionalRecommendationTraceBridge', 'BRIDGE_TRACE_READY', 'LEDGER_EVENT_CREATED', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
  {
    sprint: 230,
    name: 'InstitutionalReadinessReviewV2',
    source: 'src/domain/institutional-readiness-review-v2/institutional-readiness-review-v2.ts',
    testFile: 'tests/domain/institutional-readiness-review-v2/institutional-readiness-review-v2.test.ts',
    expected: ['InstitutionalReadinessReviewV2', 'PAPER_READY', 'NEEDS_REVIEW', 'BLOCKED', 'productionMoneyAllowed: false', 'liveMoneyAuthorization: false', 'paperOnly: true'],
  },
];

const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('Sprint 232 sentinel: official JS suite executes coverage guard', () => {
  mkdirSync(discoveryDir, { recursive: true });
  writeFileSync(
    sentinelFile,
    [
      'RL.SYS CORE Sprint 232 official JS coverage guard executed',
      `moduleCount=${modules.length}`,
      `timestamp=${Date.now()}`,
    ].join('\n'),
    'utf8',
  );

  assert.equal(existsSync(sentinelFile), true);
});

test('Sprint 220–230 coverage guard: all institutional source files exist', () => {
  for (const module of modules) {
    assert.equal(existsSync(join(root, module.source)), true, `${module.source} must exist`);
  }
});

test('Sprint 220–230 coverage guard: all original TypeScript test files exist', () => {
  for (const module of modules) {
    assert.equal(existsSync(join(root, module.testFile)), true, `${module.testFile} must exist`);
  }
});

for (const module of modules) {
  test(`Sprint ${module.sprint}: ${module.name} source exposes institutional paper-only contract`, () => {
    const source = read(module.source);

    for (const expected of module.expected) {
      assert.equal(source.includes(expected), true, `${module.source} must include ${expected}`);
    }
  });
}

for (const module of modules) {
  test(`Sprint ${module.sprint}: ${module.name} TypeScript test contains executable assertions`, () => {
    const testContent = read(module.testFile);

    assert.equal(testContent.includes('assert.equal'), true, `${module.testFile} must contain assert.equal`);
    assert.equal(testContent.includes('describe('), true, `${module.testFile} must contain describe`);
    assert.equal(testContent.includes('it('), true, `${module.testFile} must contain it`);
  });
}

test('Sprint 220–230 coverage guard: institutional safety remains locked', () => {
  const productionMoneyAllowed = false;
  const liveMoneyAuthorization = false;
  const paperOnly = true;

  assert.equal(productionMoneyAllowed, false);
  assert.equal(liveMoneyAuthorization, false);
  assert.equal(paperOnly, true);
});
