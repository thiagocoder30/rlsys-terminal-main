'use strict';

const crypto = require('crypto');

const NODE_TYPES = Object.freeze({
  TABLE: 'TABLE',
  STRATEGY: 'STRATEGY',
  OPERATOR: 'OPERATOR',
  RISK: 'RISK',
  CONTEXT: 'CONTEXT',
  CONSENSUS: 'CONSENSUS',
  OUTCOME: 'OUTCOME',
});

const EDGE_TYPES = Object.freeze({
  OBSERVED_AT: 'OBSERVED_AT',
  USES_STRATEGY: 'USES_STRATEGY',
  OPERATED_BY: 'OPERATED_BY',
  HAS_RISK_PROFILE: 'HAS_RISK_PROFILE',
  HAS_CONTEXT: 'HAS_CONTEXT',
  HAS_CONSENSUS: 'HAS_CONSENSUS',
  PRODUCED_OUTCOME: 'PRODUCED_OUTCOME',
  RELATED_TO: 'RELATED_TO',
});

const GRAPH_DECISIONS = Object.freeze({
  GRAPH_READY: 'GRAPH_READY',
  GRAPH_OBSERVE: 'GRAPH_OBSERVE',
  GRAPH_BLOCKED: 'GRAPH_BLOCKED',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  minimumNodes: 5,
  minimumEdges: 4,
  minimumAverageConfidence: 0.52,
  readyAverageConfidence: 0.78,
});

