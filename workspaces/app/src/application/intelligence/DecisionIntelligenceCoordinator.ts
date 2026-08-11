import { IDecisionIntelligenceEngine } from '../../domain/contracts/IDecisionIntelligenceEngine';
import { IProbabilityEngine } from '../../domain/contracts/IProbabilityEngine';
import { IEntropyEngine } from '../../domain/contracts/IEntropyEngine';
import { IZScoreEngine } from '../../domain/contracts/IZScoreEngine';
import { IVixEngine } from '../../domain/contracts/IVixEngine';
import { IStrategyRankingEngine } from '../../domain/contracts/IStrategyRankingEngine';
import { DecisionContext } from '../../domain/intelligence/DecisionContext';
import { DecisionResult } from '../../domain/intelligence/DecisionResult';
import { DecisionRecommendation } from '../../domain/intelligence/DecisionRecommendation';
import { DecisionIntelligenceEngine } from '../../domain/intelligence/decision/DecisionIntelligenceEngine';

export class DecisionIntelligenceCoordinator {
  private readonly decisionEngine: IDecisionIntelligenceEngine;

  constructor(
    private readonly probabilityEngine: IProbabilityEngine,
    private readonly entropyEngine: IEntropyEngine,
    private readonly zScoreEngine: IZScoreEngine,
    private readonly vixEngine: IVixEngine,
    private readonly strategyRankingEngine: IStrategyRankingEngine
  ) {
    this.decisionEngine = new DecisionIntelligenceEngine(
      this.probabilityEngine,
      this.entropyEngine,
      this.vixEngine,
      this.zScoreEngine,
      this.strategyRankingEngine
    );
  }

  public analyze(context: DecisionContext): DecisionResult {
    const summary = this.decisionEngine.analyze(context);

    // Placeholder baseline logic for Sprint 004 structure
    const recommendation: DecisionRecommendation = {
      action: 'OBSERVE',
      confidenceLevel: summary.globalConfidence,
      rationale: 'System in baseline mode. Insufficient anomaly detection for entry.'
    };

    return {
      contextId: context.sessionId,
      timestamp: summary.processingMetadata.timestamp,
      recommendation,
      metrics: {
        probabilityData: summary.probabilitySummary.value,
        entropyValue: summary.entropySummary.value,
        zScoreValue: summary.zScoreSummary.value,
        vixValue: summary.vixSummary.value,
        strategyRankings: summary.rankingSummary.value
      }
    };
  }
}
