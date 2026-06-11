export type WheelHeatLevel = 'COLD' | 'NEUTRAL' | 'WARM' | 'HOT';

export interface WheelHeatmapOptions {
  readonly recentWindow?: number;
  readonly neighborRadius?: number;
  readonly hotThreshold?: number;
  readonly warmThreshold?: number;
  readonly coldThreshold?: number;
}

export interface WheelNumberHeat {
  readonly number: number;
  readonly wheelIndex: number;
  readonly count: number;
  readonly frequencyPercent: number;
  readonly recentCount: number;
  readonly recentFrequencyPercent: number;
  readonly lastSeenDistance: number | null;
  readonly absenceScore: number;
  readonly neighborPressureScore: number;
  readonly momentumScore: number;
  readonly heatScore: number;
  readonly heatLevel: WheelHeatLevel;
}

export interface WheelSectorHeat {
  readonly sectorId: string;
  readonly numbers: readonly number[];
  readonly totalHits: number;
  readonly recentHits: number;
  readonly heatScore: number;
  readonly heatLevel: WheelHeatLevel;
}

export interface WheelHeatmapReport {
  readonly sampleSize: number;
  readonly recentWindow: number;
  readonly neighborRadius: number;
  readonly numbers: readonly WheelNumberHeat[];
  readonly hotNumbers: readonly WheelNumberHeat[];
  readonly coldNumbers: readonly WheelNumberHeat[];
  readonly hotSectors: readonly WheelSectorHeat[];
  readonly coldSectors: readonly WheelSectorHeat[];
  readonly sectorSummaries: readonly WheelSectorHeat[];
  readonly fusionPressureScore: number;
  readonly recencyPressureScore: number;
  readonly dispersionScore: number;
  readonly auditText: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
}

interface WheelSectorDefinition {
  readonly sectorId: string;
  readonly numbers: readonly number[];
}

const EUROPEAN_WHEEL: readonly number[] = Object.freeze([
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]);

const WHEEL_SECTORS: readonly WheelSectorDefinition[] = Object.freeze([
  { sectorId: 'ZERO_NEIGHBORS', numbers: Object.freeze([12, 35, 3, 26, 0, 32, 15]) },
  { sectorId: 'VOISINS_LEFT', numbers: Object.freeze([22, 18, 29, 7, 28, 12, 35, 3, 26]) },
  { sectorId: 'VOISINS_RIGHT', numbers: Object.freeze([0, 32, 15, 19, 4, 21, 2, 25]) },
  { sectorId: 'TIERS', numbers: Object.freeze([27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33]) },
  { sectorId: 'ORPHELINS', numbers: Object.freeze([1, 20, 14, 31, 9, 17, 34, 6]) },
]);