function normalizeText(value, fieldName) {
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a string`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new RangeError(`${fieldName} must not be empty`);
  }

  return normalized;
}

function assertUnit(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${fieldName} must be a finite number`);
  }

  if (value < 0 || value > 1) {
    throw new RangeError(`${fieldName} must be between 0 and 1`);
  }
}

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${fieldName} must be a positive integer`);
  }
}

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
  return `{${pairs.join(',')}}`;
}

function checksumOf(payload) {
  return crypto
    .createHash('sha256')
    .update(stableSerialize(payload))
    .digest('hex');
}

function normalizeNode(node, index) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    throw new TypeError(`nodes[${index}] must be an object`);
  }

  const id = normalizeText(node.id, `nodes[${index}].id`);
  const type = normalizeText(node.type, `nodes[${index}].type`);
  const label = normalizeText(node.label, `nodes[${index}].label`);
  assertUnit(node.confidence, `nodes[${index}].confidence`);

  if (!Object.prototype.hasOwnProperty.call(NODE_TYPES, type)) {
    throw new RangeError(`nodes[${index}].type is not supported`);
  }

  return Object.freeze({
    id,
    type,
    label,
    confidence: node.confidence,
  });
}

function normalizeEdge(edge, index) {
  if (edge === null || typeof edge !== 'object' || Array.isArray(edge)) {
    throw new TypeError(`edges[${index}] must be an object`);
  }

  const id = normalizeText(edge.id, `edges[${index}].id`);
  const from = normalizeText(edge.from, `edges[${index}].from`);
  const to = normalizeText(edge.to, `edges[${index}].to`);
  const type = normalizeText(edge.type, `edges[${index}].type`);
  assertUnit(edge.weight, `edges[${index}].weight`);

  if (!Object.prototype.hasOwnProperty.call(EDGE_TYPES, type)) {
    throw new RangeError(`edges[${index}].type is not supported`);
  }

  return Object.freeze({
    id,
    from,
    to,
    type,
    weight: edge.weight,
  });
}

/**
 * Institutional Knowledge Graph Core.
 *
 * Builds a deterministic, immutable, low-memory graph snapshot from institutional
 * entities and relationships. It does not execute operations, does not authorize
 * live money, and does not bypass human supervision.
 *
 * Complexity:
 * - Time: O(n + e)
 * - Space: O(n + e)
 */
class InstitutionalKnowledgeGraphCoreEngine {
  constructor(thresholds) {
    const resolvedThresholds = Object.assign({}, DEFAULT_THRESHOLDS, thresholds || {});

    assertPositiveInteger(resolvedThresholds.minimumNodes, 'thresholds.minimumNodes');
    assertPositiveInteger(resolvedThresholds.minimumEdges, 'thresholds.minimumEdges');
    assertUnit(resolvedThresholds.minimumAverageConfidence, 'thresholds.minimumAverageConfidence');
    assertUnit(resolvedThresholds.readyAverageConfidence, 'thresholds.readyAverageConfidence');

    if (resolvedThresholds.minimumAverageConfidence > resolvedThresholds.readyAverageConfidence) {
      throw new RangeError('thresholds.minimumAverageConfidence must be less than or equal to thresholds.readyAverageConfidence');
    }

    this.thresholds = Object.freeze(resolvedThresholds);
  }

  createSnapshot(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('input must be an object');
    }

    const sessionId = normalizeText(input.sessionId, 'input.sessionId');

    if (!Array.isArray(input.nodes)) {
      throw new TypeError('input.nodes must be an array');
    }

    if (!Array.isArray(input.edges)) {
      throw new TypeError('input.edges must be an array');
    }

    const nodesById = new Map();

    for (let index = 0; index < input.nodes.length; index += 1) {
      const node = normalizeNode(input.nodes[index], index);

      if (!nodesById.has(node.id)) {
        nodesById.set(node.id, node);
      }
    }

    const edgesById = new Map();
    const invalidEdges = [];

    for (let index = 0; index < input.edges.length; index += 1) {
      const edge = normalizeEdge(input.edges[index], index);

      if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
        invalidEdges.push(edge.id);
      } else if (!edgesById.has(edge.id)) {
        edgesById.set(edge.id, edge);
      }
    }

    const nodes = Array.from(nodesById.values()).sort((left, right) => left.id.localeCompare(right.id));
    const edges = Array.from(edgesById.values()).sort((left, right) => left.id.localeCompare(right.id));

    const averageNodeConfidence = this.calculateAverageNodeConfidence(nodes);
    const averageEdgeWeight = this.calculateAverageEdgeWeight(edges);
    const graphConfidence = Number(((averageNodeConfidence * 0.6) + (averageEdgeWeight * 0.4)).toFixed(6));

    const blockers = this.resolveBlockers({
      nodesCount: nodes.length,
      edgesCount: edges.length,
      graphConfidence,
      invalidEdgesCount: invalidEdges.length,
    });

    const decision = this.resolveDecision(graphConfidence, blockers);

    const payload = Object.freeze({
      sprint: 236,
      engine: 'InstitutionalKnowledgeGraphCoreEngine',
      sessionId,
      decision,
      graphConfidence,
      nodesCount: nodes.length,
      edgesCount: edges.length,
      invalidEdgesCount: invalidEdges.length,
      averageNodeConfidence: Number(averageNodeConfidence.toFixed(6)),
      averageEdgeWeight: Number(averageEdgeWeight.toFixed(6)),
      blockers: Object.freeze(blockers),
      invalidEdges: Object.freeze(invalidEdges.slice().sort()),
      institutionalFlags: Object.freeze({
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        humanSupervisionRequired: true,
      }),
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
    });

    return Object.freeze(Object.assign({}, payload, {
      checksum: checksumOf(payload),
    }));
  }

  calculateAverageNodeConfidence(nodes) {
    if (nodes.length === 0) {
      return 0;
    }

    let total = 0;

    for (let index = 0; index < nodes.length; index += 1) {
      total += nodes[index].confidence;
    }

    return total / nodes.length;
  }

  calculateAverageEdgeWeight(edges) {
    if (edges.length === 0) {
      return 0;
    }

    let total = 0;

    for (let index = 0; index < edges.length; index += 1) {
      total += edges[index].weight;
    }

    return total / edges.length;
  }

  resolveBlockers(context) {
    const blockers = [];

    if (context.nodesCount < this.thresholds.minimumNodes) {
      blockers.push('INSUFFICIENT_GRAPH_NODES');
    }

    if (context.edgesCount < this.thresholds.minimumEdges) {
      blockers.push('INSUFFICIENT_GRAPH_EDGES');
    }

    if (context.invalidEdgesCount > 0) {
      blockers.push('GRAPH_HAS_INVALID_EDGES');
    }

    if (context.graphConfidence < this.thresholds.minimumAverageConfidence) {
      blockers.push('LOW_GRAPH_CONFIDENCE');
    }

    return blockers;
  }

  resolveDecision(graphConfidence, blockers) {
    if (blockers.length > 0) {
      return GRAPH_DECISIONS.GRAPH_BLOCKED;
    }

    if (graphConfidence >= this.thresholds.readyAverageConfidence) {
      return GRAPH_DECISIONS.GRAPH_READY;
    }

    return GRAPH_DECISIONS.GRAPH_OBSERVE;
  }
}

module.exports = {
  NODE_TYPES,
  EDGE_TYPES,
  GRAPH_DECISIONS,
  DEFAULT_THRESHOLDS,
  InstitutionalKnowledgeGraphCoreEngine,
};
