'use strict';

const crypto = require('crypto');

const SIMILARITY_DECISIONS = Object.freeze({
  SIMILAR_CONTEXT_FOUND: 'SIMILAR_CONTEXT_FOUND',
  OBSERVE_CONTEXT: 'OBSERVE_CONTEXT',
  NO_RELIABLE_CONTEXT: 'NO_RELIABLE_CONTEXT',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  minimumCandidateCount: 1,
  minimumReliableSimilarity: 0.58,
  strongSimilarity: 0.78,
  maximumResults: 5,
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

function normalizeFeatureVector(features, fieldName) {
  if (features === null || typeof features !== 'object' || Array.isArray(features)) {
    throw new TypeError(`${fieldName} must be an object`);
  }

  const normalized = Object.create(null);
  const keys = Object.keys(features).sort();

  for (let index = 0; index < keys.length; index += 1) {
    const key = normalizeText(keys[index], `${fieldName}.key`);
    assertUnit(features[key], `${fieldName}.${key}`);
    normalized[key] = features[key];
  }

  return Object.freeze(normalized);
}

function normalizeSignals(signals, fieldName) {
  if (signals === undefined) {
    return Object.freeze([]);
  }

  if (!Array.isArray(signals)) {
    throw new TypeError(`${fieldName} must be an array`);
  }

  const seen = new Set();
  const normalized = [];

  for (let index = 0; index < signals.length; index += 1) {
    const signal = normalizeText(signals[index], `${fieldName}[${index}]`);

    if (!seen.has(signal)) {
      seen.add(signal);
      normalized.push(signal);
    }
  }

  return Object.freeze(normalized.sort());
}

function normalizeContext(context, fieldName) {
  if (context === null || typeof context !== 'object' || Array.isArray(context)) {
    throw new TypeError(`${fieldName} must be an object`);
  }

  const id = normalizeText(context.id, `${fieldName}.id`);
  const tableId = normalizeText(context.tableId, `${fieldName}.tableId`);
  const strategyId = normalizeText(context.strategyId, `${fieldName}.strategyId`);

  assertUnit(context.graphConfidence, `${fieldName}.graphConfidence`);
  assertUnit(context.consensusScore, `${fieldName}.consensusScore`);
  assertUnit(context.riskScore, `${fieldName}.riskScore`);
  assertUnit(context.operatorScore, `${fieldName}.operatorScore`);

  return Object.freeze({
    id,
    tableId,
    strategyId,
    graphConfidence: context.graphConfidence,
    consensusScore: context.consensusScore,
    riskScore: context.riskScore,
    operatorScore: context.operatorScore,
    features: normalizeFeatureVector(context.features, `${fieldName}.features`),
    signals: normalizeSignals(context.signals, `${fieldName}.signals`),
  });
}

function calculateFeatureSimilarity(currentFeatures, candidateFeatures) {
  const keys = new Set([
    ...Object.keys(currentFeatures),
    ...Object.keys(candidateFeatures),
  ]);

  if (keys.size === 0) {
    return 0;
  }

  let totalDistance = 0;

  for (const key of keys) {
    const currentValue = Object.prototype.hasOwnProperty.call(currentFeatures, key)
      ? currentFeatures[key]
      : 0;

    const candidateValue = Object.prototype.hasOwnProperty.call(candidateFeatures, key)
      ? candidateFeatures[key]
      : 0;

    totalDistance += Math.abs(currentValue - candidateValue);
  }

  const averageDistance = totalDistance / keys.size;

  return 1 - averageDistance;
}

function calculateSignalSimilarity(currentSignals, candidateSignals) {
  if (currentSignals.length === 0 && candidateSignals.length === 0) {
    return 1;
  }

  const currentSet = new Set(currentSignals);
  const candidateSet = new Set(candidateSignals);
  const union = new Set([...currentSignals, ...candidateSignals]);

  if (union.size === 0) {
    return 0;
  }

  let intersectionCount = 0;

  for (const signal of currentSet) {
    if (candidateSet.has(signal)) {
      intersectionCount += 1;
    }
  }

  return intersectionCount / union.size;
}

function calculateExactMatchScore(current, candidate) {
  let score = 0;

  if (current.tableId === candidate.tableId) {
    score += 0.5;
  }

  if (current.strategyId === candidate.strategyId) {
    score += 0.5;
  }

  return score;
}

/**
 * Context Similarity Engine V2.
 *
 * Compares a current institutional context against historical contexts using
 * bounded, deterministic, explainable similarity. This engine does not suggest
 * bets and does not execute anything. It only produces supervised evidence for
 * PAPER-only institutional recommendation layers.
 *
 * Complexity:
 * - Time: O(c * f), where c is candidate count and f is feature/signal width.
 * - Space: O(c), bounded by ranking results.
 */
class ContextSimilarityEngineV2 {
  constructor(thresholds) {
    const resolvedThresholds = Object.assign({}, DEFAULT_THRESHOLDS, thresholds || {});

    assertPositiveInteger(resolvedThresholds.minimumCandidateCount, 'thresholds.minimumCandidateCount');
    assertUnit(resolvedThresholds.minimumReliableSimilarity, 'thresholds.minimumReliableSimilarity');
    assertUnit(resolvedThresholds.strongSimilarity, 'thresholds.strongSimilarity');
    assertPositiveInteger(resolvedThresholds.maximumResults, 'thresholds.maximumResults');

    if (resolvedThresholds.minimumReliableSimilarity > resolvedThresholds.strongSimilarity) {
      throw new RangeError('thresholds.minimumReliableSimilarity must be less than or equal to thresholds.strongSimilarity');
    }

    this.thresholds = Object.freeze(resolvedThresholds);
  }

  evaluate(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('input must be an object');
    }

    const sessionId = normalizeText(input.sessionId, 'input.sessionId');
    const currentContext = normalizeContext(input.currentContext, 'input.currentContext');

    if (!Array.isArray(input.historicalContexts)) {
      throw new TypeError('input.historicalContexts must be an array');
    }

    const candidatesById = new Map();

    for (let index = 0; index < input.historicalContexts.length; index += 1) {
      const candidate = normalizeContext(input.historicalContexts[index], `input.historicalContexts[${index}]`);

      if (candidate.id !== currentContext.id && !candidatesById.has(candidate.id)) {
        candidatesById.set(candidate.id, candidate);
      }
    }

    const rankedMatches = this.rankCandidates(currentContext, Array.from(candidatesById.values()));
    const topMatches = rankedMatches.slice(0, this.thresholds.maximumResults);
    const bestMatch = topMatches.length > 0 ? topMatches[0] : null;

    const blockers = this.resolveBlockers({
      candidateCount: candidatesById.size,
      bestSimilarity: bestMatch === null ? 0 : bestMatch.similarity,
    });

    const decision = this.resolveDecision(bestMatch, blockers);

    const payload = Object.freeze({
      sprint: 237,
      engine: 'ContextSimilarityEngineV2',
      sessionId,
      decision,
      currentContextId: currentContext.id,
      candidateCount: candidatesById.size,
      returnedMatches: topMatches.length,
      bestSimilarity: bestMatch === null ? 0 : bestMatch.similarity,
      blockers: Object.freeze(blockers),
      matches: Object.freeze(topMatches),
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

  rankCandidates(currentContext, candidates) {
    const ranked = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const featureSimilarity = calculateFeatureSimilarity(currentContext.features, candidate.features);
      const signalSimilarity = calculateSignalSimilarity(currentContext.signals, candidate.signals);
      const exactMatchScore = calculateExactMatchScore(currentContext, candidate);

      const metricSimilarity = 1 - (
        Math.abs(currentContext.graphConfidence - candidate.graphConfidence)
        + Math.abs(currentContext.consensusScore - candidate.consensusScore)
        + Math.abs(currentContext.riskScore - candidate.riskScore)
        + Math.abs(currentContext.operatorScore - candidate.operatorScore)
      ) / 4;

      const similarity = Number((
        (featureSimilarity * 0.34)
        + (signalSimilarity * 0.18)
        + (metricSimilarity * 0.28)
        + (exactMatchScore * 0.20)
      ).toFixed(6));

      ranked.push(Object.freeze({
        contextId: candidate.id,
        tableId: candidate.tableId,
        strategyId: candidate.strategyId,
        similarity,
        featureSimilarity: Number(featureSimilarity.toFixed(6)),
        signalSimilarity: Number(signalSimilarity.toFixed(6)),
        metricSimilarity: Number(metricSimilarity.toFixed(6)),
        exactMatchScore: Number(exactMatchScore.toFixed(6)),
      }));
    }

    ranked.sort((left, right) => {
      if (right.similarity !== left.similarity) {
        return right.similarity - left.similarity;
      }

      return left.contextId.localeCompare(right.contextId);
    });

    return ranked;
  }

  resolveBlockers(context) {
    const blockers = [];

    if (context.candidateCount < this.thresholds.minimumCandidateCount) {
      blockers.push('INSUFFICIENT_HISTORICAL_CONTEXTS');
    }

    if (context.bestSimilarity < this.thresholds.minimumReliableSimilarity) {
      blockers.push('NO_RELIABLE_SIMILAR_CONTEXT');
    }

    return blockers;
  }

  resolveDecision(bestMatch, blockers) {
    if (blockers.length > 0 || bestMatch === null) {
      return SIMILARITY_DECISIONS.NO_RELIABLE_CONTEXT;
    }

    if (bestMatch.similarity >= this.thresholds.strongSimilarity) {
      return SIMILARITY_DECISIONS.SIMILAR_CONTEXT_FOUND;
    }

    return SIMILARITY_DECISIONS.OBSERVE_CONTEXT;
  }
}

module.exports = {
  SIMILARITY_DECISIONS,
  DEFAULT_THRESHOLDS,
  ContextSimilarityEngineV2,
};
