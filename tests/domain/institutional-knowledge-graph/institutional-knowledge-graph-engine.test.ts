import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstitutionalKnowledgeGraphEngine,
  type KnowledgeGraphInput,
} from '../../../src/domain/institutional-knowledge-graph/institutional-knowledge-graph-engine';

const connectedGraph: KnowledgeGraphInput = {
  graphId: 'graph-222',
  nodes: [
    {
      nodeId: 'session-001',
      type: 'SESSION',
      label: 'Paper Session',
      score: 0.9,
      blocker: false,
    },
    {
      nodeId: 'context-low-volatility',
      type: 'CONTEXT',
      label: 'Low Volatility Context',
      score: 0.84,
      blocker: false,
    },
    {
      nodeId: 'strategy-fusion',
      type: 'STRATEGY',
      label: 'Fusion Strategy',
      score: 0.86,
      blocker: false,
    },
    {
      nodeId: 'table-alpha',
      type: 'TABLE',
      label: 'Table Alpha',
      score: 0.82,
      blocker: false,
    },
    {
      nodeId: 'decision-paper',
      type: 'DECISION',
      label: 'PAPER_FAVORAVEL',
      score: 0.84,
      blocker: false,
    },
  ],
  edges: [
    {
      edgeId: 'edge-001',
      fromNodeId: 'session-001',
      toNodeId: 'context-low-volatility',
      type: 'OBSERVED_IN',
      weight: 0.9,
    },
    {
      edgeId: 'edge-002',
      fromNodeId: 'session-001',
      toNodeId: 'strategy-fusion',
      type: 'USED_STRATEGY',
      weight: 0.88,
    },
    {
      edgeId: 'edge-003',
      fromNodeId: 'session-001',
      toNodeId: 'table-alpha',
      type: 'OCCURRED_ON_TABLE',
      weight: 0.82,
    },
    {
      edgeId: 'edge-004',
      fromNodeId: 'context-low-volatility',
      toNodeId: 'decision-paper',
      type: 'PRODUCED_DECISION',
      weight: 0.84,
    },
  ],
};

describe('InstitutionalKnowledgeGraphEngine', () => {
  it('classifies connected supportive graphs as paper supportive', () => {
    const engine = new InstitutionalKnowledgeGraphEngine();
    const result = engine.evaluate(connectedGraph);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'GRAPH_SUPPORTS_PAPER');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.equal(result.value.nodeCount, 5);
      assert.equal(result.value.edgeCount, 4);
      assert.equal(result.value.isolatedNodeCount, 0);
      assert.ok(result.value.reasons.includes('GRAPH_CONNECTED'));
      assert.ok(result.value.reasons.includes('GRAPH_SUPPORTIVE_EVIDENCE'));
    }
  });

  it('degrades graphs with isolated nodes', () => {
    const engine = new InstitutionalKnowledgeGraphEngine({
      minimumSupportScore: 0.72,
      minimumNeutralScore: 0.48,
      maximumIsolatedNodeRate: 0,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    const result = engine.evaluate({
      ...connectedGraph,
      nodes: [
        ...connectedGraph.nodes,
        {
          nodeId: 'orphan-outcome',
          type: 'OUTCOME',
          label: 'Unlinked Outcome',
          score: 0.5,
          blocker: false,
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'GRAPH_DEGRADED');
      assert.ok(result.value.reasons.includes('GRAPH_HAS_ISOLATED_NODES'));
    }
  });

  it('blocks graphs with blocker nodes', () => {
    const engine = new InstitutionalKnowledgeGraphEngine();
    const result = engine.evaluate({
      ...connectedGraph,
      nodes: [
        ...connectedGraph.nodes,
        {
          nodeId: 'risk-blocked',
          type: 'RISK',
          label: 'Risk Blocked',
          score: 0.1,
          blocker: true,
        },
      ],
      edges: [
        ...connectedGraph.edges,
        {
          edgeId: 'edge-005',
          fromNodeId: 'session-001',
          toNodeId: 'risk-blocked',
          type: 'HAS_RISK',
          weight: 1,
        },
      ],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'GRAPH_BLOCKED');
      assert.ok(result.value.reasons.includes('GRAPH_HAS_BLOCKERS'));
    }
  });

  it('keeps empty graphs neutral without silent failure', () => {
    const engine = new InstitutionalKnowledgeGraphEngine();
    const result = engine.evaluate({
      graphId: 'empty-graph',
      nodes: [],
      edges: [],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'GRAPH_NEUTRAL');
      assert.ok(result.value.reasons.includes('GRAPH_EMPTY'));
    }
  });

  it('rejects edges pointing to unknown nodes', () => {
    const engine = new InstitutionalKnowledgeGraphEngine();
    const result = engine.evaluate({
      ...connectedGraph,
      edges: [
        ...connectedGraph.edges,
        {
          edgeId: 'edge-invalid',
          fromNodeId: 'session-001',
          toNodeId: 'missing-node',
          type: 'RESULTED_IN',
          weight: 0.5,
        },
      ],
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_KNOWLEDGE_GRAPH_INPUT');
    }
  });

  it('rejects duplicate node ids through Result', () => {
    const engine = new InstitutionalKnowledgeGraphEngine();
    const result = engine.evaluate({
      ...connectedGraph,
      nodes: [
        ...connectedGraph.nodes,
        {
          nodeId: 'session-001',
          type: 'SESSION',
          label: 'Duplicate Session',
          score: 0.5,
          blocker: false,
        },
      ],
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_KNOWLEDGE_GRAPH_INPUT');
    }
  });
});
