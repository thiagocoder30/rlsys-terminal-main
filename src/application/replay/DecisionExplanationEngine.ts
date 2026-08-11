import { DecisionExplanation } from './DecisionReplaySnapshot';
import { DecisionLedgerEntry } from '../runtime/DecisionLedger';

export class DecisionExplanationEngine {
    public explain(entries: ReadonlyArray<DecisionLedgerEntry>): DecisionExplanation {
        let chosenStrategy = 'UNKNOWN';
        let discardedStrategies: string[] = [];
        let consensus = 0;
        let confidence = 0;
        let operationalVix = 0;
        let entropy = 0;
        let marketRegime = 'UNKNOWN';
        let dynamicWeight = 0;
        let shadowPerformance = 0;
        let feedbackStatus = 'NONE';
        let suggestedStake = 0;

        for (const entry of entries) {
            try {
                const data = JSON.parse(entry.decisionExplanation);
                if (entry.decisionSummary === 'MARKET_REGIME_UPDATED' || entry.decisionSummary.includes('REGIME')) {
                    if (data.regime) marketRegime = data.regime;
                }
                if (entry.decisionSummary === 'FEEDBACK_EVIDENCE_APPROVED') {
                    feedbackStatus = 'APPROVED';
                }
                if (entry.decisionSummary === 'FEEDBACK_EVIDENCE_REJECTED') {
                    feedbackStatus = 'REJECTED';
                }
                if (entry.decisionSummary === 'STRATEGY_WEIGHTS_CALIBRATED' || entry.decisionSummary.includes('WEIGHT')) {
                    if (data.weights && data.weights.length > 0) {
                        dynamicWeight = data.weights[0].weight || 0;
                    }
                }
                if (entry.decisionSummary === 'SHADOW_PERFORMANCE_UPDATED') {
                    if (data.winRate) shadowPerformance = data.winRate;
                }
                if (entry.decisionSummary === 'RECOMMENDATION_GENERATED' || entry.decisionSummary === 'DECISION_CREATED') {
                    if (data.strategy) chosenStrategy = data.strategy;
                    if (data.consensus) consensus = data.consensus;
                    if (data.confidence) confidence = data.confidence;
                    if (data.stake) suggestedStake = data.stake;
                }
                if (entry.decisionSummary === 'VIX_CALCULATED') {
                    if (data.vix) operationalVix = data.vix;
                }
                if (entry.decisionSummary === 'ENTROPY_CALCULATED') {
                    if (data.entropy) entropy = data.entropy;
                }
            } catch {
                // Ignore parsing errors
            }
        }

        const primaryReason = `Strategy ${chosenStrategy} selected under ${marketRegime} regime with ${confidence.toFixed(2)} confidence.`;
        const favorableFactors = consensus > 0.5 ? ['High Consensus'] : [];
        const unfavorableFactors = shadowPerformance < 0.5 ? ['Low Shadow Performance'] : [];
        const institutionalConclusion = `Decision approved based on objective institutional metrics.`;

        return {
            chosenStrategy,
            discardedStrategies,
            consensus,
            confidence,
            operationalVix,
            entropy,
            marketRegime,
            dynamicWeight,
            shadowPerformance,
            feedbackStatus,
            suggestedStake,
            primaryReason,
            favorableFactors,
            unfavorableFactors,
            institutionalConclusion
        };
    }
}
