'use strict';

const crypto = require('crypto');

const EXPLAINABILITY_LEVELS = Object.freeze({
  FAVORABLE: 'FAVORABLE',
  OBSERVATION: 'OBSERVATION',
  BLOCKED: 'BLOCKED',
});

const SUPPORTED_DECISIONS = Object.freeze({
  PAPER_FAVORAVEL: 'PAPER_FAVORAVEL',
  OBSERVAR: 'OBSERVAR',
  NAO_UTILIZAR: 'NAO_UTILIZAR',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  minimumScoreForFavorableNarrative: 0.78,
  minimumScoreForObservationNarrative: 0.52,
  maximumFactors: 5,
  maximumBlockers: 8,
  minimumEvidenceCount: 1,
});

function normalizeText(value, fieldName) {
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a string`);
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new RangeError(`${fieldName} must not be empty`);
  }

  return normalized;
}

function assertUnit(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${fieldName} must be a finite number`);
  }

  if (value < 0 || value > 1) {
    throw new RangeError(`${fieldName} must be between 0 and 1`);
  }
}

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${fieldName} must be a positive integer`);
  }
}

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
  return `{${pairs.join(',')}}`;
}

function checksumOf(payload) {
  return crypto
    .createHash('sha256')
    .update(stableSerialize(payload))
    .digest('hex');
}

function normalizeDecision(decision) {
  const normalized = normalizeText(decision, 'input.decision');

  if (!Object.prototype.hasOwnProperty.call(SUPPORTED_DECISIONS, normalized)) {
    throw new RangeError('input.decision is not supported');
  }

  return normalized;
}

function normalizeFactor(factor, index) {
  if (factor === null || typeof factor !== 'object' || Array.isArray(factor)) {
    throw new TypeError(`input.factors[${index}] must be an object`);
  }

  const factorName = normalizeText(factor.factorName, `input.factors[${index}].factorName`);
  assertUnit(factor.value, `input.factors[${index}].value`);
  assertUnit(factor.weight, `input.factors[${index}].weight`);

  const contribution = typeof factor.contribution === 'number'
    ? factor.contribution
    : factor.value * factor.weight;

  if (!Number.isFinite(contribution)) {
    throw new TypeError(`input.factors[${index}].contribution must be finite`);
  }

  return Object.freeze({
    factorName,
    value: factor.value,
    weight: factor.weight,
    contribution: Number(contribution.toFixed(6)),
  });
}

function normalizeEvidence(evidence, index) {
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new TypeError(`input.evidence[${index}] must be an object`);
  }

  const id = normalizeText(evidence.id, `input.evidence[${index}].id`);
  const source = normalizeText(evidence.source, `input.evidence[${index}].source`);
  const label = normalizeText(evidence.label, `input.evidence[${index}].label`);
  assertUnit(evidence.confidence, `input.evidence[${index}].confidence`);

  return Object.freeze({
    id,
    source,
    label,
    confidence: evidence.confidence,
  });
}

function normalizeBlockers(blockers) {
  if (blockers === undefined) {
    return Object.freeze([]);
  }

  if (!Array.isArray(blockers)) {
    throw new TypeError('input.blockers must be an array');
  }

  const normalized = [];
  const seen = new Set();

  for (let index = 0; index < blockers.length; index += 1) {
    const blocker = normalizeText(blockers[index], `input.blockers[${index}]`);

    if (!seen.has(blocker)) {
      seen.add(blocker);
      normalized.push(blocker);
    }
  }

  return Object.freeze(normalized.sort());
}

/**
 * Recommendation Explainability Engine.
 *
 * Converts the V2 recommendation output into a deterministic, auditable,
 * human-readable institutional explanation. It is advisory-only and does not
 * execute operations, place bets or authorize live money.
 *
 * Complexity:
 * - Time: O(f + e + b)
 * - Space: O(f + e + b)
 */
class RecommendationExplainabilityEngine {
  constructor(thresholds) {
    const resolvedThresholds = Object.assign({}, DEFAULT_THRESHOLDS, thresholds || {});

    assertUnit(resolvedThresholds.minimumScoreForFavorableNarrative, 'thresholds.minimumScoreForFavorableNarrative');
    assertUnit(resolvedThresholds.minimumScoreForObservationNarrative, 'thresholds.minimumScoreForObservationNarrative');
    assertPositiveInteger(resolvedThresholds.maximumFactors, 'thresholds.maximumFactors');
    assertPositiveInteger(resolvedThresholds.maximumBlockers, 'thresholds.maximumBlockers');
    assertPositiveInteger(resolvedThresholds.minimumEvidenceCount, 'thresholds.minimumEvidenceCount');

    if (resolvedThresholds.minimumScoreForObservationNarrative > resolvedThresholds.minimumScoreForFavorableNarrative) {
      throw new RangeError('thresholds.minimumScoreForObservationNarrative must be less than or equal to thresholds.minimumScoreForFavorableNarrative');
    }

    this.thresholds = Object.freeze(resolvedThresholds);
  }

  explain(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('input must be an object');
    }

    const sessionId = normalizeText(input.sessionId, 'input.sessionId');
    const tableId = normalizeText(input.tableId, 'input.tableId');
    const strategyId = normalizeText(input.strategyId, 'input.strategyId');
    const decision = normalizeDecision(input.decision);
    assertUnit(input.recommendationScore, 'input.recommendationScore');

    if (!Array.isArray(input.factors)) {
      throw new TypeError('input.factors must be an array');
    }

    if (!Array.isArray(input.evidence)) {
      throw new TypeError('input.evidence must be an array');
    }

    const factorMap = new Map();

    for (let index = 0; index < input.factors.length; index += 1) {
      const factor = normalizeFactor(input.factors[index], index);

      if (!factorMap.has(factor.factorName)) {
        factorMap.set(factor.factorName, factor);
      }
    }

    const evidenceMap = new Map();

    for (let index = 0; index < input.evidence.length; index += 1) {
      const evidence = normalizeEvidence(input.evidence[index], index);

      if (!evidenceMap.has(evidence.id)) {
        evidenceMap.set(evidence.id, evidence);
      }
    }

    const blockers = normalizeBlockers(input.blockers);
    const strongestFactors = this.rankFactors(Array.from(factorMap.values())).slice(0, this.thresholds.maximumFactors);
    const evidence = Array.from(evidenceMap.values()).sort((left, right) => left.id.localeCompare(right.id));
    const level = this.resolveLevel(decision, input.recommendationScore, blockers);
    const narrative = this.buildNarrative({
      decision,
      recommendationScore: input.recommendationScore,
      level,
      strongestFactors,
      blockers,
      evidenceCount: evidence.length,
    });

    const payload = Object.freeze({
      sprint: 242,
      engine: 'RecommendationExplainabilityEngine',
      sessionId,
      tableId,
      strategyId,
      decision,
      explainabilityLevel: level,
      recommendationScore: Number(input.recommendationScore.toFixed(6)),
      narrative,
      strongestFactors: Object.freeze(strongestFactors),
      blockers: Object.freeze(blockers.slice(0, this.thresholds.maximumBlockers)),
      evidenceCount: evidence.length,
      evidence: Object.freeze(evidence),
      advisoryOnly: true,
      institutionalFlags: Object.freeze({
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        humanSupervisionRequired: true,
      }),
    });

    return Object.freeze(Object.assign({}, payload, {
      checksum: checksumOf(payload),
    }));
  }

  rankFactors(factors) {
    return factors
      .slice()
      .sort((left, right) => {
        if (right.contribution !== left.contribution) {
          return right.contribution - left.contribution;
        }

        return left.factorName.localeCompare(right.factorName);
      });
  }

  resolveLevel(decision, recommendationScore, blockers) {
    if (decision === SUPPORTED_DECISIONS.NAO_UTILIZAR || blockers.length > 0) {
      return EXPLAINABILITY_LEVELS.BLOCKED;
    }

    if (
      decision === SUPPORTED_DECISIONS.PAPER_FAVORAVEL
      && recommendationScore >= this.thresholds.minimumScoreForFavorableNarrative
    ) {
      return EXPLAINABILITY_LEVELS.FAVORABLE;
    }

    return EXPLAINABILITY_LEVELS.OBSERVATION;
  }

  buildNarrative(context) {
    if (context.blockers.length > 0) {
      return Object.freeze({
        title: 'Recomendação bloqueada pela governança defensiva.',
        summary: 'O contexto possui bloqueadores institucionais e deve ser classificado como NAO_UTILIZAR.',
        operatorAction: 'Não utilizar a estratégia neste contexto. Continuar observando.',
        topReason: context.blockers[0],
      });
    }

    if (context.level === EXPLAINABILITY_LEVELS.FAVORABLE) {
      return Object.freeze({
        title: 'Contexto favorável para avaliação PAPER supervisionada.',
        summary: 'A recomendação é favorável apenas para avaliação manual, sem execução automática.',
        operatorAction: 'Operador pode avaliar manualmente a estratégia indicada em modo PAPER.',
        topReason: context.strongestFactors.length > 0
          ? context.strongestFactors[0].factorName
          : 'NO_FACTOR_AVAILABLE',
      });
    }

    return Object.freeze({
      title: 'Contexto exige observação institucional.',
      summary: 'A evidência disponível não justifica classificação favorável.',
      operatorAction: 'Manter observação, aguardar novas evidências e não antecipar entrada.',
      topReason: context.strongestFactors.length > 0
        ? context.strongestFactors[0].factorName
        : 'NO_FACTOR_AVAILABLE',
    });
  }
}

module.exports = {
  EXPLAINABILITY_LEVELS,
  SUPPORTED_DECISIONS,
  DEFAULT_THRESHOLDS,
  RecommendationExplainabilityEngine,
};
