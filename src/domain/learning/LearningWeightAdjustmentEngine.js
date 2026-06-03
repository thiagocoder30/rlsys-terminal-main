'use strict';

const crypto = require('crypto');

const ADJUSTMENT_DECISIONS = Object.freeze({
  WEIGHTS_ADJUSTED: 'WEIGHTS_ADJUSTED',
  OBSERVE_WEIGHTS: 'OBSERVE_WEIGHTS',
  ADJUSTMENT_BLOCKED: 'ADJUSTMENT_BLOCKED',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  minimumEvidenceCount: 2,
  minimumEvidenceConfidence: 0.55,
  adjustmentStep: 0.04,
  maximumAdjustmentPerCycle: 0.08,
  minimumWeight: 0.05,
  maximumWeight: 0.6,
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

function assertPositiveNumber(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${fieldName} must be a positive finite number`);
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

function clamp(value, min, max) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function normalizeWeightMap(weights, fieldName) {
  if (weights === null || typeof weights !== 'object' || Array.isArray(weights)) {
    throw new TypeError(`${fieldName} must be an object`);
  }

  const normalized = Object.create(null);
  const keys = Object.keys(weights).sort();

  if (keys.length === 0) {
    throw new RangeError(`${fieldName} must not be empty`);
  }

  for (let index = 0; index < keys.length; index += 1) {
    const key = normalizeText(keys[index], `${fieldName}.key`);
    assertUnit(weights[key], `${fieldName}.${key}`);
    normalized[key] = weights[key];
  }

  return Object.freeze(normalized);
}

function normalizeEvidence(evidence, index) {
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new TypeError(`evidence[${index}] must be an object`);
  }

  const id = normalizeText(evidence.id, `evidence[${index}].id`);
  const factorName = normalizeText(evidence.factorName, `evidence[${index}].factorName`);
  const direction = normalizeText(evidence.direction, `evidence[${index}].direction`);

  if (direction !== 'INCREASE' && direction !== 'DECREASE' && direction !== 'HOLD') {
    throw new RangeError(`evidence[${index}].direction is not supported`);
  }

  assertUnit(evidence.confidence, `evidence[${index}].confidence`);
  assertUnit(evidence.strength, `evidence[${index}].strength`);

  return Object.freeze({
    id,
    factorName,
    direction,
    confidence: evidence.confidence,
    strength: evidence.strength,
  });
}

/**
 * Learning Weight Adjustment Engine.
 *
 * Applies bounded, deterministic, supervised adjustments to learning weights.
 * It never executes bets, never authorizes live money and never performs
 * automatic platform actions. It only prepares defensive PAPER learning state.
 *
 * Complexity:
 * - Time: O(w + e)
 * - Space: O(w + e)
 */
class LearningWeightAdjustmentEngine {
  constructor(thresholds) {
    const resolvedThresholds = Object.assign({}, DEFAULT_THRESHOLDS, thresholds || {});

    if (!Number.isInteger(resolvedThresholds.minimumEvidenceCount) || resolvedThresholds.minimumEvidenceCount < 1) {
      throw new RangeError('thresholds.minimumEvidenceCount must be a positive integer');
    }

    assertUnit(resolvedThresholds.minimumEvidenceConfidence, 'thresholds.minimumEvidenceConfidence');
    assertPositiveNumber(resolvedThresholds.adjustmentStep, 'thresholds.adjustmentStep');
    assertPositiveNumber(resolvedThresholds.maximumAdjustmentPerCycle, 'thresholds.maximumAdjustmentPerCycle');
    assertUnit(resolvedThresholds.minimumWeight, 'thresholds.minimumWeight');
    assertUnit(resolvedThresholds.maximumWeight, 'thresholds.maximumWeight');

    if (resolvedThresholds.minimumWeight > resolvedThresholds.maximumWeight) {
      throw new RangeError('thresholds.minimumWeight must be less than or equal to thresholds.maximumWeight');
    }

    if (resolvedThresholds.adjustmentStep > resolvedThresholds.maximumAdjustmentPerCycle) {
      throw new RangeError('thresholds.adjustmentStep must be less than or equal to thresholds.maximumAdjustmentPerCycle');
    }

    this.thresholds = Object.freeze(resolvedThresholds);
  }

  adjust(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('input must be an object');
    }

    const sessionId = normalizeText(input.sessionId, 'input.sessionId');
    const currentWeights = normalizeWeightMap(input.currentWeights, 'input.currentWeights');

    if (!Array.isArray(input.evidence)) {
      throw new TypeError('input.evidence must be an array');
    }

    const evidenceById = new Map();

    for (let index = 0; index < input.evidence.length; index += 1) {
      const normalized = normalizeEvidence(input.evidence[index], index);

      if (!evidenceById.has(normalized.id)) {
        evidenceById.set(normalized.id, normalized);
      }
    }

    const evidence = Array.from(evidenceById.values());
    const averageEvidenceConfidence = this.calculateAverageEvidenceConfidence(evidence);
    const blockers = this.resolveBlockers({
      evidenceCount: evidence.length,
      averageEvidenceConfidence,
    });

    const adjustmentPlan = this.buildAdjustmentPlan(currentWeights, evidence);
    const adjustedWeights = this.applyAdjustmentPlan(currentWeights, adjustmentPlan);
    const normalizedWeights = this.normalizeAdjustedWeights(adjustedWeights);

    const decision = this.resolveDecision(blockers, adjustmentPlan);

    const payload = Object.freeze({
      sprint: 239,
      engine: 'LearningWeightAdjustmentEngine',
      sessionId,
      decision,
      evidenceCount: evidence.length,
      averageEvidenceConfidence: Number(averageEvidenceConfidence.toFixed(6)),
      blockers: Object.freeze(blockers),
      currentWeights,
      adjustmentPlan: Object.freeze(adjustmentPlan),
      adjustedWeights: Object.freeze(normalizedWeights),
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

  resolveBlockers(context) {
    const blockers = [];

    if (context.evidenceCount < this.thresholds.minimumEvidenceCount) {
      blockers.push('INSUFFICIENT_LEARNING_EVIDENCE');
    }

    if (context.averageEvidenceConfidence < this.thresholds.minimumEvidenceConfidence) {
      blockers.push('LOW_LEARNING_EVIDENCE_CONFIDENCE');
    }

    return blockers;
  }

  buildAdjustmentPlan(currentWeights, evidence) {
    const deltas = Object.create(null);
    const weightKeys = Object.keys(currentWeights);

    for (let index = 0; index < weightKeys.length; index += 1) {
      deltas[weightKeys[index]] = 0;
    }

    for (let index = 0; index < evidence.length; index += 1) {
      const item = evidence[index];

      if (!Object.prototype.hasOwnProperty.call(deltas, item.factorName)) {
        continue;
      }

      if (item.direction === 'HOLD') {
        continue;
      }

      const directionMultiplier = item.direction === 'INCREASE' ? 1 : -1;
      const rawDelta = this.thresholds.adjustmentStep * item.confidence * item.strength * directionMultiplier;
      const boundedDelta = clamp(
        rawDelta,
        -this.thresholds.maximumAdjustmentPerCycle,
        this.thresholds.maximumAdjustmentPerCycle
      );

      deltas[item.factorName] += boundedDelta;
      deltas[item.factorName] = clamp(
        deltas[item.factorName],
        -this.thresholds.maximumAdjustmentPerCycle,
        this.thresholds.maximumAdjustmentPerCycle
      );
    }

    const plan = [];

    for (let index = 0; index < weightKeys.length; index += 1) {
      const factorName = weightKeys[index];
      const delta = Number(deltas[factorName].toFixed(6));

      if (delta !== 0) {
        plan.push(Object.freeze({
          factorName,
          delta,
          direction: delta > 0 ? 'INCREASE' : 'DECREASE',
        }));
      }
    }

    plan.sort((left, right) => left.factorName.localeCompare(right.factorName));

    return plan;
  }

  applyAdjustmentPlan(currentWeights, adjustmentPlan) {
    const adjusted = Object.create(null);
    const keys = Object.keys(currentWeights);

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      adjusted[key] = currentWeights[key];
    }

    for (let index = 0; index < adjustmentPlan.length; index += 1) {
      const item = adjustmentPlan[index];
      adjusted[item.factorName] = clamp(
        adjusted[item.factorName] + item.delta,
        this.thresholds.minimumWeight,
        this.thresholds.maximumWeight
      );
    }

    return adjusted;
  }

  normalizeAdjustedWeights(weights) {
    const keys = Object.keys(weights).sort();
    let total = 0;

    for (let index = 0; index < keys.length; index += 1) {
      total += weights[keys[index]];
    }

    if (total <= 0) {
      throw new Error('adjusted weight total must be positive');
    }

    const normalized = Object.create(null);
    let runningTotal = 0;

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const value = index === keys.length - 1
        ? Number((1 - runningTotal).toFixed(6))
        : Number((weights[key] / total).toFixed(6));

      normalized[key] = value;
      runningTotal += value;
    }

    return normalized;
  }

  resolveDecision(blockers, adjustmentPlan) {
    if (blockers.length > 0) {
      return ADJUSTMENT_DECISIONS.ADJUSTMENT_BLOCKED;
    }

    if (adjustmentPlan.length === 0) {
      return ADJUSTMENT_DECISIONS.OBSERVE_WEIGHTS;
    }

    return ADJUSTMENT_DECISIONS.WEIGHTS_ADJUSTED;
  }
}

module.exports = {
  ADJUSTMENT_DECISIONS,
  DEFAULT_THRESHOLDS,
  LearningWeightAdjustmentEngine,
};
