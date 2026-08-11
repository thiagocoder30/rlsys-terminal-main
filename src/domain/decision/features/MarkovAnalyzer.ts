export class MarkovAnalyzer {
    private readonly matrix = new Float64Array(1369);
    private lastNum = -1;

    public update(drawnNumber: number): void {
        if (this.lastNum !== -1) {
            this.matrix[this.lastNum * 37 + drawnNumber] += 1;
        }
        this.lastNum = drawnNumber;
    }

    public sync(timeline: ReadonlyArray<number>): void {
        this.matrix.fill(0);
        this.lastNum = -1;
        for (const num of timeline) {
            this.update(num);
        }
    }

    public predict(lastNum: number): { nextProbableNum: number; maxHits: number } {
        let maxHits = 0;
        let nextProbableNum = -1;
        if (lastNum === -1) return { nextProbableNum, maxHits };
        for (let i = 0; i <= 36; i++) {
            const hits = this.matrix[lastNum * 37 + i];
            if (hits > maxHits) {
                maxHits = hits;
                nextProbableNum = i;
            }
        }
        return { nextProbableNum, maxHits };
    }
}
