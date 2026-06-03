'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DECISIONS,
  InstitutionalLearningGovernanceSnapshotEngine,
} = require('../../../src/domain/learning/InstitutionalLearningGovernanceSnapshotEngine');

function createReadyInput() {
  return {
    sessionId: 'session-234',
    tableId: 'table-alpha',
    strategyId: 'fusion',
    memoryConfidence: 0.91,
    knowledgeGraphCoverage: 0.84,
    contextSimilarityConfidence: 0.88,
    outcomeCorrelationConfidence: 0.86,
    learningWeightStability: 0.9,
    recommendationReadiness: 0.82,
    evidence: [
      { id: 'ev-1', source: 'memory-layer', category: 'memory', confidence: 0.88 },
      { id: 'ev-2', source: 'knowledge-graph', category: 'graph', confidence: 0.84 },
      { id: 'ev-3', source: 'correlation', category: 'outcome', confidence: 0.86 },
      { id: 'ev-4', source: 'recommendation', category: 'recommendation', confidence: 0.82 },
    ],
  };
}

test('creates PAPER learning snapshot with immutable institutional safety flags', () => {
  const engine = new InstitutionalLearningGovernanceSnapshotEngine();
  const snapshot = engine.createSnapshot(createReadyInput());

  assert.equal(snapshot.sprint, 234);
  assert.equal(snapshot.engine, 'InstitutionalLearningGovernanceSnapshotEngine');
  assert.equal(snapshot.decision, DECISIONS.PAPER_LEARNING_READY);
  assert.equal(snapshot.institutionalFlags.paperOnly, true);
  assert.equal(snapshot.institutionalFlags.productionMoneyAllowed, false);
  assert.equal(snapshot.institutionalFlags.liveMoneyAuthorization, false);
  assert.equal(snapshot.institutionalFlags.automaticExecutionAllowed, false);
  assert.equal(snapshot.institutionalFlags.humanSupervisionRequired, true);
  assert.equal(snapshot.checksum.length, 64);
  assert.equal(snapshot.blockers.length, 0);
});

test('deduplicates evidence by id while preserving first occurrence', () => {
  const engine = new InstitutionalLearningGovernanceSnapshotEngine();
  const input = createReadyInput();

  input.evidence.push({
    id: 'ev-2',
    source: 'duplicate-source',
    category: 'duplicate',
    confidence: 0.01,
  });

  const snapshot = engine.createSnapshot(input);

  assert.equal(snapshot.evidenceCount, 4);
  assert.equal(snapshot.evidence[1].source, 'knowledge-graph');
});

test('blocks learning when evidence is insufficient', () => {
  const engine = new InstitutionalLearningGovernanceSnapshotEngine();
  const input = createReadyInput();

  input.evidence = [
    { id: 'ev-1', source: 'memory-layer', category: 'memory', confidence: 0.91 },
  ];

  const snapshot = engine.createSnapshot(input);

  assert.equal(snapshot.decision, DECISIONS.BLOCK_LEARNING);
  assert.ok(snapshot.blockers.includes('INSUFFICIENT_LEARNING_EVIDENCE'));
});

test('blocks learning when evidence confidence is low', () => {
  const engine = new InstitutionalLearningGovernanceSnapshotEngine();
  const input = createReadyInput();

  input.memoryConfidence = 0.44;
  input.knowledgeGraphCoverage = 0.41;
  input.contextSimilarityConfidence = 0.43;
  input.outcomeCorrelationConfidence = 0.42;
  input.learningWeightStability = 0.45;
  input.recommendationReadiness = 0.4;
  input.evidence = [
    { id: 'ev-1', source: 'memory-layer', category: 'memory', confidence: 0.25 },
    { id: 'ev-2', source: 'knowledge-graph', category: 'graph', confidence: 0.31 },
    { id: 'ev-3', source: 'correlation', category: 'outcome', confidence: 0.29 },
  ];

  const snapshot = engine.createSnapshot(input);

  assert.equal(snapshot.decision, DECISIONS.BLOCK_LEARNING);
  assert.ok(snapshot.blockers.includes('LOW_EVIDENCE_CONFIDENCE'));
  assert.ok(snapshot.blockers.includes('LOW_LEARNING_GOVERNANCE_SCORE'));
});

test('returns deterministic checksum for equivalent payloads', () => {
  const engine = new InstitutionalLearningGovernanceSnapshotEngine();
  const first = engine.createSnapshot(createReadyInput());
  const second = engine.createSnapshot(createReadyInput());

  assert.equal(first.checksum, second.checksum);
});

test('rejects invalid unit metrics with fail-fast validation', () => {
  const engine = new InstitutionalLearningGovernanceSnapshotEngine();
  const input = createReadyInput();

  input.memoryConfidence = 1.2;

  assert.throws(
    () => engine.createSnapshot(input),
    /input\.memoryConfidence must be between 0 and 1/
  );
});

test('rejects empty identifiers', () => {
  const engine = new InstitutionalLearningGovernanceSnapshotEngine();
  const input = createReadyInput();

  input.sessionId = '   ';

  assert.throws(
    () => engine.createSnapshot(input),
    /input\.sessionId must not be empty/
  );
});

test('rejects invalid threshold ordering', () => {
  assert.throws(
    () => new InstitutionalLearningGovernanceSnapshotEngine({
      readyScore: 0.5,
      observeScore: 0.7,
    }),
    /thresholds\.observeScore must be less than or equal to thresholds\.readyScore/
  );
});
