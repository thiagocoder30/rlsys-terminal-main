const fs = require('fs');
const path = './src/infrastructure/http/controllers/OperatorController.ts';
let content = fs.readFileSync(path, 'utf8');

// Add import
const importStr = `import { StrategyRecommendationEngine } from '../../../application/recommendation/StrategyRecommendationEngine';\n`;
content = importStr + content;

// Add instance
content = content.replace(
    `export class OperatorController {`,
    `export class OperatorController {\n    private readonly recommendationEngine = new StrategyRecommendationEngine();`
);

// Update getPreflight
const getPreflightReplacement = `
    public getPreflight = (req: Request, res: Response) => {
        const sessionId = req.query.sessionId as string || 'SESSION-000';
        const ctx = this.runtime.getPreFlightContext(sessionId);
        const result = this.runtime.operationalGate.executePreFlight(ctx);
        const consensus = this.getConsensusDTO();
        
        // --- RECOMMENDATION ENGINE INTEGRATION ---
        const session = this.runtime.sessionManager.getSession(sessionId);
        const bankroll = session ? session.currentBankroll : 1000;
        
        const perfHistory = this.runtime.performanceHistory.getAllPerformances();
        const availableStrategies = perfHistory.map(p => {
            const conf = this.runtime.adaptiveEngine.evaluateConfidence(p.strategyId);
            return {
                strategyId: p.strategyId,
                confidenceScore: conf.score.value,
                winRate: p.totalExecutions > 0 ? p.wins / p.totalExecutions : 0,
                recentPnL: p.profit
            };
        });

        const adaptiveMetrics = this.runtime.adaptiveEngine.getAggregateMetrics();
        const adaptiveScore = adaptiveMetrics.averageConfidence * 100;

        const recommendation = this.recommendationEngine.generateRecommendation({
            bankroll,
            preFlightStatus: result.status,
            lockReason: result.status === 'REJECTED' ? (result.rejection?.reasons.map(r => r.description).join(', ') || null) : null,
            consensusLevel: consensus.agreementScore / 100,
            confidenceLevel: result.approval ? result.approval.confidence : 0,
            riskLevel: ctx.operationalVix / 100, // simplistic risk scaling
            adaptiveScore,
            availableStrategies
        });
        
        // Log to ledger
        if (recommendation.isOpportunity && recommendation.strategy) {
            this.runtime.ledger.append(sessionId, '5.0.0', 'STRATEGY_RECOMMENDED', recommendation.strategy);
            this.runtime.ledger.append(sessionId, '5.0.0', 'STAKE_RECOMMENDED', recommendation.stake.toString());
            this.runtime.ledger.append(sessionId, '5.0.0', 'DECISION_EXPLAINED', recommendation.explanation);
        } else if (recommendation.preFlightStatus === 'REJECTED') {
            this.runtime.ledger.append(sessionId, '5.0.0', 'DECISION_BLOCKED', recommendation.lockReason || 'PreFlight rejected');
        } else {
            this.runtime.ledger.append(sessionId, '5.0.0', 'NO_STRATEGY_AVAILABLE', recommendation.explanation);
        }
        
        res.status(200).json({
            status: result.status,
            reasons: result.rejection ? result.rejection.reasons : [],
            operationalReadiness: result.readiness,
            eligibleStrategies: result.approval ? result.approval.eligibleStrategies : [],
            approvedStake: result.approval ? result.approval.approvedStake : 0,
            consensus: consensus,
            confidence: result.approval ? result.approval.confidence : 0,
            recommendation
        });
    }
`;

content = content.replace(/public getPreflight = \(req: Request, res: Response\) => \{[\s\S]*?\}\n    public getBankroll =/m, getPreflightReplacement.trim() + "\n    public getBankroll =");

fs.writeFileSync(path, content, 'utf8');
