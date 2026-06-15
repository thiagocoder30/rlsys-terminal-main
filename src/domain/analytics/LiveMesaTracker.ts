import { IAnalyticsEngine } from '../interfaces/IAnalyticsEngine';

export class LiveMesaTracker implements IAnalyticsEngine {
    private _history: number[] = [];
    private readonly MAX_CAPACITY = 500;
    
    // Topografia universal da Roleta Europeia
    private readonly RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

    public addNumber(num: number): void {
        this._history.push(num);
        if (this._history.length > this.MAX_CAPACITY) {
            this._history.shift();
        }
    }

    public getHistory(): number[] {
        return [...this._history];
    }

    public getTimeline(length: number): string {
        const slice = this._history.slice(-length);
        return slice.join(' - ');
    }

    public getFrequencies(): Map<number, number> {
        const freq = new Map<number, number>();
        // Inicializa todos de 0 a 36 com zero ocorrências
        for (let i = 0; i <= 36; i++) freq.set(i, 0);
        
        this._history.forEach(num => {
            freq.set(num, (freq.get(num) || 0) + 1);
        });
        return freq;
    }

    public getDistributionStats() {
        const stats = { total: this._history.length, red: 0, black: 0, zero: 0, even: 0, odd: 0, high: 0, low: 0 };
        
        this._history.forEach(num => {
            if (num === 0) { stats.zero++; return; }
            
            if (this.RED_NUMS.has(num)) stats.red++; else stats.black++;
            if (num % 2 === 0) stats.even++; else stats.odd++;
            if (num >= 1 && num <= 18) stats.low++; else stats.high++;
        });
        
        return stats;
    }
}
