import crypto from 'crypto';
import { IExplainabilityEngine } from '../../contracts/IExplainabilityEngine';
import { DecisionSummary } from '../decision/DecisionSummary';
import { DecisionExplanation } from './DecisionExplanation';
import { DecisionEvidenceBundle } from './DecisionEvidenceBundle';
import { DecisionTransparencyReport } from './DecisionTransparencyReport';
import { DecisionReason } from './DecisionReason';
import { DecisionExplanationSection } from './DecisionExplanationSection';
import { DecisionConfidenceBreakdown } from './DecisionConfidenceBreakdown';

export class ExplainabilityEngine implements IExplainabilityEngine {
  public generateExplanation(summary: DecisionSummary): DecisionExplanation {
    const startTime = Date.now();
    const explanationId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // 1. Organize Evidence without recalculating
    const evidenceBundle: DecisionEvidenceBundle = {
      markovReferences: summary.probabilitySummary?.diagnostics || {},
      shannonReferences: summary.entropySummary?.diagnostics || {},
      vixReferences: summary.vixSummary?.diagnostics || {},
      zScoreReferences: summary.zScoreSummary?.diagnostics || {},
      strategyRankingReferences: summary.rankingSummary?.diagnostics || {}
    };

    // 2. Produce Explanatory Sections
    const sections: DecisionExplanationSection[] = [];
    if (summary.probabilitySummary) {
      sections.push({
        title: 'Probability Analysis',
        description: 'Alta concentração probabilística detectada na análise de estados.',
        sourceEngine: 'MarkovProbabilityEngine',
        confidence: summary.probabilitySummary.confidence,
        evidenceReferences: ['markovReferences']
      });
    }
    if (summary.entropySummary) {
      sections.push({
        title: 'Entropy Analysis',
        description: 'Baixa entropia indica menor dispersão estatística.',
        sourceEngine: 'ShannonEntropyEngine',
        confidence: summary.entropySummary.confidence,
        evidenceReferences: ['shannonReferences']
      });
    }
    if (summary.vixSummary) {
      sections.push({
        title: 'Risk Analysis',
        description: 'Regime operacional classificado.',
        sourceEngine: 'OperationalVixEngine',
        confidence: summary.vixSummary.confidence,
        evidenceReferences: ['vixReferences']
      });
    }
    if (summary.zScoreSummary) {
      sections.push({
        title: 'ZScore Analysis',
        description: 'Desvio estatístico identificado e categorizado.',
        sourceEngine: 'ZScoreEngine',
        confidence: summary.zScoreSummary.confidence,
        evidenceReferences: ['zScoreReferences']
      });
    }
    if (summary.rankingSummary) {
      sections.push({
        title: 'Strategy Ranking Analysis',
        description: 'Ranking baseado nos scores quantitativos avaliados no momento da decisão.',
        sourceEngine: 'StrategyRankingEngine',
        confidence: summary.rankingSummary.confidence,
        evidenceReferences: ['strategyRankingReferences']
      });
    }

    // 3. Assemble Reasons
    const reasons: DecisionReason[] = sections.map((s, i) => ({
      id: `reason-${explanationId}-${i}`,
      category: s.title,
      description: s.description,
      importance: s.confidence >= 0.8 ? 'HIGH' : s.confidence >= 0.5 ? 'MEDIUM' : 'LOW',
      evidence: { source: s.sourceEngine, references: s.evidenceReferences }
    }));

    // 4. Breakdown Confidence
    const confidenceBreakdown: DecisionConfidenceBreakdown = {
      quantitativeConfidence: summary.globalConfidence || 0,
      riskConfidence: summary.vixSummary?.confidence || 0,
      stabilityConfidence: summary.entropySummary?.confidence || 0
    };

    // 5. Consolidate Transparency Report
    const transparencyReport: DecisionTransparencyReport = {
      summary: 'Institutional Explainability Report generated exclusively from available DecisionSummary metrics.',
      sections,
      reasons,
      confidenceBreakdown,
      enginesConsulted: sections.map(s => s.sourceEngine),
      architectureVersion: 'RL.SYS CORE v5.x'
    };

    const durationMs = Date.now() - startTime;

    return {
      explanationId,
      timestamp,
      sourceDecisionId: summary.diagnostics?.sessionId as string || 'SYSTEM_EVALUATION',
      overallExplanation: 'Análise quantitativa explicada via interpretação auditável dos outputs determinísticos (READ-ONLY).',
      evidenceBundle,
      transparencyReport,
      processingMetadata: {
        durationMs,
        status: sections.length > 0 ? 'SUCCESS' : 'PARTIAL'
      }
    };
  }
}