export class WheelHeatmapAnalyticsEngine {
  public analyze(history: readonly number[], options: WheelHeatmapOptions = {}): WheelHeatmapReport {
    const normalizedHistory = this.normalizeHistory(history);
    const recentWindow = this.positiveIntegerOrDefault(options.recentWindow, 30);
    const neighborRadius = this.positiveIntegerOrDefault(options.neighborRadius, 2);
    const hotThreshold = this.scoreOrDefault(options.hotThreshold, 68);
    const warmThreshold = this.scoreOrDefault(options.warmThreshold, 54);
    const coldThreshold = this.scoreOrDefault(options.coldThreshold, 28);

    const recentHistory = normalizedHistory.slice(Math.max(0, normalizedHistory.length - recentWindow));
    const numberHeat = EUROPEAN_WHEEL.map((number, wheelIndex) => {
      const count = this.count(normalizedHistory, number);
      const recentCount = this.count(recentHistory, number);
      const frequencyPercent = this.percent(count, Math.max(1, normalizedHistory.length));
      const recentFrequencyPercent = this.percent(recentCount, Math.max(1, recentHistory.length));
      const lastSeenDistance = this.lastSeenDistance(normalizedHistory, number);
      const absenceScore = this.absenceScore(lastSeenDistance, normalizedHistory.length);
      const neighborPressureScore = this.neighborPressure(normalizedHistory, number, neighborRadius);
      const momentumScore = this.momentumScore(count, recentCount, normalizedHistory.length, recentHistory.length);
      const heatScore = this.heatScore({
        frequencyPercent,
        recentFrequencyPercent,
        absenceScore,
        neighborPressureScore,
        momentumScore,
      });

      return Object.freeze({
        number,
        wheelIndex,
        count,
        frequencyPercent,
        recentCount,
        recentFrequencyPercent,
        lastSeenDistance,
        absenceScore,
        neighborPressureScore,
        momentumScore,
        heatScore,
        heatLevel: this.heatLevel(heatScore, hotThreshold, warmThreshold, coldThreshold),
      });
    });

    const sectorSummaries = this.sectorSummaries(numberHeat);
    const hotNumbers = Object.freeze([...numberHeat].filter((item) => item.heatLevel === 'HOT').sort((a, b) => b.heatScore - a.heatScore));
    const coldNumbers = Object.freeze([...numberHeat].filter((item) => item.heatLevel === 'COLD').sort((a, b) => a.heatScore - b.heatScore));
    const hotSectors = Object.freeze([...sectorSummaries].filter((item) => item.heatLevel === 'HOT').sort((a, b) => b.heatScore - a.heatScore));
    const coldSectors = Object.freeze([...sectorSummaries].filter((item) => item.heatLevel === 'COLD').sort((a, b) => a.heatScore - b.heatScore));
    const fusionPressureScore = this.average(numberHeat.map((item) => item.neighborPressureScore));
    const recencyPressureScore = this.average(numberHeat.map((item) => item.momentumScore));
    const dispersionScore = this.dispersionScore(numberHeat);

    const reportBase = {
      sampleSize: normalizedHistory.length,
      recentWindow,
      neighborRadius,
      numbers: Object.freeze(numberHeat),
      hotNumbers,
      coldNumbers,
      hotSectors,
      coldSectors,
      sectorSummaries,
      fusionPressureScore,
      recencyPressureScore,
      dispersionScore,
      paperOnly: true as const,
      liveMoneyAuthorized: false as const,
      productionMoneyAllowed: false as const,
    };

    return Object.freeze({
      ...reportBase,
      auditText: this.composeAuditText(reportBase),
    });
  }

  public wheelOrder(): readonly number[] {
    return EUROPEAN_WHEEL;
  }

  private sectorSummaries(numbers: readonly WheelNumberHeat[]): readonly WheelSectorHeat[] {
    return Object.freeze(WHEEL_SECTORS.map((sector) => {
      const sectorNumberSet = new Set<number>(sector.numbers);
      const items = numbers.filter((item) => sectorNumberSet.has(item.number));
      const totalHits = items.reduce((sum, item) => sum + item.count, 0);
      const recentHits = items.reduce((sum, item) => sum + item.recentCount, 0);
      const heatScore = this.average(items.map((item) => item.heatScore));

      return Object.freeze({
        sectorId: sector.sectorId,
        numbers: Object.freeze([...sector.numbers]),
        totalHits,
        recentHits,
        heatScore,
        heatLevel: this.heatLevel(heatScore, 68, 54, 28),
      });
    }));
  }

  private normalizeHistory(history: readonly number[]): readonly number[] {
    return Object.freeze(history.filter((value) => Number.isInteger(value) && value >= 0 && value <= 36));
  }

  private count(history: readonly number[], number: number): number {
    let total = 0;

    for (const item of history) {
      if (item === number) total += 1;
    }

    return total;
  }

