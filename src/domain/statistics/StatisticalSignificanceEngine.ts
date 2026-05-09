export type StatisticalVerdict = 'NO_EVIDENCE' | 'WEAK_EVIDENCE' | 'MODERATE_EVIDENCE' | 'STRONG_EVIDENCE';
export type StatisticalRisk = 'low' | 'moderate' | 'high';

export interface NumberDeviation {
  value: number;
  observed: number;
  expected: number;
  zScore: number;
  proportion: number;
  confidenceInterval95: { lower: number; upper: number };
}

export interface StatisticalSignificanceReport {
  sampleSize: number;
  degreesOfFreedom: number;
  chiSquare: number;
  pValue: number;
  significantAt95: boolean;
  significantAt99: boolean;
  entropy: number;
  normalizedEntropy: number;
  entropyDeviation: number;
  klDivergence: number;
  jensenShannonDivergence: number;
  maxAbsoluteZScore: number;
  topDeviations: NumberDeviation[];
  evidenceScore: number;
  verdict: StatisticalVerdict;
  statisticalRisk: StatisticalRisk;
  recommendations: string[];
}

const ROULETTE_SLOTS = 37;
const EPSILON = 1e-12;

export class StatisticalSignificanceEngine {
  public analyze(values: number[]): StatisticalSignificanceReport {
    const sampleSize = values.length;
    const counts = this.countValues(values);
    const expected = sampleSize / ROULETTE_SLOTS;
    const deviations = counts.map((observed, value) => this.toDeviation(value, observed, expected, sampleSize));
    const chiSquare = expected === 0 ? 0 : counts.reduce((sum, observed) => sum + ((observed - expected) ** 2) / expected, 0);
    const degreesOfFreedom = ROULETTE_SLOTS - 1;
    const pValue = sampleSize === 0 ? 1 : chiSquareSurvival(chiSquare, degreesOfFreedom);
    const entropy = this.shannonEntropy(counts, sampleSize);
    const maxEntropy = Math.log2(ROULETTE_SLOTS);
    const normalizedEntropy = maxEntropy === 0 ? 0 : entropy / maxEntropy;
    const entropyDeviation = 1 - normalizedEntropy;
    const observedDistribution = counts.map(count => (count + EPSILON) / (sampleSize + EPSILON * ROULETTE_SLOTS));
    const uniform = Array.from({ length: ROULETTE_SLOTS }, () => 1 / ROULETTE_SLOTS);
    const klDivergence = this.klDivergence(observedDistribution, uniform);
    const jensenShannonDivergence = this.jensenShannonDivergence(observedDistribution, uniform);
    const maxAbsoluteZScore = deviations.reduce((max, item) => Math.max(max, Math.abs(item.zScore)), 0);
    const evidenceScore = this.evidenceScore({ pValue, entropyDeviation, jensenShannonDivergence, maxAbsoluteZScore, sampleSize });
    const verdict = this.verdict(evidenceScore, pValue, sampleSize);
    const statisticalRisk = this.risk(verdict, sampleSize);

    return {
      sampleSize,
      degreesOfFreedom,
      chiSquare: round(chiSquare),
      pValue: round(pValue),
      significantAt95: pValue < 0.05,
      significantAt99: pValue < 0.01,
      entropy: round(entropy),
      normalizedEntropy: round(normalizedEntropy),
      entropyDeviation: round(entropyDeviation),
      klDivergence: round(klDivergence),
      jensenShannonDivergence: round(jensenShannonDivergence),
      maxAbsoluteZScore: round(maxAbsoluteZScore),
      topDeviations: deviations.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 8),
      evidenceScore: round(evidenceScore),
      verdict,
      statisticalRisk,
      recommendations: this.recommendations(sampleSize, pValue, normalizedEntropy, verdict)
    };
  }

  private countValues(values: number[]): number[] {
    const counts = Array.from({ length: ROULETTE_SLOTS }, () => 0);
    values.forEach(value => {
      if (Number.isInteger(value) && value >= 0 && value < ROULETTE_SLOTS) counts[value] += 1;
    });
    return counts;
  }

  private toDeviation(value: number, observed: number, expected: number, sampleSize: number): NumberDeviation {
    const p = sampleSize === 0 ? 0 : observed / sampleSize;
    const theoreticalP = 1 / ROULETTE_SLOTS;
    const standardDeviation = Math.sqrt(sampleSize * theoreticalP * (1 - theoreticalP));
    const zScore = standardDeviation === 0 ? 0 : (observed - expected) / standardDeviation;
    return {
      value,
      observed,
      expected: round(expected),
      zScore: round(zScore),
      proportion: round(p),
      confidenceInterval95: wilsonInterval(observed, sampleSize, 1.96)
    };
  }

  private shannonEntropy(counts: number[], sampleSize: number): number {
    if (sampleSize === 0) return 0;
    return counts.reduce((entropy, count) => {
      if (count === 0) return entropy;
      const p = count / sampleSize;
      return entropy - p * Math.log2(p);
    }, 0);
  }

  private klDivergence(p: number[], q: number[]): number {
    return p.reduce((sum, pi, index) => sum + pi * Math.log2(pi / Math.max(q[index], EPSILON)), 0);
  }

  private jensenShannonDivergence(p: number[], q: number[]): number {
    const midpoint = p.map((pi, index) => (pi + q[index]) / 2);
    return (this.klDivergence(p, midpoint) + this.klDivergence(q, midpoint)) / 2;
  }

  private evidenceScore(input: { pValue: number; entropyDeviation: number; jensenShannonDivergence: number; maxAbsoluteZScore: number; sampleSize: number }): number {
    const pComponent = Math.max(0, Math.min(1, 1 - input.pValue));
    const entropyComponent = Math.max(0, Math.min(1, input.entropyDeviation * 5));
    const divergenceComponent = Math.max(0, Math.min(1, input.jensenShannonDivergence * 12));
    const zComponent = Math.max(0, Math.min(1, input.maxAbsoluteZScore / 4));
    const samplePenalty = input.sampleSize < 500 ? 0.72 : input.sampleSize < 2_000 ? 0.88 : 1;
    return (pComponent * 0.35 + entropyComponent * 0.2 + divergenceComponent * 0.25 + zComponent * 0.2) * samplePenalty;
  }

  private verdict(score: number, pValue: number, sampleSize: number): StatisticalVerdict {
    if (sampleSize < 120) return 'NO_EVIDENCE';
    if (score >= 0.78 && pValue < 0.01) return 'STRONG_EVIDENCE';
    if (score >= 0.62 && pValue < 0.05) return 'MODERATE_EVIDENCE';
    if (score >= 0.45 || pValue < 0.1) return 'WEAK_EVIDENCE';
    return 'NO_EVIDENCE';
  }

  private risk(verdict: StatisticalVerdict, sampleSize: number): StatisticalRisk {
    if (sampleSize < 500) return 'high';
    if (verdict === 'STRONG_EVIDENCE' || verdict === 'MODERATE_EVIDENCE') return 'moderate';
    return 'high';
  }

  private recommendations(sampleSize: number, pValue: number, normalizedEntropy: number, verdict: StatisticalVerdict): string[] {
    const recommendations: string[] = [];
    if (sampleSize < 500) recommendations.push('Aumentar amostra para pelo menos 500 spins antes de classificar significância operacional.');
    if (sampleSize < 10_000) recommendations.push('Para pesquisa institucional, coletar 10.000+ spins por mesa/regime.');
    if (pValue < 0.05) recommendations.push('Validar o desvio em out-of-sample antes de liberar qualquer hipótese de edge.');
    if (normalizedEntropy < 0.92) recommendations.push('Investigar compressão de entropia com segmentação temporal e controle de duplicatas.');
    if (verdict === 'NO_EVIDENCE') recommendations.push('Não inferir edge: distribuição compatível com ruído ou amostra insuficiente.');
    return recommendations;
  }
}

