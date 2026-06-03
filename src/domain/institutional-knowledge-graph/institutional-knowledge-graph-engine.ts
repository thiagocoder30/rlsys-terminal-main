export type KnowledgeGraphNodeType =
  | 'SESSION'
  | 'CONTEXT'
  | 'STRATEGY'
  | 'TABLE'
  | 'OPERATOR'
  | 'RISK'
  | 'CONSENSUS'
  | 'CONFIDENCE'
  | 'DECISION'
  | 'OUTCOME';

export type KnowledgeGraphEdgeType =
  | 'OBSERVED_IN'
  | 'USED_STRATEGY'
  | 'OCCURRED_ON_TABLE'
  | 'CONTROLLED_BY_OPERATOR'
  | 'HAS_RISK'
  | 'HAS_CONSENSUS'
  | 'HAS_CONFIDENCE'
  | 'PRODUCED_DECISION'
  | 'RESULTED_IN'
  | 'RELATED_TO_CONTEXT';

export type KnowledgeGraphStatus =
  | 'GRAPH_SUPPORTS_PAPER'
  | 'GRAPH_NEUTRAL'
  | 'GRAPH_DEGRADED'
  | 'GRAPH_BLOCKED';

export type KnowledgeGraphReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'GRAPH_EMPTY'
  | 'GRAPH_CONNECTED'
  | 'GRAPH_HAS_ISOLATED_NODES'
  | 'GRAPH_HAS_BLOCKERS'
  | 'GRAPH_LOW_EVIDENCE'
  | 'GRAPH_SUPPORTIVE_EVIDENCE'
  | 'GRAPH_DEGRADED_EVIDENCE'
  | 'POLICY_LOCK_ACTIVE';

export interface KnowledgeGraphNode {
  readonly nodeId: string;
  readonly type: KnowledgeGraphNodeType;
  readonly label: string;
  readonly score: number;
  readonly blocker: boolean;
}

export interface KnowledgeGraphEdge {
  readonly edgeId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly type: KnowledgeGraphEdgeType;
  readonly weight: number;
}

export interface KnowledgeGraphInput {
  readonly graphId: string;
  readonly nodes: readonly KnowledgeGraphNode[];
  readonly edges: readonly KnowledgeGraphEdge[];
}

