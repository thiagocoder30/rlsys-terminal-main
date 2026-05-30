'use strict';

/**
 * @typedef {'INFO'|'WARNING'|'CRITICAL'} ExplanationSeverity
 */

/**
 * @typedef {Object} AuthorizationExplanationInput
 * @property {Object} authorizationDecision
 * @property {Object=} warmupQualification
 * @property {Object=} cooldownDecision
 * @property {Object=} waitingTimeDecision
 */

/**
 * @typedef {Object} AuthorizationExplanationConfig
 * @property {number} criticalScoreThreshold
 * @property {number} warningScoreThreshold
 */

/**
 * @typedef {Object} AuthorizationExplanation
 * @property {string} explanationId
 * @property {string} status
 * @property {boolean} paperSessionAuthorized
 * @property {ExplanationSeverity} severity
 * @property {string} summary
 * @property {string[]} reasons
 * @property {string[]} recommendedActions
 * @property {Object} components
 * @property {string} operationalGate
 * @property {string} paperGate
 * @property {string} liveGate
 * @property {boolean} productionMoneyAllowed
 * @property {boolean} liveMoneyAuthorized
 */

/**
 * Builds deterministic explanations for institutional authorization decisions.
 *
 * This engine does not authorize anything. It only turns authorization outcomes
 * into auditable, operator-friendly and machine-readable explanations.
 */
class AuthorizationExplainabilityEngine {
  /**
   * @param {Partial<AuthorizationExplanationConfig>=} config
   */
  constructor(config) {
    this.config = Object.freeze({
      criticalScoreThreshold: Number.isFinite(config && config.criticalScoreThreshold)
        ? Number(config.criticalScoreThreshold)
        : 0.45,
      warningScoreThreshold: Number.isFinite(config && config.warningScoreThreshold)
        ? Number(config.warningScoreThreshold)
        : 0.70
    });

    this.assertValidConfig(this.config);
  }

  /**
   * @param {AuthorizationExplanationInput} input
   * @returns {{ ok: boolean, value?: AuthorizationExplanation, error?: { code: string, reasons: string[] } }}
   */
  explain(input) {
    if (!input || typeof input !== 'object') {
      return this.reject(['input_not_object']);
    }

    const decision = input.authorizationDecision;

    if (!decision || typeof decision !== 'object') {
      return this.reject(['missing_authorization_decision']);
    }

    const reasons = Array.isArray(decision.reasons) ? decision.reasons.slice() : [];
    const authorizationScore = Number.isFinite(decision.authorizationScore)
      ? this.clamp01(decision.authorizationScore)
      : 0;

    const paperSessionAuthorized = decision.paperSessionAuthorized === true &&
      decision.status === 'PAPER_SESSION_AUTHORIZED' &&
      decision.productionMoneyAllowed === false &&
      decision.liveMoneyAuthorized === false &&
      decision.liveGate === 'BLOCKED';

    const severity = this.resolveSeverity(paperSessionAuthorized, authorizationScore, reasons);
    const summary = this.buildSummary(paperSessionAuthorized, severity, authorizationScore, reasons);
    const recommendedActions = this.buildRecommendedActions(paperSessionAuthorized, reasons, input);

    const explanationId = this.createExplanationId(decision, input.cooldownDecision, input.waitingTimeDecision);

    return Object.freeze({
      ok: true,
      value: Object.freeze({
        explanationId,
        status: paperSessionAuthorized ? 'PAPER_SESSION_AUTHORIZED' : 'SESSION_BLOCKED',
        paperSessionAuthorized,
        severity,
        summary,
        reasons: Object.freeze(reasons),
        recommendedActions: Object.freeze(recommendedActions),
        components: Object.freeze({
          authorizationScore: this.round4(authorizationScore),
          tableComponent: this.readComponent(decision.tableComponent),
          operatorComponent: this.readComponent(decision.operatorComponent),
          trustComponent: this.readComponent(decision.trustComponent),
          riskComponent: this.readComponent(decision.riskComponent),
          cooldownStatus: input.cooldownDecision && input.cooldownDecision.status ? input.cooldownDecision.status : 'UNKNOWN',
          waitingSeverity: input.waitingTimeDecision && input.waitingTimeDecision.severity ? input.waitingTimeDecision.severity : 'UNKNOWN'
        }),
        operationalGate: paperSessionAuthorized ? 'PAPER_AUTHORIZED' : 'BLOCKED',
        paperGate: paperSessionAuthorized ? 'PAPER_AUTHORIZED' : 'BLOCKED',
        liveGate: 'BLOCKED',
        productionMoneyAllowed: false,
        liveMoneyAuthorized: false
      })
    });
  }

