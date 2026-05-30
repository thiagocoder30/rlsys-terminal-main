'use strict';

/**
 * @typedef {'PAPER_SESSION_AUTHORIZED'|'SESSION_BLOCKED'} InstitutionalAuthorizationStatus
 */

/**
 * @typedef {Object} InstitutionalAuthorizationInput
 * @property {Object} warmupQualification
 * @property {number} tableContextScore
 * @property {number} operatorReadinessScore
 * @property {number} supervisionRiskScore
 * @property {number=} operatorTrustScore
 * @property {boolean=} cooldownActive
 * @property {boolean=} vetoActive
 * @property {string[]=} externalBlockers
 */

/**
 * @typedef {Object} InstitutionalAuthorizationConfig
 * @property {number} minAuthorizationScore
 * @property {number} minTableContextScore
 * @property {number} minOperatorReadinessScore
 * @property {number} maxSupervisionRiskScore
 * @property {number} minOperatorTrustScore
 */

/**
 * @typedef {Object} InstitutionalAuthorizationDecision
 * @property {InstitutionalAuthorizationStatus} status
 * @property {boolean} paperSessionAuthorized
 * @property {number} authorizationScore
 * @property {string[]} reasons
 * @property {number} tableComponent
 * @property {number} operatorComponent
 * @property {number} trustComponent
 * @property {number} riskComponent
 * @property {string} operationalGate
 * @property {string} paperGate
 * @property {string} liveGate
 * @property {boolean} productionMoneyAllowed
 * @property {boolean} liveMoneyAuthorized
 */

/**
 * Institutional paper session authorization engine.
 *
 * This is the first defensive authorization layer after warm-up qualification.
 * It can authorize PAPER sessions only. Live money remains permanently blocked.
 *
 * Formula:
 * Mesa favorável + Operador apto + Risco controlado + Trust suficiente
 * = possível autorização PAPER.
 */
class InstitutionalAuthorizationEngine {
  /**
   * @param {Partial<InstitutionalAuthorizationConfig>=} config
   */
  constructor(config) {
    this.config = Object.freeze({
      minAuthorizationScore: Number.isFinite(config && config.minAuthorizationScore)
        ? Number(config.minAuthorizationScore)
        : 0.76,
      minTableContextScore: Number.isFinite(config && config.minTableContextScore)
        ? Number(config.minTableContextScore)
        : 0.70,
      minOperatorReadinessScore: Number.isFinite(config && config.minOperatorReadinessScore)
        ? Number(config.minOperatorReadinessScore)
        : 0.72,
      maxSupervisionRiskScore: Number.isFinite(config && config.maxSupervisionRiskScore)
        ? Number(config.maxSupervisionRiskScore)
        : 0.34,
      minOperatorTrustScore: Number.isFinite(config && config.minOperatorTrustScore)
        ? Number(config.minOperatorTrustScore)
        : 0.60
    });

    this.assertValidConfig(this.config);
  }

