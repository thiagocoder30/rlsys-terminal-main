import { SessionInsightHistory } from './SessionInsightHistory';
import { SessionInsightSnapshot } from './SessionInsightSnapshot';
import { SessionIntelligenceEngine } from './SessionIntelligenceEngine';

export class SessionIntelligenceReportService {
    constructor(
        private readonly insightHistory: SessionInsightHistory,
        private readonly engine: SessionIntelligenceEngine
    ) {}

    public getLatestIntelligence(): SessionInsightSnapshot {
        const latest = this.insightHistory.getLatest();
        if (latest) {
            return latest;
        }
        return this.engine.analyzeOperatorIntelligence();
    }

    public getInsightHistory(): readonly SessionInsightSnapshot[] {
        return this.insightHistory.getRecords();
    }

    public getTrendAnalysis() {
        const latest = this.getLatestIntelligence();
        return {
            trend: latest.data.trend,
            consistencyScore: latest.data.consistencyScore,
            riskLevel: latest.data.riskLevel,
            totalSessions: latest.data.operatorProfile.totalSessions,
            averageROI: latest.data.operatorProfile.averageROI
        };
    }
}
