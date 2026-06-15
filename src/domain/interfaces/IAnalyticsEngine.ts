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
        dozen1: number; dozen2: number; dozen3: number;
        col1: number; col2: number; col3: number;
    };
}
