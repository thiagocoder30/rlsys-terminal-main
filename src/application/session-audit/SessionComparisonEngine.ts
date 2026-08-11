import { HistoricalSessionSnapshot } from './HistoricalSessionSnapshot';

export interface SessionComparisonResult {
    bestSession: HistoricalSessionSnapshot | null;
    worstSession: HistoricalSessionSnapshot | null;
    averageRoi: number;
    averageWinRate: number;
    averageScore: number;
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

export class SessionComparisonEngine {
    public static compare(snapshots: HistoricalSessionSnapshot[]): SessionComparisonResult {
        if (snapshots.length === 0) {
            return {
                bestSession: null,
                worstSession: null,
                averageRoi: 0,
                averageWinRate: 0,
                averageScore: 0,
                trend: 'STABLE'
            };
        }

        let bestSession = snapshots[0];
        let worstSession = snapshots[0];
        let totalRoi = 0;
        let totalWinRate = 0;
        let totalScore = 0;

        for (const snapshot of snapshots) {
            if (snapshot.data.roi > bestSession.data.roi) {
                bestSession = snapshot;
            }
            if (snapshot.data.roi < worstSession.data.roi) {
                worstSession = snapshot;
            }

            const winRate = snapshot.data.totalRounds > 0 ? snapshot.data.wins / snapshot.data.totalRounds : 0;
            totalRoi += snapshot.data.roi;
            totalWinRate += winRate;
            totalScore += snapshot.data.performanceScore;
        }

        const count = snapshots.length;
        const averageRoi = totalRoi / count;
        const averageWinRate = totalWinRate / count;
        const averageScore = totalScore / count;

        let trend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
        if (count >= 2) {
            const latestScore = snapshots[count - 1].data.performanceScore;
            const previousAvgScore = snapshots.slice(0, count - 1).reduce((acc, curr) => acc + curr.data.performanceScore, 0) / (count - 1);
            if (latestScore > previousAvgScore + 5) {
                trend = 'IMPROVING';
            } else if (latestScore < previousAvgScore - 5) {
                trend = 'DECLINING';
            }
        }

        return {
            bestSession,
            worstSession,
            averageRoi,
            averageWinRate,
            averageScore,
            trend
        };
    }
}
