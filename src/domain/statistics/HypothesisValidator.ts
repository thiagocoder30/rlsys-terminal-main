import { StatisticalSignificanceReport } from './StatisticalSignificanceEngine';

export type HypothesisDecision = 'REJECT_RANDOMNESS' | 'INCONCLUSIVE' | 'ACCEPT_RANDOMNESS_BASELINE';

export interface HypothesisValidationResult {
  nullHypothesis: string;
  alternativeHypothesis: string;
  alpha: number;
  decision: HypothesisDecision;
  rationale: string[];
  productionGate: 'BLOCK' | 'REVIEW' | 'ALLOW_RESEARCH_ONLY';
}

export class HypothesisValidator {
  public validateUniformRandomness(report: StatisticalSignificanceReport, alpha = 0.05): HypothesisValidationResult {
    const reject = report.pValue < alpha;
    const rationale: string[] = [];

    if (reject) rationale.push(`p-value ${report.pValue} abaixo de alpha ${alpha}: distribuição observada desviou do baseline uniforme.`);
    else rationale.push(`p-value ${report.pValue} não rejeita o baseline uniforme com alpha ${alpha}.`);

    if (report.sampleSize < 500) rationale.push('Amostra abaixo do mínimo recomendado para decisão operacional; manter bloqueio.');
    if (report.verdict === 'STRONG_EVIDENCE') rationale.push('Evidência estatística forte detectada; exigir validação fora da amostra.');
    if (report.verdict === 'NO_EVIDENCE') rationale.push('Sem evidência estatística suficiente para hipótese de edge.');

    const decision: HypothesisDecision = reject
      ? 'REJECT_RANDOMNESS'
      : report.sampleSize >= 500 ? 'ACCEPT_RANDOMNESS_BASELINE' : 'INCONCLUSIVE';

    const productionGate = report.sampleSize < 2_000 || report.verdict !== 'STRONG_EVIDENCE'
      ? 'BLOCK'
      : 'ALLOW_RESEARCH_ONLY';

    return {
      nullHypothesis: 'A sequência observada é compatível com distribuição uniforme independente da roleta europeia.',
      alternativeHypothesis: 'A sequência observada apresenta desvio estatisticamente detectável contra o baseline uniforme.',
      alpha,
      decision,
      rationale,
      productionGate
    };
  }
}
