'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NODE_TYPES,
  EDGE_TYPES,
  GRAPH_DECISIONS,
  InstitutionalKnowledgeGraphCoreEngine,
} = require('../../../src/domain/knowledge/InstitutionalKnowledgeGraphCoreEngine');

function createReadyInput() {
  return {
    sessionId: 'session-236',
    nodes: [
      { id: 'table-alpha', type: NODE_TYPES.TABLE, label: 'Table Alpha', confidence: 0.88 },
      { id: 'fusion', type: NODE_TYPES.STRATEGY, label: 'Fusion', confidence: 0.87 },
      { id: 'operator-main', type: NODE_TYPES.OPERATOR, label: 'Operator Main', confidence: 0.86 },
      { id: 'risk-controlled', type: NODE_TYPES.RISK, label: 'Risk Controlled', confidence: 0.9 },
      { id: 'context-strong', type: NODE_TYPES.CONTEXT, label: 'Strong Context', confidence: 0.84 },
      { id: 'consensus-high', type: NODE_TYPES.CONSENSUS, label: 'High Consensus', confidence: 0.89 },
      { id: 'outcome-paper', type: NODE_TYPES.OUTCOME, label: 'Paper Outcome', confidence: 0.82 },
    ],
    edges: [
      { id: 'edge-1', from: 'context-strong', to: 'table-alpha', type: EDGE_TYPES.OBSERVED_AT, weight: 0.86 },
      { id: 'edge-2', from: 'context-strong', to: 'fusion', type: EDGE_TYPES.USES_STRATEGY, weight: 0.88 },
      { id: 'edge-3', from: 'context-strong', to: 'operator-main', type: EDGE_TYPES.OPERATED_BY, weight: 0.82 },
      { id: 'edge-4', from: 'context-strong', to: 'risk-controlled', type: EDGE_TYPES.HAS_RISK_PROFILE, weight: 0.9 },
      { id: 'edge-5', from: 'context-strong', to: 'consensus-high', type: EDGE_TYPES.HAS_CONSENSUS, weight: 0.89 },
      { id: 'edge-6', from: 'context-strong', to: 'outcome-paper', type: EDGE_TYPES.PRODUCED_OUTCOME, weight: 0.8 },
    ],
  };
}

test('creates a deterministic institutional knowledge graph snapshot', () => {
  const engine = new InstitutionalKnowledgeGraphCoreEngine();

  const first = engine.createSnapshot(createReadyInput());
  const second = engine.createSnapshot(createReadyInput());

  assert.equal(first.decision, GRAPH_DECISIONS.GRAPH_READY);
  assert.equal(first.nodesCount, 7);
  assert.equal(first.edgesCount, 6);
  assert.equal(first.invalidEdgesCount, 0);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.checksum.length, 64);
});

test('enforces permanent institutional safety flags', () => {
  const engine = new InstitutionalKnowledgeGraphCoreEngine();
  const snapshot = engine.createSnapshot(createReadyInput());

  assert.equal(snapshot.institutionalFlags.paperOnly, true);
  assert.equal(snapshot.institutionalFlags.productionMoneyAllowed, false);
  assert.equal(snapshot.institutionalFlags.liveMoneyAuthorization, false);
  assert.equal(snapshot.institutionalFlags.automaticExecutionAllowed, false);
  assert.equal(snapshot.institutionalFlags.humanSupervisionRequired, true);
});

test('deduplicates nodes and edges by id preserving first valid occurrence', () => {
  const engine = new InstitutionalKnowledgeGraphCoreEngine();
  const input = createReadyInput();

  input.nodes.push({ id: 'fusion', type: NODE_TYPES.STRATEGY, label: 'Duplicate Fusion', confidence: 0.1 });
  input.edges.push({ id: 'edge-2', from: 'context-strong', to: 'fusion', type: EDGE_TYPES.RELATED_TO, weight: 0.1 });

  const snapshot = engine.createSnapshot(input);

  assert.equal(snapshot.nodesCount, 7);
  assert.equal(snapshot.edgesCount, 6);
  assert.equal(snapshot.nodes.find((node) => node.id === 'fusion').label, 'Fusion');
  assert.equal(snapshot.edges.find((edge) => edge.id === 'edge-2').type, EDGE_TYPES.USES_STRATEGY);
});

test('blocks graph when relationships point to missing nodes', () => {
  const engine = new InstitutionalKnowledgeGraphCoreEngine();
  const input = createReadyInput();

  input.edges.push({
    id: 'invalid-edge',
    from: 'context-strong',
    to: 'missing-node',
    type: EDGE_TYPES.RELATED_TO,
    weight: 0.7,
  });

  const snapshot = engine.createSnapshot(input);

  assert.equal(snapshot.decision, GRAPH_DECISIONS.GRAPH_BLOCKED);
  assert.equal(snapshot.invalidEdgesCount, 1);
  assert.ok(snapshot.blockers.includes('GRAPH_HAS_INVALID_EDGES'));
});

test('blocks graph when there are insufficient nodes', () => {
  const engine = new InstitutionalKnowledgeGraphCoreEngine();
  const input = createReadyInput();

  input.nodes = input.nodes.slice(0, 3);
  input.edges = [];

  const snapshot = engine.createSnapshot(input);

  assert.equal(snapshot.decision, GRAPH_DECISIONS.GRAPH_BLOCKED);
  assert.ok(snapshot.blockers.includes('INSUFFICIENT_GRAPH_NODES'));
  assert.ok(snapshot.blockers.includes('INSUFFICIENT_GRAPH_EDGES'));
});

test('returns observe decision for valid graph with moderate confidence', () => {
  const engine = new InstitutionalKnowledgeGraphCoreEngine();
  const input = createReadyInput();

  input.nodes = input.nodes.map((node) => Object.assign({}, node, { confidence: 0.62 }));
  input.edges = input.edges.map((edge) => Object.assign({}, edge, { weight: 0.61 }));

  const snapshot = engine.createSnapshot(input);

  assert.equal(snapshot.decision, GRAPH_DECISIONS.GRAPH_OBSERVE);
  assert.equal(snapshot.blockers.length, 0);
});

test('validates unsupported node type', () => {
  const engine = new InstitutionalKnowledgeGraphCoreEngine();
  const input = createReadyInput();

  input.nodes[0] = {
    id: 'bad-node',
    type: 'UNSUPPORTED',
    label: 'Bad Node',
    confidence: 0.8,
  };

  assert.throws(
    () => engine.createSnapshot(input),
    /nodes\[0\]\.type is not supported/
  );
});

test('validates unit confidence ranges', () => {
  const engine = new InstitutionalKnowledgeGraphCoreEngine();
  const input = createReadyInput();

  input.nodes[0] = {
    id: 'table-alpha',
    type: NODE_TYPES.TABLE,
    label: 'Table Alpha',
    confidence: 1.2,
  };

  assert.throws(
    () => engine.createSnapshot(input),
    /nodes\[0\]\.confidence must be between 0 and 1/
  );
});

test('validates threshold ordering', () => {
  assert.throws(
    () => new InstitutionalKnowledgeGraphCoreEngine({
      minimumAverageConfidence: 0.9,
      readyAverageConfidence: 0.7,
    }),
    /thresholds\.minimumAverageConfidence must be less than or equal to thresholds\.readyAverageConfidence/
  );
});
