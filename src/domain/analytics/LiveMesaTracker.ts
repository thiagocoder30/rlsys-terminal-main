import { IAnalyticsEngine } from '../interfaces/IAnalyticsEngine';

export class LiveMesaTracker implements IAnalyticsEngine {
    private _history: number[] = [];
    private readonly MAX_CAPACITY = 500; // Prevenção de vazamento de memória O(1) space bound

    public addNumber(num: number): void {
        this._history.push(num);
        if (this._history.length > this.MAX_CAPACITY) {
            this._history.shift(); // Otimização de Garbage Collection
        }
    }

    public getHistory(): number[] {
        return [...this._history]; // Retorna cópia rasa imutável
    }

    public getTimeline(length: number): string {
        const slice = this._history.slice(-length);
        return slice.join(' - ');
    }
    
    // Suporte retrocompatível para a migração gradual
    get history(): number[] {
        return this.getHistory();
    }
}
