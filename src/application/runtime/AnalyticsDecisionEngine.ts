export type AnalyticsDecisionRecommendation =
  | 'AGUARDAR'
  | 'PAPER_OBSERVAR'
  | 'PAPER_SINAL_FRACO'
  | 'PAPER_SINAL_FORTE';

export interface AnalyticsDecisionInput {
  readonly warmupRounds: readonly string[];
  readonly liveRounds: readonly string[];
  readonly minimumLiveRounds?: number;
}

export interface AnalyticsDecisionEngineResult {
  readonly recommendation: AnalyticsDecisionRecommendation;
  readonly confidence: number;
  readonly risk: number;
  readonly triplicacao: {
    readonly totalTrios: number;
    readonly tc: number;
    readonly ntc: number;
    readonly ta: number;
    readonly nta: number;
    readonly zeroTrios: number;
    readonly dominantPattern: 'TC' | 'NTC' | 'TA' | 'NTA' | 'NONE';
    readonly dominantRatio: number;
  };
  readonly heatmap: {
    readonly hotNumbers: readonly number[];
    readonly coldNumbers: readonly number[];
    readonly zeroFrequency: number;
  };
  readonly consensus: {
    readonly enginesAligned: number;
    readonly enginesTotal: number;
    readonly classification: 'NO_GO' | 'WEAK_CONTEXT' | 'WATCHLIST' | 'PAPER_ONLY';
  };
  readonly message: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticBetExecutionAllowed: false;
}

const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, index) => index);

export class AnalyticsDecisionEngine {
  public evaluate(input: AnalyticsDecisionInput): AnalyticsDecisionEngineResult {
    const warmup = this.parseRounds(input.warmupRounds);
    const live = this.parseRounds(input.liveRounds);
    const minimumLiveRounds = input.minimumLiveRounds && input.minimumLiveRounds > 0 ? input.minimumLiveRounds : 6;
    const allRounds = Object.freeze([...warmup, ...live]);
    const triplicacao = this.computeTriplicacao(allRounds);
    const heatmap = this.computeHeatmap(allRounds);

    if (warmup.length < 100) {
      return this.result({
        recommendation: 'AGUARDAR',
        confidence: 0,
        risk: 1,
        triplicacao,
        heatmap,
        consensus: { enginesAligned: 0, enginesTotal: 3, classification: 'NO_GO' },
        message: `Warmup insuficiente para decisão institucional. Warmup=${warmup.length}. Mínimo=100.`,
      });
    }

    if (live.length < minimumLiveRounds) {
      return this.result({
        recommendation: 'AGUARDAR',
        confidence: 0.18,
        risk: 0.82,
        triplicacao,
        heatmap,
        consensus: { enginesAligned: 1, enginesTotal: 3, classification: 'WEAK_CONTEXT' },
        message: [
          'AGUARDAR — contexto ao vivo insuficiente.',
          `Warmup=${warmup.length}`,
          `LiveRounds=${live.length}`,
          `MínimoLive=${minimumLiveRounds}`,
          'Triplicação/Heatmap calculados, mas sem autorização PAPER.',
        ].join(String.fromCharCode(10)),
      });
    }

    const triplicacaoSignal = triplicacao.dominantRatio >= 0.42 && triplicacao.totalTrios >= 35;
    const heatmapSignal = heatmap.hotNumbers.length >= 3 && heatmap.zeroFrequency <= 0.08;
    const liveSignal = live.length >= minimumLiveRounds;
    const enginesAligned = [triplicacaoSignal, heatmapSignal, liveSignal].filter(Boolean).length;

    const confidence = this.clamp(
      (triplicacao.dominantRatio * 0.45)
      + (Math.min(heatmap.hotNumbers.length, 5) / 5 * 0.25)
      + (Math.min(live.length, 20) / 20 * 0.30),
      0,
      0.99,
    );

    const risk = this.clamp(1 - confidence, 0.01, 1);

    if (enginesAligned >= 3 && confidence >= 0.68) {
      return this.result({
        recommendation: 'PAPER_SINAL_FORTE',
        confidence,
        risk,
        triplicacao,
        heatmap,
        consensus: { enginesAligned, enginesTotal: 3, classification: 'PAPER_ONLY' },
        message: [
          'PAPER_SINAL_FORTE — somente PAPER, supervisão humana obrigatória.',
          `Confiança=${confidence.toFixed(2)}`,
          `Risco=${risk.toFixed(2)}`,
          `Triplicação dominante=${triplicacao.dominantPattern}`,
        ].join(String.fromCharCode(10)),
      });
    }

    if (enginesAligned >= 2 && confidence >= 0.50) {
      return this.result({
        recommendation: 'PAPER_SINAL_FRACO',
        confidence,
        risk,
        triplicacao,
        heatmap,
        consensus: { enginesAligned, enginesTotal: 3, classification: 'WATCHLIST' },
        message: [
          'PAPER_SINAL_FRACO — watchlist. Não executar dinheiro real.',
          `Confiança=${confidence.toFixed(2)}`,
          `Risco=${risk.toFixed(2)}`,
          `Motores alinhados=${enginesAligned}/3`,
        ].join(String.fromCharCode(10)),
      });
    }

    return this.result({
      recommendation: 'PAPER_OBSERVAR',
      confidence,
      risk,
      triplicacao,
      heatmap,
      consensus: { enginesAligned, enginesTotal: 3, classification: 'WEAK_CONTEXT' },
      message: [
        'AGUARDAR — evidência insuficiente para sinal PAPER.',
        `Confiança=${confidence.toFixed(2)}`,
        `Risco=${risk.toFixed(2)}`,
        `Motores alinhados=${enginesAligned}/3`,
      ].join(String.fromCharCode(10)),
    });
  }

