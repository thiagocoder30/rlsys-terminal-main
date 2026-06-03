'use strict';

const crypto = require('crypto');

const OUTCOMES = Object.freeze({
  PAPER_WIN: 'PAPER_WIN',
  PAPER_LOSS: 'PAPER_LOSS',
  PAPER_NEUTRAL: 'PAPER_NEUTRAL',
});

const CORRELATION_DECISIONS = Object.freeze({
  CORRELATION_READY: 'CORRELATION_READY',
  OBSERVE_CORRELATION: 'OBSERVE_CORRELATION',
  INSUFFICIENT_CORRELATION: 'INSUFFICIENT_CORRELATION',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  minimumObservationCount: 3,
  minimumFactorSupport: 2,
  minimumReliableCorrelation: 0.25,
  strongCorrelation: 0.55,
  maximumFactors: 8,
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

function outcomeToScore(outcome) {
  if (outcome === OUTCOMES.PAPER_WIN) {
    return 1;
  }

  if (outcome === OUTCOMES.PAPER_NEUTRAL) {
    return 0.5;
  }

  if (outcome === OUTCOMES.PAPER_LOSS) {
    return 0;
  }

  throw new RangeError('outcome is not supported');
}

function normalizeFactors(factors, fieldName) {
  if (factors === null || typeof factors !== 'object' || Array.isArray(factors)) {
    throw new TypeError(`${fieldName} must be an object`);
  }

  const normalized = Object.create(null);
  const keys = Object.keys(factors).sort();

  for (let index = 0; index < keys.length; index += 1) {
    const key = normalizeText(keys[index], `${fieldName}.key`);
    assertUnit(factors[key], `${fieldName}.${key}`);
    normalized[key] = factors[key];
  }

  return Object.freeze(normalized);
}

function normalizeObservation(observation, index) {
  if (observation === null || typeof observation !== 'object' || Array.isArray(observation)) {
    throw new TypeError(`observations[${index}] must be an object`);
  }

  const id = normalizeText(observation.id, `observations[${index}].id`);
  const contextId = normalizeText(observation.contextId, `observations[${index}].contextId`);
  const strategyId = normalizeText(observation.strategyId, `observations[${index}].strategyId`);
  const outcome = normalizeText(observation.outcome, `observations[${index}].outcome`);
  const outcomeScore = outcomeToScore(outcome);

  return Object.freeze({
    id,
    contextId,
    strategyId,
    outcome,
    outcomeScore,
    factors: normalizeFactors(observation.factors, `observations[${index}].factors`),
  });
}

function calculatePearsonCorrelation(pairs) {
  const count = pairs.length;

  if (count < 2) {
    return 0;
  }

  let sumX = 0;
  let sumY = 0;

  for (let index = 0; index < count; index += 1) {
    sumX += pairs[index].x;
    sumY += pairs[index].y;
  }

  const meanX = sumX / count;
  const meanY = sumY / count;

  let numerator = 0;
  let varianceX = 0;
  let varianceY = 0;

  for (let index = 0; index < count; index += 1) {
    const deltaX = pairs[index].x - meanX;
    const deltaY = pairs[index].y - meanY;

    numerator += deltaX * deltaY;
    varianceX += deltaX * deltaX;
    varianceY += deltaY * deltaY;
  }

  if (varianceX === 0 || varianceY === 0) {
    return 0;
  }

  return numerator / Math.sqrt(varianceX * varianceY);
}

/**
 * Outcome Correlation Engine.
 *
 * Computes explainable factor-to-outcome correlations from PAPER observations.
 * This engine does not place bets, does not execute platform actions, and does
 * not authorize live money. It produces defensive learning evidence only.
 *
 * Complexity:
 * - Time: O(o * f)
 * - Space: O(o + f)
 */
class OutcomeCorrelationEngine {
  constructor(thresholds) {
    const resolvedThresholds = Object.assign({}, DEFAULT_THRESHOLDS, thresholds || {});

    assertPositiveInteger(resolvedThresholds.minimumObservationCount, 'thresholds.minimumObservationCount');
    assertPositiveInteger(resolvedThresholds.minimumFactorSupport, 'thresholds.minimumFactorSupport');
    assertUnit(resolvedThresholds.minimumReliableCorrelation, 'thresholds.minimumReliableCorrelation');
    assertUnit(resolvedThresholds.strongCorrelation, 'thresholds.strongCorrelation');
    assertPositiveInteger(resolvedThresholds.maximumFactors, 'thresholds.maximumFactors');

    if (resolvedThresholds.minimumReliableCorrelation > resolvedThresholds.strongCorrelation) {
      throw new RangeError('thresholds.minimumReliableCorrelation must be less than or equal to thresholds.strongCorrelation');
    }

    this.thresholds = Object.freeze(resolvedThresholds);
  }

  analyze(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('input must be an object');
    }

    const sessionId = normalizeText(input.sessionId, 'input.sessionId');

    if (!Array.isArray(input.observations)) {
      throw new TypeError('input.observations must be an array');
    }

    const observationsById = new Map();

    for (let index = 0; index < input.observations.length; index += 1) {
      const observation = normalizeObservation(input.observations[index], index);

      if (!observationsById.has(observation.id)) {
        observationsById.set(observation.id, observation);
      }
    }

    const observations = Array.from(observationsById.values());
    const factors = this.calculateFactorCorrelations(observations);
    const rankedFactors = factors.slice(0, this.thresholds.maximumFactors);
    const strongestCorrelation = rankedFactors.length === 0
      ? 0
      : Math.abs(rankedFactors[0].correlation);

    const blockers = this.resolveBlockers({
      observationCount: observations.length,
      factorCount: rankedFactors.length,
      strongestCorrelation,
    });

    const decision = this.resolveDecision(strongestCorrelation, blockers);

    const payload = Object.freeze({
      sprint: 238,
      engine: 'OutcomeCorrelationEngine',
      sessionId,
      decision,
      observationCount: observations.length,
      factorCount: rankedFactors.length,
      strongestCorrelation: Number(strongestCorrelation.toFixed(6)),
      blockers: Object.freeze(blockers),
      factors: Object.freeze(rankedFactors),
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

  calculateFactorCorrelations(observations) {
    const factorPairs = new Map();

    for (let observationIndex = 0; observationIndex < observations.length; observationIndex += 1) {
      const observation = observations[observationIndex];
      const factorKeys = Object.keys(observation.factors);

      for (let factorIndex = 0; factorIndex < factorKeys.length; factorIndex += 1) {
        const key = factorKeys[factorIndex];

        if (!factorPairs.has(key)) {
          factorPairs.set(key, []);
        }

        factorPairs.get(key).push({
          x: observation.factors[key],
          y: observation.outcomeScore,
        });
      }
    }

    const correlations = [];

    for (const [factorName, pairs] of factorPairs.entries()) {
      if (pairs.length >= this.thresholds.minimumFactorSupport) {
        const correlation = Number(calculatePearsonCorrelation(pairs).toFixed(6));

        correlations.push(Object.freeze({
          factorName,
          support: pairs.length,
          correlation,
          strength: Math.abs(correlation),
          direction: correlation > 0 ? 'POSITIVE' : correlation < 0 ? 'NEGATIVE' : 'NEUTRAL',
        }));
      }
    }

    correlations.sort((left, right) => {
      if (right.strength !== left.strength) {
        return right.strength - left.strength;
      }

      return left.factorName.localeCompare(right.factorName);
    });

    return correlations;
  }

  resolveBlockers(context) {
    const blockers = [];

    if (context.observationCount < this.thresholds.minimumObservationCount) {
      blockers.push('INSUFFICIENT_OUTCOME_OBSERVATIONS');
    }

    if (context.factorCount === 0) {
      blockers.push('NO_SUPPORTED_FACTORS');
    }

    if (context.strongestCorrelation < this.thresholds.minimumReliableCorrelation) {
      blockers.push('NO_RELIABLE_OUTCOME_CORRELATION');
    }

    return blockers;
  }

  resolveDecision(strongestCorrelation, blockers) {
    if (blockers.length > 0) {
      return CORRELATION_DECISIONS.INSUFFICIENT_CORRELATION;
    }

    if (strongestCorrelation >= this.thresholds.strongCorrelation) {
      return CORRELATION_DECISIONS.CORRELATION_READY;
    }

    return CORRELATION_DECISIONS.OBSERVE_CORRELATION;
  }
}

module.exports = {
  OUTCOMES,
  CORRELATION_DECISIONS,
  DEFAULT_THRESHOLDS,
  OutcomeCorrelationEngine,
};
