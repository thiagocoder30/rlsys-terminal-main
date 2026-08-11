import { SuggestionConfirmation } from './SuggestionConfirmation';

export class SuggestionHistory {
    private readonly records: SuggestionConfirmation[] = [];
    private readonly MAX_CAPACITY = 100;

    public append(confirmation: SuggestionConfirmation): void {
        this.records.push(Object.freeze({ ...confirmation }));
        if (this.records.length > this.MAX_CAPACITY) {
            this.records.shift();
        }
    }

    public getRecords(): SuggestionConfirmation[] {
        return [...this.records];
    }
}
