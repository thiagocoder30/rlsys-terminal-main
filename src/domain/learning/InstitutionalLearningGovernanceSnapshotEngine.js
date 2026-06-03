'use strict';

const crypto = require('crypto');

const DECISIONS = Object.freeze({
  PAPER_LEARNING_READY: 'PAPER_LEARNING_READY',
  OBSERVE_LEARNING: 'OBSERVE_LEARNING',
  BLOCK_LEARNING: 'BLOCK_LEARNING',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  readyScore: 0.78,
  observeScore: 0.52,
  minimumEvidenceCount: 3,
  minimumChecksumLength: 64,
});

function assertFiniteUnit(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${fieldName} must be a finite number`);
  }

  if (value < 0 || value > 1) {
    throw new RangeError(`${fieldName} must be between 0 and 1`);
  }
}

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

function createChecksum(payload) {
  return crypto
    .createHash('sha256')
    .update(stableSerialize(payload))
    .digest('hex');
}

function clampUnit(value) {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function normalizeEvidenceItem(item, index) {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    throw new TypeError(`evidence[${index}] must be an object`);
  }

  const id = normalizeText(item.id, `evidence[${index}].id`);
  const source = normalizeText(item.source, `evidence[${index}].source`);
  const category = normalizeText(item.category, `evidence[${index}].category`);
  assertFiniteUnit(item.confidence, `evidence[${index}].confidence`);

  return Object.freeze({
    id,
    source,
    category,
    confidence: item.confidence,
  });
}

class InstitutionalLearningGovernanceSnapshotEngine {
  constructor(thresholds) {
    const resolvedThresholds = Object.assign({}, DEFAULT_THRESHOLDS, thresholds || {});

    assertFiniteUnit(resolvedThresholds.readyScore, 'thresholds.readyScore');
    assertFiniteUnit(resolvedThresholds.observeScore, 'thresholds.observeScore');

    if (!Number.isInteger(resolvedThresholds.minimumEvidenceCount) || resolvedThresholds.minimumEvidenceCount < 1) {
      throw new RangeError('thresholds.minimumEvidenceCount must be a positive integer');
    }

    if (!Number.isInteger(resolvedThresholds.minimumChecksumLength) || resolvedThresholds.minimumChecksumLength < 32) {
      throw new RangeError('thresholds.minimumChecksumLength must be an integer greater than or equal to 32');
    }

    if (resolvedThresholds.observeScore > resolvedThresholds.readyScore) {
      throw new RangeError('thresholds.observeScore must be less than or equal to thresholds.readyScore');
    }

    this.thresholds = Object.freeze(resolvedThresholds);
  }

  createSnapshot(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('input must be an object');
    }

    const sessionId = normalizeText(input.sessionId, 'input.sessionId');
    const tableId = normalizeText(input.tableId, 'input.tableId');
    const strategyId = normalizeText(input.strategyId, 'input.strategyId');

    assertFiniteUnit(input.memoryConfidence, 'input.memoryConfidence');
    assertFiniteUnit(input.knowledgeGraphCoverage, 'input.knowledgeGraphCoverage');
    assertFiniteUnit(input.contextSimilarityConfidence, 'input.contextSimilarityConfidence');
    assertFiniteUnit(input.outcomeCorrelationConfidence, 'input.outcomeCorrelationConfidence');
    assertFiniteUnit(input.learningWeightStability, 'input.learningWeightStability');
    assertFiniteUnit(input.recommendationReadiness, 'input.recommendationReadiness');

    if (!Array.isArray(input.evidence)) {
      throw new TypeError('input.evidence must be an array');
    }

    const uniqueEvidence = [];
    const seenEvidenceIds = new Set();

    for (let index = 0; index < input.evidence.length; index += 1) {
      const normalized = normalizeEvidenceItem(input.evidence[index], index);

      if (!seenEvidenceIds.has(normalized.id)) {
        seenEvidenceIds.add(normalized.id);
        uniqueEvidence.push(normalized);
      }
    }

    const evidenceConfidence = this.calculateEvidenceConfidence(uniqueEvidence);

    const governanceScore = clampUnit(
      (input.memoryConfidence * 0.18)
      + (input.knowledgeGraphCoverage * 0.16)
      + (input.contextSimilarityConfidence * 0.16)
      + (input.outcomeCorrelationConfidence * 0.18)
      + (input.learningWeightStability * 0.16)
      + (input.recommendationReadiness * 0.10)
      + (evidenceConfidence * 0.06)
    );

    const blockers = this.calculateBlockers({
      governanceScore,
      evidenceCount: uniqueEvidence.length,
      evidenceConfidence,
    });

    const decision = this.resolveDecision(governanceScore, blockers);

    const institutionalFlags = Object.freeze({
      paperOnly: true,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      automaticExecutionAllowed: false,
      humanSupervisionRequired: true,
    });

    const payload = Object.freeze({
      sprint: 234,
      engine: 'InstitutionalLearningGovernanceSnapshotEngine',
      sessionId,
      tableId,
      strategyId,
      decision,
      governanceScore: Number(governanceScore.toFixed(6)),
      evidenceConfidence: Number(evidenceConfidence.toFixed(6)),
      evidenceCount: uniqueEvidence.length,
      blockers: Object.freeze(blockers),
      institutionalFlags,
      evidence: Object.freeze(uniqueEvidence.slice()),
    });

    const checksum = createChecksum(payload);

    if (checksum.length < this.thresholds.minimumChecksumLength) {
      throw new Error('generated checksum is shorter than the institutional minimum');
    }

    return Object.freeze(Object.assign({}, payload, { checksum }));
  }

  calculateEvidenceConfidence(evidence) {
    if (evidence.length === 0) {
      return 0;
    }

    let total = 0;

    for (let index = 0; index < evidence.length; index += 1) {
      total += evidence[index].confidence;
    }

    return total / evidence.length;
  }

  calculateBlockers(context) {
    const blockers = [];

    if (context.evidenceCount < this.thresholds.minimumEvidenceCount) {
      blockers.push('INSUFFICIENT_LEARNING_EVIDENCE');
    }

    if (context.evidenceConfidence < this.thresholds.observeScore) {
      blockers.push('LOW_EVIDENCE_CONFIDENCE');
    }

    if (context.governanceScore < this.thresholds.observeScore) {
      blockers.push('LOW_LEARNING_GOVERNANCE_SCORE');
    }

    return blockers;
  }

  resolveDecision(governanceScore, blockers) {
    if (blockers.length > 0 && governanceScore < this.thresholds.readyScore) {
      return DECISIONS.BLOCK_LEARNING;
    }

    if (governanceScore >= this.thresholds.readyScore && blockers.length === 0) {
      return DECISIONS.PAPER_LEARNING_READY;
    }

    return DECISIONS.OBSERVE_LEARNING;
  }
}

module.exports = {
  DECISIONS,
  DEFAULT_THRESHOLDS,
  InstitutionalLearningGovernanceSnapshotEngine,
};
