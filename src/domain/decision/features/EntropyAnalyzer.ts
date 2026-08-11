export class EntropyAnalyzer {
    public calculateVix(timeline: ReadonlyArray<number>): number {
        if (timeline.length < 12) return 0;
        const sample = timeline.slice(-12);
        const uniqueNumbers = new Set(sample).size;
        const repetitions = sample.length - uniqueNumbers;
        return 100 - ((repetitions / 12) * 100);
    }
}
