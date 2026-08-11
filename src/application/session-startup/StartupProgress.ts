import { StartupState } from './StartupFlow';

export interface StepStatus {
    name: string;
    completed: boolean;
}

export class StartupProgress {
    private readonly steps: Map<string, boolean> = new Map([
        ['TableSelection', false],
        ['BankrollConfiguration', false],
        ['HistorySync', false],
        ['Warmup', false],
        ['Validation', false]
    ]);

    public markCompleted(stepName: string): void {
        if (this.steps.has(stepName)) {
            this.steps.set(stepName, true);
        }
    }

    public isStepCompleted(stepName: string): boolean {
        return this.steps.get(stepName) ?? false;
    }

    public getPercentage(): number {
        let completedCount = 0;
        this.steps.forEach(completed => {
            if (completed) completedCount++;
        });
        return Math.round((completedCount / this.steps.size) * 100);
    }

    public getCompletedCount(): number {
        let completedCount = 0;
        this.steps.forEach(completed => {
            if (completed) completedCount++;
        });
        return completedCount;
    }

    public getTotalSteps(): number {
        return this.steps.size;
    }

    public reset(): void {
        this.steps.forEach((_, key) => {
            this.steps.set(key, false);
        });
    }

    public getStepsList(): StepStatus[] {
        const result: StepStatus[] = [];
        this.steps.forEach((completed, name) => {
            result.push({ name, completed });
        });
        return result;
    }
}
