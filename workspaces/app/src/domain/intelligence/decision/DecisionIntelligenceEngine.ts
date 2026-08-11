import { IDecisionIntelligenceEngine } from '../../contracts/IDecisionIntelligenceEngine';
import { IQuantitativeEngine } from '../../contracts/IQuantitativeEngine';
import { IProbabilityEngine } from '../../contracts/IProbabilityEngine';
import { IEntropyEngine } from '../../contracts/IEntropyEngine';
import { IVixEngine } from '../../contracts/IVixEngine';
import { IZScoreEngine } from '../../contracts/IZScoreEngine';
import { IStrategyRankingEngine } from '../../contracts/IStrategyRankingEngine';
import { DecisionContext } from '../DecisionContext';
import { QuantitativeInput } from '../common/QuantitativeInput';
import { QuantitativeOutput } from '../common/QuantitativeOutput';
import { DecisionSummary } from './DecisionSummary';
import { DecisionAnalysis } from './DecisionAnalysis';

export class DecisionIntelligenceEngine implements IDecisionIntelligenceEngine, IQuantitativeEngine {
  public readonly engineName = 'DecisionIntelligenceEngine';

  constructor(
    private readonly probabilityEngine: IProbabilityEngine,
    private readonly entropyEngine: IEntropyEngine,
    private readonly vixEngine: IVixEngine,
    private readonly zScoreEngine: IZScoreEngine,
    private readonly strategyRankingEngine: IStrategyRankingEngine
  ) {}

  public execute(input: QuantitativeInput): QuantitativeOutput {
    const startTime = Date.now();
    const context: DecisionContext = {
      sessionId: input.sessionId,
      timestamp: input.timestamp,
      recentHistory: input.recentSpins,
      activeStrategies: input.executionParameters?.activeStrategies || []
    };

    const summary = this.analyze(context);
    const durationMs = Date.now() - startTime;

    return {
      engineName: this.engineName,
      score: summary.globalConfidence * 100,
      confidence: summary.globalConfidence,
      executionTime: durationMs,
      metadata: {
        durationMs,
        version: '1.0.0',
        algorithmName: 'Decision Consolidation',
        status: summary.processingMetadata.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        messages: []
      },
      diagnostics: summary.diagnostics
    };
  }

  public analyze(context: DecisionContext): DecisionSummary {
    const startTime = Date.now();
    
    // Aggregation of results is O(1) - simple assignment
    let probabilitySummary: DecisionAnalysis = this.createEmptyAnalysis('MarkovProbabilityEngine');
    let entropySummary: DecisionAnalysis = this.createEmptyAnalysis('ShannonEntropyEngine');
    let vixSummary: DecisionAnalysis = this.createEmptyAnalysis('OperationalVixEngine');
    let zScoreSummary: DecisionAnalysis = this.createEmptyAnalysis('ZScoreEngine');
    let rankingSummary: DecisionAnalysis = this.createEmptyAnalysis('StrategyRankingEngine');

    let successCount = 0;
    let totalConfidence = 0;
    const diagnostics: Record<string, unknown> = {};

    try {
      const probData = this.probabilityEngine.calculateProbabilities(context);
      probabilitySummary = {
        engineName: 'MarkovProbabilityEngine',
        status: 'SUCCESS',
        score: probData?.highestProbability || 0,
        value: probData,
        messages: []
      };
      successCount++;
      totalConfidence += 1;
      diagnostics.probability = probData;
    } catch (e) {
      probabilitySummary.messages.push(e instanceof Error ? e.message : 'Unknown Error');
    }

    try {
      const entropy = this.entropyEngine.calculateEntropy(context);
      entropySummary = {
        engineName: 'ShannonEntropyEngine',
        status: 'SUCCESS',
        score: entropy,
        value: entropy,
        messages: []
      };
      successCount++;
      totalConfidence += 1;
      diagnostics.entropy = entropy;
    } catch (e) {
      entropySummary.messages.push(e instanceof Error ? e.message : 'Unknown Error');
    }

    try {
      const vix = this.vixEngine.calculateVix(context);
      vixSummary = {
        engineName: 'OperationalVixEngine',
        status: 'SUCCESS',
        score: vix,
        value: vix,
        messages: []
      };
      successCount++;
      totalConfidence += 1;
      diagnostics.vix = vix;
    } catch (e) {
      vixSummary.messages.push(e instanceof Error ? e.message : 'Unknown Error');
    }

    try {
      const zScore = this.zScoreEngine.calculateZScore(context);
      zScoreSummary = {
        engineName: 'ZScoreEngine',
        status: 'SUCCESS',
        score: zScore,
        value: zScore,
        messages: []
      };
      successCount++;
      totalConfidence += 1;
      diagnostics.zScore = zScore;
    } catch (e) {
      zScoreSummary.messages.push(e instanceof Error ? e.message : 'Unknown Error');
    }

    try {
      const ranking = this.strategyRankingEngine.rankStrategies(context);
      rankingSummary = {
        engineName: 'StrategyRankingEngine',
        status: 'SUCCESS',
        score: ranking.bestCandidate ? ranking.orderedStrategies[0].finalScore : 0,
        value: ranking,
        messages: []
      };
      successCount++;
      totalConfidence += 1;
      diagnostics.ranking = ranking;
    } catch (e) {
      rankingSummary.messages.push(e instanceof Error ? e.message : 'Unknown Error');
    }

    const durationMs = Date.now() - startTime;
    const status = successCount === 5 ? 'SUCCESS' : (successCount > 0 ? 'PARTIAL' : 'FAILED');
    const globalConfidence = successCount > 0 ? (totalConfidence / 5) : 0;

    return {
      probabilitySummary,
      entropySummary,
      vixSummary,
      zScoreSummary,
      rankingSummary,
      globalConfidence: this.normalizeValue(globalConfidence),
      processingMetadata: {
        durationMs,
        timestamp: new Date().toISOString(),
        status
      },
      diagnostics
    };
  }

  private createEmptyAnalysis(engineName: string): DecisionAnalysis {
    return {
      engineName,
      status: 'FAILED',
      score: 0,
      value: null,
      messages: []
    };
  }

  private normalizeValue(val: number): number {
    if (Number.isNaN(val) || !Number.isFinite(val)) return 0;
    return val;
  }
}