export interface KnowledgeGraphPolicy {
  readonly minimumSupportScore: number;
  readonly minimumNeutralScore: number;
  readonly maximumIsolatedNodeRate: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface KnowledgeGraphReport {
  readonly graphId: string;
  readonly status: KnowledgeGraphStatus;
  readonly graphScore: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly isolatedNodeCount: number;
  readonly isolatedNodeRate: number;
  readonly blockerNodeCount: number;
  readonly reasons: readonly KnowledgeGraphReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface KnowledgeGraphFailure {
  readonly code: 'INVALID_KNOWLEDGE_GRAPH_INPUT';
  readonly message: string;
}

export type KnowledgeGraphResult =
  | {
      readonly ok: true;
      readonly value: KnowledgeGraphReport;
    }
  | {
      readonly ok: false;
      readonly error: KnowledgeGraphFailure;
    };

const DEFAULT_POLICY: KnowledgeGraphPolicy = Object.freeze({
  minimumSupportScore: 0.72,
  minimumNeutralScore: 0.48,
  maximumIsolatedNodeRate: 0.25,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const clamp01 = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

const safeRatio = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

export class InstitutionalKnowledgeGraphEngine {
  private readonly policy: KnowledgeGraphPolicy;

  public constructor(policy: KnowledgeGraphPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumSupportScore: policy.minimumSupportScore,
      minimumNeutralScore: policy.minimumNeutralScore,
      maximumIsolatedNodeRate: policy.maximumIsolatedNodeRate,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Evaluates an institutional knowledge graph in O(n + e).
   * The engine is pure, deterministic, idempotent and PAPER-only.
   */
  public evaluate(input: KnowledgeGraphInput): KnowledgeGraphResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const connectedNodeIds = this.collectConnectedNodeIds(input.edges);
    const isolatedNodeCount = this.countIsolatedNodes(input.nodes, connectedNodeIds);
    const blockerNodeCount = this.countBlockerNodes(input.nodes);
    const graphScore = this.calculateGraphScore(input.nodes, input.edges, isolatedNodeCount, blockerNodeCount);
    const isolatedNodeRate = safeRatio(isolatedNodeCount, input.nodes.length);
    const reasons = this.resolveReasons(input.nodes.length, graphScore, isolatedNodeRate, blockerNodeCount);
    const status = this.resolveStatus(input.nodes.length, graphScore, isolatedNodeRate, blockerNodeCount);

    return {
      ok: true,
      value: Object.freeze({
        graphId: input.graphId,
        status,
        graphScore,
        nodeCount: input.nodes.length,
        edgeCount: input.edges.length,
        isolatedNodeCount,
        isolatedNodeRate,
        blockerNodeCount,
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private collectConnectedNodeIds(
    edges: readonly KnowledgeGraphEdge[],
  ): ReadonlySet<string> {
    const connectedNodeIds = new Set<string>();

    for (const edge of edges) {
      connectedNodeIds.add(edge.fromNodeId);
      connectedNodeIds.add(edge.toNodeId);
    }

    return connectedNodeIds;
  }

  private countIsolatedNodes(
    nodes: readonly KnowledgeGraphNode[],
    connectedNodeIds: ReadonlySet<string>,
  ): number {
    let isolatedNodeCount = 0;

    for (const node of nodes) {
      if (!connectedNodeIds.has(node.nodeId)) {
        isolatedNodeCount += 1;
      }
    }

    return isolatedNodeCount;
  }

  private countBlockerNodes(nodes: readonly KnowledgeGraphNode[]): number {
    let blockerNodeCount = 0;

    for (const node of nodes) {
      if (node.blocker) {
        blockerNodeCount += 1;
      }
    }

    return blockerNodeCount;
  }

  private calculateGraphScore(
    nodes: readonly KnowledgeGraphNode[],
    edges: readonly KnowledgeGraphEdge[],
    isolatedNodeCount: number,
    blockerNodeCount: number,
  ): number {
    if (nodes.length === 0) {
      return 0;
    }

    let nodeScoreSum = 0;

    for (const node of nodes) {
      nodeScoreSum += node.score;
    }

    let edgeWeightSum = 0;

    for (const edge of edges) {
      edgeWeightSum += edge.weight;
    }

    const averageNodeScore = safeRatio(nodeScoreSum, nodes.length);
    const connectivityScore = 1 - safeRatio(isolatedNodeCount, nodes.length);
    const edgeDensityScore = clamp01(safeRatio(edgeWeightSum, nodes.length));
    const blockerPenalty = blockerNodeCount > 0 ? 0.35 : 0;

    return round4(
      clamp01(
        averageNodeScore * 0.45 +
          connectivityScore * 0.3 +
          edgeDensityScore * 0.25 -
          blockerPenalty,
      ),
    );
  }

  private resolveStatus(
    nodeCount: number,
    graphScore: number,
    isolatedNodeRate: number,
    blockerNodeCount: number,
  ): KnowledgeGraphStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'GRAPH_BLOCKED';
    }

    if (nodeCount === 0) {
      return 'GRAPH_NEUTRAL';
    }

    if (blockerNodeCount > 0) {
      return 'GRAPH_BLOCKED';
    }

    if (isolatedNodeRate > this.policy.maximumIsolatedNodeRate) {
      return 'GRAPH_DEGRADED';
    }

    if (graphScore >= this.policy.minimumSupportScore) {
      return 'GRAPH_SUPPORTS_PAPER';
    }

    if (graphScore >= this.policy.minimumNeutralScore) {
      return 'GRAPH_NEUTRAL';
    }

    return 'GRAPH_DEGRADED';
  }

  private resolveReasons(
    nodeCount: number,
    graphScore: number,
    isolatedNodeRate: number,
    blockerNodeCount: number,
  ): KnowledgeGraphReason[] {
    const reasons: KnowledgeGraphReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (nodeCount === 0) {
      reasons.push('GRAPH_EMPTY');
      return reasons;
    }

    if (isolatedNodeRate === 0) {
      reasons.push('GRAPH_CONNECTED');
    }

    if (isolatedNodeRate > 0) {
      reasons.push('GRAPH_HAS_ISOLATED_NODES');
    }

    if (blockerNodeCount > 0) {
      reasons.push('GRAPH_HAS_BLOCKERS');
    }

    if (graphScore >= this.policy.minimumSupportScore) {
      reasons.push('GRAPH_SUPPORTIVE_EVIDENCE');
    } else if (graphScore >= this.policy.minimumNeutralScore) {
      reasons.push('GRAPH_LOW_EVIDENCE');
    } else {
      reasons.push('GRAPH_DEGRADED_EVIDENCE');
    }

    return reasons;
  }

  private validate(input: KnowledgeGraphInput): KnowledgeGraphFailure | null {
    if (input.graphId.trim().length === 0) {
      return {
        code: 'INVALID_KNOWLEDGE_GRAPH_INPUT',
        message: 'graphId must not be empty',
      };
    }

    if (this.policy.maximumIsolatedNodeRate < 0 || this.policy.maximumIsolatedNodeRate > 1) {
      return {
        code: 'INVALID_KNOWLEDGE_GRAPH_INPUT',
        message: 'maximumIsolatedNodeRate must be between 0 and 1',
      };
    }

    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    for (const node of input.nodes) {
      if (node.nodeId.trim().length === 0) {
        return {
          code: 'INVALID_KNOWLEDGE_GRAPH_INPUT',
          message: 'nodeId must not be empty',
        };
      }

      if (nodeIds.has(node.nodeId)) {
        return {
          code: 'INVALID_KNOWLEDGE_GRAPH_INPUT',
          message: 'duplicate nodeId detected',
        };
      }

      nodeIds.add(node.nodeId);

      if (node.label.trim().length === 0) {
        return {
          code: 'INVALID_KNOWLEDGE_GRAPH_INPUT',
          message: 'node label must not be empty',
        };
      }

      if (node.score < 0 || node.score > 1 || !Number.isFinite(node.score)) {
        return {
          code: 'INVALID_KNOWLEDGE_GRAPH_INPUT',
          message: 'node score must be between 0 and 1',
        };
      }
    }

    for (const edge of input.edges) {
      if (edge.edgeId.trim().length === 0) {
        return {
          code: 'INVALID_KNOWLEDGE_GRAPH_INPUT',
          message: 'edgeId must not be empty',
        };
      }

      if (edgeIds.has(edge.edgeId)) {
        return {
          code: 'INVALID_KNOWLEDGE_GRAPH_INPUT',
          message: 'duplicate edgeId detected',
        };
      }

      edgeIds.add(edge.edgeId);

      if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
        return {
          code: 'INVALID_KNOWLEDGE_GRAPH_INPUT',
          message: 'edge endpoints must reference existing nodes',
        };
      }

      if (edge.weight < 0 || edge.weight > 1 || !Number.isFinite(edge.weight)) {
        return {
          code: 'INVALID_KNOWLEDGE_GRAPH_INPUT',
          message: 'edge weight must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
