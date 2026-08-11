import { HistoricalSessionSnapshot } from '../session-audit/HistoricalSessionSnapshot';

export type RiskLevel = 'LOW_RISK' | 'NORMAL' | 'ATTENTION' | 'HIGH_RISK';

export class RiskBehaviorAnalyzer {
    public static analyze(
        snapshots: readonly HistoricalSessionSnapshot[],
        maxDrawdown: number
    ): RiskLevel {
        if (snapshots.length === 0) {
            return 'NORMAL';
        }

        let totalLosses = 0;
        let totalRounds = 0;
        let stopLossCount = 0;

        for (const snapshot of snapshots) {
            totalLosses += snapshot.data.losses;
            totalRounds += snapshot.data.totalRounds;
            if (snapshot.data.stopReason.includes('STOP_LOSS')) {
                stopLossCount++;
            }
        }

        const overallLossRate = totalRounds > 0 ? totalLosses / totalRounds : 0;
        const stopLossRatio = snapshots.length > 0 ? stopLossCount / snapshots.length : 0;

        if (maxDrawdown > 0.25 || stopLossRatio >= 0.5 || overallLossRate > 0.65) {
            return 'HIGH_RISK';
        }

        if (maxDrawdown > 0.15 || stopLossRatio >= 0.3 || overallLossRate > 0.5) {
            return 'ATTENTION';
        }

        if (maxDrawdown < 0.08 && stopLossRatio === 0 && overallLossRate < 0.35) {
            return 'LOW_RISK';
        }

        return 'NORMAL';
    }
}