function wilsonInterval(successes: number, n: number, z: number): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 0 };
  const p = successes / n;
  const denominator = 1 + (z ** 2) / n;
  const centre = p + (z ** 2) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z ** 2) / (4 * n)) / n);
  return { lower: round(Math.max(0, (centre - margin) / denominator)), upper: round(Math.min(1, (centre + margin) / denominator)) };
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}

function chiSquareSurvival(x: number, k: number): number {
  if (x <= 0) return 1;
  return round(gammaRegularizedQ(k / 2, x / 2));
}

function gammaRegularizedQ(a: number, x: number): number {
  if (x < 0 || a <= 0) return Number.NaN;
  if (x === 0) return 1;
  if (x < a + 1) return 1 - gammaRegularizedPSeries(a, x);
  return gammaRegularizedQContinuedFraction(a, x);
}

function gammaRegularizedPSeries(a: number, x: number): number {
  let sum = 1 / a;
  let del = sum;
  let ap = a;
  for (let n = 1; n <= 200; n += 1) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

function gammaRegularizedQContinuedFraction(a: number, x: number): number {
  const fpmin = 1e-30;
  let b = x + 1 - a;
  let c = 1 / fpmin;
  let d = 1 / Math.max(b, fpmin);
  let h = d;

  for (let i = 1; i <= 200; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = b + an / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }

  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

function logGamma(z: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7
  ];

  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.9999999999998099;
  for (let i = 0; i < coefficients.length; i += 1) x += coefficients[i] / (z + i + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
