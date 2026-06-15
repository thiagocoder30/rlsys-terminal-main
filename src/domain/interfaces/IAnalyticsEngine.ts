export interface IAnalyticsEngine {
    addNumber(num: number): void;
    getHistory(): number[];
    getTimeline(length: number): string;
}
