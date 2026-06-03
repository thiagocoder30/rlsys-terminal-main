'use strict';

const crypto = require('crypto');

const RECOMMENDATION_DECISIONS = Object.freeze({
  PAPER_FAVORAVEL: 'PAPER_FAVORAVEL',
  OBSERVAR: 'OBSERVAR',
  NAO_UTILIZAR: 'NAO_UTILIZAR',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  favorableScore: 0.78,
  observeScore: 0.52,
  minimumEvidenceCount: 4,
  minimumEvidenceConfidence: 0.55,
});

const DEFAULT_WEIGHTS = Object.freeze({
  graphConfidence: 0.16,
  contextSimilarity: 0.16,
  outcomeCorrelation: 0.18,
  learningStability: 0.16,
  recommendationGovernance: 0.16,
  operatorReadiness: 0.10,
  riskControl: 0.08,
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

function normalizeWeightMap(weights, fieldName) {
  if (weights === undefined) {
    return Object.freeze(Object.assign({}, DEFAULT_WEIGHTS));
  }

  if (weights === null || typeof weights !== 'object' || Array.isArray(weights)) {
    throw new TypeError(`${fieldName} must be an object`);
  }

  const normalized = Object.create(null);
  const expectedKeys = Object.keys(DEFAULT_WEIGHTS).sort();
  let total = 0;

  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index];

    if (!Object.prototype.hasOwnProperty.call(weights, key)) {
      throw new RangeError(`${fieldName}.${key} is required`);
    }

    assertUnit(weights[key], `${fieldName}.${key}`);
    normalized[key] = weights[key];
    total += weights[key];
  }

  if (total <= 0) {
    throw new RangeError(`${fieldName} total must be positive`);
  }

  const normalizedToOne = Object.create(null);
  let runningTotal = 0;

  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index];
    const value = index === expectedKeys.length - 1
      ? Number((1 - runningTotal).toFixed(6))
      : Number((normalized[key] / total).toFixed(6));

    normalizedToOne[key] = value;
    runningTotal += value;
  }

  return Object.freeze(normalizedToOne);
}

function normalizeEvidence(evidence, index) {
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new TypeError(`evidence[${index}] must be an object`);
  }

  const id = normalizeText(evidence.id, `evidence[${index}].id`);
  const source = normalizeText(evidence.source, `evidence[${index}].source`);
  const label = normalizeText(evidence.label, `evidence[${index}].label`);
  assertUnit(evidence.confidence, `evidence[${index}].confidence`);

  return Object.freeze({
    id,
    source,
    label,
    confidence: evidence.confidence,
  });
}

function normalizeMetrics(metrics) {
  if (metrics === null || typeof metrics !== 'object' || Array.isArray(metrics)) {
    throw new TypeError('input.metrics must be an object');
  }

  const requiredMetrics = Object.keys(DEFAULT_WEIGHTS).sort();
  const normalized = Object.create(null);

  for (let index = 0; index < requiredMetrics.length; index += 1) {
    const key = requiredMetrics[index];

    if (!Object.prototype.hasOwnProperty.call(metrics, key)) {
      throw new RangeError(`input.metrics.${key} is required`);
    }

    assertUnit(metrics[key], `input.metrics.${key}`);
    normalized[key] = metrics[key];
  }

  return Object.freeze(normalized);
}

/**
 * Institutional Recommendation Engine V2.
 *
 * Produces a supervised PAPER-only recommendation by combining institutional
 * graph confidence, context similarity, outcome correlation, learning stability,
 * recommendation governance, operator readiness and risk control.
 *
 * It never performs platform actions, never places bets and never authorizes
 * live money. Output is advisory only.
 *
 * Complexity:
 * - Time: O(m + e)
 * - Space: O(m + e)
 */
class InstitutionalRecommendationEngineV2 {
  constructor(thresholds, weights) {
    const resolvedThresholds = Object.assign({}, DEFAULT_THRESHOLDS, thresholds || {});

    assertUnit(resolvedThresholds.favorableScore, 'thresholds.favorableScore');
    assertUnit(resolvedThresholds.observeScore, 'thresholds.observeScore');
    assertUnit(resolvedThresholds.minimumEvidenceConfidence, 'thresholds.minimumEvidenceConfidence');

    if (!Number.isInteger(resolvedThresholds.minimumEvidenceCount) || resolvedThresholds.minimumEvidenceCount < 1) {
      throw new RangeError('thresholds.minimumEvidenceCount must be a positive integer');
    }

    if (resolvedThresholds.observeScore > resolvedThresholds.favorableScore) {
      throw new RangeError('thresholds.observeScore must be less than or equal to thresholds.favorableScore');
    }

    this.thresholds = Object.freeze(resolvedThresholds);
    this.weights = normalizeWeightMap(weights, 'weights');
  }

