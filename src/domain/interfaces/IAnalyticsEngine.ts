export interface IAnalyticsEngine {
    addNumber(num: number): void;
    getHistory(): number[];
    getTimeline(length: number): string;
    getFrequencies(): Map<number, number>;
    getDistributionStats(): {
        total: number;
        red: number; black: number; zero: number;
        even: number; odd: number;
        high: number; low: number;
    };
}