  private computeTriplicacao(rounds: readonly number[]): AnalyticsDecisionEngineResult['triplicacao'] {
    let tc = 0;
    let ntc = 0;
    let ta = 0;
    let nta = 0;
    let zeroTrios = 0;

    for (let index = rounds.length - 1; index >= 2; index -= 3) {
      const trio = [rounds[index], rounds[index - 1], rounds[index - 2]];

      if (trio.includes(0)) {
        zeroTrios += 1;
        continue;
      }

      const colors = trio.map((value) => REDS.has(value) ? 'R' : 'B');

      if (colors[0] === colors[1] && colors[1] === colors[2]) tc += 1;
      else if (colors[0] === colors[1] && colors[1] !== colors[2]) ntc += 1;
      else if (colors[0] !== colors[1] && colors[1] !== colors[2] && colors[0] === colors[2]) ta += 1;
      else if (colors[0] !== colors[1] && colors[1] === colors[2]) nta += 1;
    }

    const pairs = [
      ['TC', tc],
      ['NTC', ntc],
      ['TA', ta],
      ['NTA', nta],
    ] as const;

    const totalTrios = tc + ntc + ta + nta;
    let dominantPattern: 'TC' | 'NTC' | 'TA' | 'NTA' | 'NONE' = 'NONE';
    let dominantCount = 0;

    for (const [pattern, count] of pairs) {
      if (count > dominantCount) {
        dominantPattern = pattern;
        dominantCount = count;
      }
    }

    return Object.freeze({
      totalTrios,
      tc,
      ntc,
      ta,
      nta,
      zeroTrios,
      dominantPattern,
      dominantRatio: totalTrios > 0 ? dominantCount / totalTrios : 0,
    });
  }

  private computeHeatmap(rounds: readonly number[]): AnalyticsDecisionEngineResult['heatmap'] {
    const counts = new Map<number, number>();

    for (const number of ROULETTE_NUMBERS) counts.set(number, 0);
    for (const round of rounds) counts.set(round, (counts.get(round) ?? 0) + 1);

    const ranked = [...counts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0] - right[0];
    });

    return Object.freeze({
      hotNumbers: Object.freeze(ranked.filter(([, count]) => count > 0).slice(0, 5).map(([number]) => number)),
      coldNumbers: Object.freeze(ranked.slice().reverse().slice(0, 5).map(([number]) => number)),
      zeroFrequency: rounds.length > 0 ? (counts.get(0) ?? 0) / rounds.length : 0,
    });
  }

  private parseRounds(values: readonly string[]): readonly number[] {
    return Object.freeze(
      values
        .flatMap((value) => String(value).split(/[^0-9]+/u))
        .filter((part) => part.trim().length > 0)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 36),
    );
  }

  private result(input: Omit<AnalyticsDecisionEngineResult, 'paperOnly' | 'liveMoneyAuthorization' | 'automaticBetExecutionAllowed'>): AnalyticsDecisionEngineResult {
    return Object.freeze({
      ...input,
      paperOnly: true,
      liveMoneyAuthorization: false,
      automaticBetExecutionAllowed: false,
    });
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