  evaluate(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('input must be an object');
    }

    const sessionId = normalizeText(input.sessionId, 'input.sessionId');
    const tableId = normalizeText(input.tableId, 'input.tableId');
    const strategyId = normalizeText(input.strategyId, 'input.strategyId');

    const metrics = normalizeMetrics(input.metrics);

    if (!Array.isArray(input.evidence)) {
      throw new TypeError('input.evidence must be an array');
    }

    const evidenceById = new Map();

    for (let index = 0; index < input.evidence.length; index += 1) {
      const evidence = normalizeEvidence(input.evidence[index], index);

      if (!evidenceById.has(evidence.id)) {
        evidenceById.set(evidence.id, evidence);
      }
    }

    const evidence = Array.from(evidenceById.values());
    const averageEvidenceConfidence = this.calculateAverageEvidenceConfidence(evidence);
    const recommendationScore = this.calculateRecommendationScore(metrics);
    const blockers = this.resolveBlockers({
      evidenceCount: evidence.length,
      averageEvidenceConfidence,
      metrics,
    });

    const decision = this.resolveDecision(recommendationScore, blockers);
    const explanation = this.buildExplanation(metrics, recommendationScore, blockers);

    const payload = Object.freeze({
      sprint: 241,
      engine: 'InstitutionalRecommendationEngineV2',
      sessionId,
      tableId,
      strategyId,
      decision,
      recommendationScore: Number(recommendationScore.toFixed(6)),
      averageEvidenceConfidence: Number(averageEvidenceConfidence.toFixed(6)),
      evidenceCount: evidence.length,
      blockers: Object.freeze(blockers),
      explanation: Object.freeze(explanation),
      weights: this.weights,
      metrics,
      evidence: Object.freeze(evidence),
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

  calculateAverageEvidenceConfidence(evidence) {
    if (evidence.length === 0) {
      return 0;
    }

    let total = 0;

    for (let index = 0; index < evidence.length; index += 1) {
      total += evidence[index].confidence;
    }

    return total / evidence.length;
  }

  calculateRecommendationScore(metrics) {
    const keys = Object.keys(this.weights);
    let score = 0;

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      score += metrics[key] * this.weights[key];
    }

    return score;
  }

  resolveBlockers(context) {
    const blockers = [];

    if (context.evidenceCount < this.thresholds.minimumEvidenceCount) {
      blockers.push('INSUFFICIENT_RECOMMENDATION_EVIDENCE');
    }

    if (context.averageEvidenceConfidence < this.thresholds.minimumEvidenceConfidence) {
      blockers.push('LOW_RECOMMENDATION_EVIDENCE_CONFIDENCE');
    }

    if (context.metrics.riskControl < this.thresholds.observeScore) {
      blockers.push('RISK_CONTROL_BELOW_OBSERVATION_THRESHOLD');
    }

    if (context.metrics.operatorReadiness < this.thresholds.observeScore) {
      blockers.push('OPERATOR_READINESS_BELOW_OBSERVATION_THRESHOLD');
    }

    return blockers;
  }

  resolveDecision(recommendationScore, blockers) {
    if (blockers.length > 0) {
      return RECOMMENDATION_DECISIONS.NAO_UTILIZAR;
    }

    if (recommendationScore >= this.thresholds.favorableScore) {
      return RECOMMENDATION_DECISIONS.PAPER_FAVORAVEL;
    }

    if (recommendationScore >= this.thresholds.observeScore) {
      return RECOMMENDATION_DECISIONS.OBSERVAR;
    }

    return RECOMMENDATION_DECISIONS.NAO_UTILIZAR;
  }

  buildExplanation(metrics, recommendationScore, blockers) {
    const strongestFactors = Object
      .keys(metrics)
      .map((key) => Object.freeze({
        factorName: key,
        value: metrics[key],
        weight: this.weights[key],
        contribution: Number((metrics[key] * this.weights[key]).toFixed(6)),
      }))
      .sort((left, right) => {
        if (right.contribution !== left.contribution) {
          return right.contribution - left.contribution;
        }

        return left.factorName.localeCompare(right.factorName);
      });

    return Object.freeze({
      summary: blockers.length > 0
        ? 'Recommendation blocked by defensive institutional governance.'
        : 'Recommendation produced for supervised PAPER evaluation only.',
      recommendationScore: Number(recommendationScore.toFixed(6)),
      strongestFactors: Object.freeze(strongestFactors.slice(0, 5)),
      blockers: Object.freeze(blockers.slice()),
      advisoryOnly: true,
    });
  }
}

module.exports = {
  RECOMMENDATION_DECISIONS,
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  InstitutionalRecommendationEngineV2,
};
