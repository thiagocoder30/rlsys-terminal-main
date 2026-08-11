import { StrategyConfidenceRepository } from './StrategyConfidenceRepository';
import { StrategyConfidence } from '../../domain/adaptive/StrategyConfidence';

export class ConfidenceSnapshotManager {
    constructor(private readonly repository: StrategyConfidenceRepository) {}

    public createSnapshot(confidence: StrategyConfidence): void {
        this.repository.append(confidence.strategyId, confidence);
    }

    public getLatestSnapshot(strategyId: string): StrategyConfidence | null {
        return this.repository.getLatest(strategyId);
    }

    public getHistory(strategyId?: string) {
        return this.repository.getEntries(strategyId);
    }
}
