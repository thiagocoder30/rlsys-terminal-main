import { OperatorHUDBuilder } from './OperatorHUDBuilder';
import { OperatorHUDSnapshot, StrategyWeightItem } from './OperatorHUDSnapshot';

export class OperatorHUDReportService {
    private currentSnapshot: OperatorHUDSnapshot | null = null;

    constructor(
        private readonly builder: OperatorHUDBuilder
    ) {}

    public updateSnapshot(
        strategySuggestion: string | null = null,
        confidence: string | null = null,
        stakeValue: number = 0,
        chipValue: number = 0,
        selectedTarget: string | null = null,
        oracleMessage?: string,
        recentSpinsOverride?: number[],
        xaiExplanation?: string | string[],
        strategyWeightsOverride?: StrategyWeightItem[]
    ): void {
        this.currentSnapshot = this.builder.buildSnapshot(
            strategySuggestion,
            confidence,
            stakeValue,
            chipValue,
            selectedTarget,
            oracleMessage,
            recentSpinsOverride,
            xaiExplanation,
            strategyWeightsOverride
        );
    }

    public getCurrentSnapshot(): OperatorHUDSnapshot | null {
        if (!this.currentSnapshot) {
            this.updateSnapshot();
        }
        return this.currentSnapshot;
    }
}
