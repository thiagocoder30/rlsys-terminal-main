import { SessionStartupWizard } from './SessionStartupWizard';
import { StartupProgress } from './StartupProgress';
import { StartupHistory, StartupRecord } from './StartupHistory';

export interface StartupStatusSummary {
    state: string;
    percentage: number;
    completedStepsCount: number;
    totalStepsCount: number;
    tableProvider: string | null;
    bankroll: number | null;
    failureReason: string | null;
    stepsList: { name: string; completed: boolean }[];
}

export class SessionStartupReportService {
    constructor(
        private readonly wizard: SessionStartupWizard,
        private readonly progress: StartupProgress,
        private readonly history: StartupHistory
    ) {}

    public getStartupStatus(): StartupStatusSummary {
        return {
            state: this.wizard.getCurrentState(),
            percentage: this.progress.getPercentage(),
            completedStepsCount: this.progress.getCompletedCount(),
            totalStepsCount: this.progress.getTotalSteps(),
            tableProvider: this.wizard.getSelectedTable(),
            bankroll: this.wizard.getConfiguredBankroll(),
            failureReason: this.wizard.getFailureReason(),
            stepsList: this.progress.getStepsList()
        };
    }

    public getStartupHistory(): readonly StartupRecord[] {
        return this.history.getRecords();
    }
}
