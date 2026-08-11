import { createHash } from 'crypto';
import { OperatorPerformanceProfile } from './OperatorPerformanceProfile';
import { RiskLevel } from './RiskBehaviorAnalyzer';
import { ImprovementTrend } from './ImprovementTrendCalculator';

export interface SessionInsightSnapshotData {
    timestamp: number;
    operatorProfile: OperatorPerformanceProfile;
    riskLevel: RiskLevel;
    consistencyScore: number;
    trend: ImprovementTrend;
    insights: readonly string[];
}

export class SessionInsightSnapshot {
    public readonly data: Readonly<SessionInsightSnapshotData>;
    public readonly hash: string;

    constructor(data: SessionInsightSnapshotData) {
        this.data = Object.freeze({
            ...data,
            operatorProfile: Object.freeze({ ...data.operatorProfile }),
            insights: Object.freeze([...data.insights])
        });
        this.hash = this.generateHash();
        Object.freeze(this);
    }

    private generateHash(): string {
        return createHash('sha256')
            .update(JSON.stringify(this.data))
            .digest('hex');
    }
}