  private lastSeenDistance(history: readonly number[], number: number): number | null {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index] === number) {
        return history.length - 1 - index;
      }
    }

    return null;
  }

  private absenceScore(lastSeenDistance: number | null, sampleSize: number): number {
    if (lastSeenDistance === null) {
      return 100;
    }

    return this.score((lastSeenDistance / Math.max(1, sampleSize)) * 100);
  }

  private neighborPressure(history: readonly number[], number: number, radius: number): number {
    const wheelIndex = EUROPEAN_WHEEL.indexOf(number);

    if (wheelIndex < 0) {
      return 0;
    }

    const neighbors = this.neighbors(wheelIndex, radius);
    const hits = history.filter((item) => neighbors.includes(item)).length;
    const expectedShare = neighbors.length / EUROPEAN_WHEEL.length;
    const observedShare = hits / Math.max(1, history.length);

    return this.score((observedShare / Math.max(0.001, expectedShare)) * 50);
  }

  private neighbors(wheelIndex: number, radius: number): readonly number[] {
    const output: number[] = [];

    for (let offset = -radius; offset <= radius; offset += 1) {
      const index = (wheelIndex + offset + EUROPEAN_WHEEL.length) % EUROPEAN_WHEEL.length;
      output.push(EUROPEAN_WHEEL[index]);
    }

    return Object.freeze(output);
  }

  private momentumScore(count: number, recentCount: number, sampleSize: number, recentSize: number): number {
    const allRate = count / Math.max(1, sampleSize);
    const recentRate = recentCount / Math.max(1, recentSize);
    const ratio = recentRate / Math.max(0.001, allRate || (1 / 37));

    return this.score(ratio * 50);
  }

  private heatScore(input: {
    readonly frequencyPercent: number;
    readonly recentFrequencyPercent: number;
    readonly absenceScore: number;
    readonly neighborPressureScore: number;
    readonly momentumScore: number;
  }): number {
    const raw =
      (input.frequencyPercent * 5) +
      (input.recentFrequencyPercent * 7) +
      (input.neighborPressureScore * 0.24) +
      (input.momentumScore * 0.26) -
      (input.absenceScore * 0.18);

    return this.score(raw);
  }

  private dispersionScore(numbers: readonly WheelNumberHeat[]): number {
    const hotCount = numbers.filter((item) => item.heatLevel === 'HOT').length;
    const coldCount = numbers.filter((item) => item.heatLevel === 'COLD').length;

    return this.score(((hotCount + coldCount) / Math.max(1, numbers.length)) * 100);
  }

  private heatLevel(score: number, hotThreshold: number, warmThreshold: number, coldThreshold: number): WheelHeatLevel {
    if (score >= hotThreshold) return 'HOT';
    if (score >= warmThreshold) return 'WARM';
    if (score <= coldThreshold) return 'COLD';
    return 'NEUTRAL';
  }

  private composeAuditText(report: {
    readonly sampleSize: number;
    readonly recentWindow: number;
    readonly neighborRadius: number;
    readonly hotNumbers: readonly WheelNumberHeat[];
    readonly coldNumbers: readonly WheelNumberHeat[];
    readonly hotSectors: readonly WheelSectorHeat[];
    readonly coldSectors: readonly WheelSectorHeat[];
    readonly fusionPressureScore: number;
    readonly recencyPressureScore: number;
    readonly dispersionScore: number;
  }): string {
    return [
      'WHEEL HEATMAP ANALYTICS',
      `SAMPLE_SIZE=${report.sampleSize}`,
      `RECENT_WINDOW=${report.recentWindow}`,
      `NEIGHBOR_RADIUS=${report.neighborRadius}`,
      `FUSION_PRESSURE=${report.fusionPressureScore}`,
      `RECENCY_PRESSURE=${report.recencyPressureScore}`,
      `DISPERSION=${report.dispersionScore}`,
      `HOT_NUMBERS=${report.hotNumbers.map((item) => `${item.number}:${item.heatScore}`).join(',') || 'none'}`,
      `COLD_NUMBERS=${report.coldNumbers.map((item) => `${item.number}:${item.heatScore}`).join(',') || 'none'}`,
      `HOT_SECTORS=${report.hotSectors.map((item) => `${item.sectorId}:${item.heatScore}`).join(',') || 'none'}`,
      `COLD_SECTORS=${report.coldSectors.map((item) => `${item.sectorId}:${item.heatScore}`).join(',') || 'none'}`,
      'paperOnly=true',
      'liveMoneyAuthorized=false',
    ].join('\n');
  }

  private average(values: readonly number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return this.score(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private percent(part: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return Math.round((part / total) * 10000) / 100;
  }

  private score(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private scoreOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? this.score(value) : fallback;
  }
}