  /**
   * @param {InstitutionalAuthorizationInput} input
   * @returns {InstitutionalAuthorizationDecision}
   */
  authorize(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const warmupQualification = input.warmupQualification;

    if (!warmupQualification || typeof warmupQualification !== 'object') {
      return this.block(['missing_warmup_qualification']);
    }

    if (warmupQualification.approved !== true || warmupQualification.status !== 'APPROVED') {
      reasons.push('warmup_not_approved');
    }

    if (warmupQualification.productionMoneyAllowed !== false) {
      reasons.push('warmup_production_money_invariant_violation');
    }

    if (warmupQualification.liveMoneyAuthorized !== false) {
      reasons.push('warmup_live_money_invariant_violation');
    }

    if (warmupQualification.liveGate !== 'BLOCKED') {
      reasons.push('warmup_live_gate_must_remain_blocked');
    }

    const tableScore = this.readScore(input.tableContextScore);
    const operatorScore = this.readScore(input.operatorReadinessScore);
    const supervisionRiskScore = this.readScore(input.supervisionRiskScore);
    const operatorTrustScore = Number.isFinite(input.operatorTrustScore)
      ? this.clamp01(input.operatorTrustScore)
      : 1;

    if (tableScore < this.config.minTableContextScore) {
      reasons.push('table_context_below_minimum');
    }

    if (operatorScore < this.config.minOperatorReadinessScore) {
      reasons.push('operator_readiness_below_minimum');
    }

    if (operatorTrustScore < this.config.minOperatorTrustScore) {
      reasons.push('operator_trust_below_minimum');
    }

    if (supervisionRiskScore > this.config.maxSupervisionRiskScore) {
      reasons.push('supervision_risk_above_limit');
    }

    if (input.cooldownActive === true) {
      reasons.push('cooldown_active');
    }

    if (input.vetoActive === true) {
      reasons.push('veto_active');
    }

    const externalBlockers = Array.isArray(input.externalBlockers) ? input.externalBlockers : [];
    if (externalBlockers.length > 0) {
      reasons.push('external_blockers_active');
    }

    const tableComponent = tableScore;
    const operatorComponent = operatorScore;
    const trustComponent = operatorTrustScore;
    const riskComponent = this.clamp01(1 - supervisionRiskScore);

    const authorizationScore = this.round4(
      tableComponent * 0.32 +
      operatorComponent * 0.28 +
      trustComponent * 0.18 +
      riskComponent * 0.22
    );

    if (authorizationScore < this.config.minAuthorizationScore) {
      reasons.push('authorization_score_below_minimum');
    }

    if (reasons.length > 0) {
      return this.buildDecision(false, authorizationScore, reasons, {
        tableComponent,
        operatorComponent,
        trustComponent,
        riskComponent
      });
    }

    return this.buildDecision(true, authorizationScore, [], {
      tableComponent,
      operatorComponent,
      trustComponent,
      riskComponent
    });
  }

  /**
   * @param {string[]} reasons
   * @returns {InstitutionalAuthorizationDecision}
   */
  block(reasons) {
    return this.buildDecision(false, 0, reasons, {
      tableComponent: 0,
      operatorComponent: 0,
      trustComponent: 0,
      riskComponent: 0
    });
  }

  /**
   * @param {boolean} authorized
   * @param {number} authorizationScore
   * @param {string[]} reasons
   * @param {{ tableComponent: number, operatorComponent: number, trustComponent: number, riskComponent: number }} components
   * @returns {InstitutionalAuthorizationDecision}
   */
  buildDecision(authorized, authorizationScore, reasons, components) {
    return Object.freeze({
      status: authorized ? 'PAPER_SESSION_AUTHORIZED' : 'SESSION_BLOCKED',
      paperSessionAuthorized: authorized,
      authorizationScore: this.round4(authorizationScore),
      reasons: Object.freeze(reasons.slice()),
      tableComponent: this.round4(components.tableComponent),
      operatorComponent: this.round4(components.operatorComponent),
      trustComponent: this.round4(components.trustComponent),
      riskComponent: this.round4(components.riskComponent),
      operationalGate: authorized ? 'PAPER_AUTHORIZED' : 'BLOCKED',
      paperGate: authorized ? 'PAPER_AUTHORIZED' : 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  readScore(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return this.clamp01(value);
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  clamp01(value) {
    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return value;
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  /**
   * @param {InstitutionalAuthorizationConfig} config
   * @returns {void}
   */
  assertValidConfig(config) {
    const entries = [
      ['minAuthorizationScore', config.minAuthorizationScore],
      ['minTableContextScore', config.minTableContextScore],
      ['minOperatorReadinessScore', config.minOperatorReadinessScore],
      ['maxSupervisionRiskScore', config.maxSupervisionRiskScore],
      ['minOperatorTrustScore', config.minOperatorTrustScore]
    ];

    for (let index = 0; index < entries.length; index += 1) {
      const name = entries[index][0];
      const value = entries[index][1];

      if (value < 0 || value > 1) {
        throw new Error(`${name} must be between 0 and 1`);
      }
    }
  }
}

module.exports = {
  InstitutionalAuthorizationEngine
};
