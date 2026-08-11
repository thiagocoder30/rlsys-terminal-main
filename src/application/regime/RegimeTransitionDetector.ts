import { MarketRegimeType } from './RegimeSnapshot';

export class RegimeTransitionDetector {
    private currentRegime: MarketRegimeType = 'LOW_INFORMATION';
    private previousRegime: MarketRegimeType | null = null;
    private persistenceCount = 0;
    private transitionCount = 0;
    private recentRegimes: MarketRegimeType[] = [];
    private readonly WINDOW_SIZE = 15;

    public update(newRegime: MarketRegimeType): {
        changed: boolean;
        previous: MarketRegimeType | null;
        current: MarketRegimeType;
        persistenceCount: number;
        transitionCount: number;
        stabilityIndex: number;
    } {
        let changed = false;

        if (this.currentRegime !== newRegime) {
            changed = true;
            this.previousRegime = this.currentRegime;
            this.currentRegime = newRegime;
            this.persistenceCount = 1;
            this.transitionCount++;
        } else {
            this.persistenceCount++;
        }

        this.recentRegimes.push(newRegime);
        if (this.recentRegimes.length > this.WINDOW_SIZE) {
            this.recentRegimes.shift();
        }

        const stabilityIndex = this.calculateStability();

        return {
            changed,
            previous: this.previousRegime,
            current: this.currentRegime,
            persistenceCount: this.persistenceCount,
            transitionCount: this.transitionCount,
            stabilityIndex
        };
    }

    private calculateStability(): number {
        if (this.recentRegimes.length === 0) return 1.0;
        const matches = this.recentRegimes.filter(r => r === this.currentRegime).length;
        return Math.round((matches / this.recentRegimes.length) * 100) / 100;
    }

    public getCurrentRegime(): MarketRegimeType { return this.currentRegime; }
    public getPreviousRegime(): MarketRegimeType | null { return this.previousRegime; }
    public getPersistenceCount(): number { return this.persistenceCount; }
    public getTransitionCount(): number { return this.transitionCount; }
}