  /**
   * @param {boolean} authorized
   * @param {number} authorizationScore
   * @param {string[]} reasons
   * @returns {ExplanationSeverity}
   */
  resolveSeverity(authorized, authorizationScore, reasons) {
    if (authorized) {
      return 'INFO';
    }

    if (
      authorizationScore < this.config.criticalScoreThreshold ||
      reasons.includes('veto_active') ||
      reasons.includes('cooldown_active') ||
      reasons.includes('warmup_live_money_invariant_violation') ||
      reasons.includes('warmup_production_money_invariant_violation')
    ) {
      return 'CRITICAL';
    }

    if (authorizationScore < this.config.warningScoreThreshold || reasons.length > 0) {
      return 'WARNING';
    }

    return 'INFO';
  }

  /**
   * @param {boolean} authorized
   * @param {ExplanationSeverity} severity
   * @param {number} authorizationScore
   * @param {string[]} reasons
   * @returns {string}
   */
  buildSummary(authorized, severity, authorizationScore, reasons) {
    if (authorized) {
      return `PAPER session authorized with defensive score ${this.round4(authorizationScore)}. Live money remains blocked.`;
    }

    if (severity === 'CRITICAL') {
      return `Session blocked by critical institutional protection. Reasons: ${reasons.join(', ') || 'unspecified'}.`;
    }

    return `Session blocked by institutional qualification rules. Reasons: ${reasons.join(', ') || 'unspecified'}.`;
  }

  /**
   * @param {boolean} authorized
   * @param {string[]} reasons
   * @param {AuthorizationExplanationInput} input
   * @returns {string[]}
   */
  buildRecommendedActions(authorized, reasons, input) {
    if (authorized) {
      return [
        'Start PAPER session only.',
        'Keep manual input mode enabled.',
        'Maintain live money disabled.',
        'Continue supervision after every new round.'
      ];
    }

    const actions = ['Do not start the session.'];

    if (reasons.includes('cooldown_active')) {
      actions.push('Respect the active cooldown until expiration.');
    }

    if (reasons.includes('table_context_below_minimum')) {
      actions.push('Wait for a new warm-up sample from the table.');
    }

    if (reasons.includes('operator_readiness_below_minimum')) {
      actions.push('Pause and reassess operator readiness.');
    }

    if (reasons.includes('supervision_risk_above_limit')) {
      actions.push('Keep the session blocked until supervision risk decreases.');
    }

    if (reasons.includes('warmup_not_approved')) {
      actions.push('Reload or revalidate warm-up before any new authorization attempt.');
    }

    if (input.waitingTimeDecision && Number.isFinite(input.waitingTimeDecision.durationMinutes)) {
      actions.push(`Minimum waiting time: ${input.waitingTimeDecision.durationMinutes} minutes.`);
    }

    actions.push('Live money remains prohibited.');
    return actions;
  }

  /**
   * @param {Object} decision
   * @param {Object=} cooldownDecision
   * @param {Object=} waitingTimeDecision
   * @returns {string}
   */
  createExplanationId(decision, cooldownDecision, waitingTimeDecision) {
    let hash = 2166136261;
    const seed = JSON.stringify({
      status: decision.status,
      score: decision.authorizationScore,
      reasons: decision.reasons || [],
      cooldown: cooldownDecision && cooldownDecision.status ? cooldownDecision.status : 'none',
      waiting: waitingTimeDecision && waitingTimeDecision.severity ? waitingTimeDecision.severity : 'none'
    });

    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return `auth-exp-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  readComponent(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return this.round4(this.clamp01(value));
  }

  /**
   * @param {string[]} reasons
   * @returns {{ ok: false, error: { code: string, reasons: string[] } }}
   */
  reject(reasons) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: 'authorization_explanation_rejected',
        reasons: Object.freeze(reasons.slice())
      })
    });
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
   * @param {AuthorizationExplanationConfig} config
   * @returns {void}
   */
  assertValidConfig(config) {
    if (config.criticalScoreThreshold < 0 || config.criticalScoreThreshold > 1) {
      throw new Error('criticalScoreThreshold must be between 0 and 1');
    }

    if (config.warningScoreThreshold < config.criticalScoreThreshold || config.warningScoreThreshold > 1) {
      throw new Error('warningScoreThreshold must be greater than or equal to criticalScoreThreshold and <= 1');
    }
  }
}

module.exports = {
  AuthorizationExplainabilityEngine
};
