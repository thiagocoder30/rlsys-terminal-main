import { HistoricalSessionSnapshot } from '../session-audit/HistoricalSessionSnapshot';

export type ImprovementTrend = 'IMPROVING' | 'STABLE' | 'DECLINING';

export class ImprovementTrendCalculator {
    public static calculate(snapshots: readonly HistoricalSessionSnapshot[]): ImprovementTrend {
        if (snapshots.length < 2) {
            return 'STABLE';
        }

        const count = snapshots.length;
        const totalScore = snapshots.reduce((acc, curr) => acc + curr.data.performanceScore, 0);
        const averageScore = totalScore / count;

        const latestScore = snapshots[count - 1].data.performanceScore;
        const previousAvgScore = snapshots.slice(0, count - 1).reduce((acc, curr) => acc + curr.data.performanceScore, 0) / (count - 1);

        if (latestScore > previousAvgScore + 5) {
            return 'IMPROVING';
        } else if (latestScore < previousAvgScore - 5) {
            return 'DECLINING';
        }

        return 'STABLE';
    }
}
