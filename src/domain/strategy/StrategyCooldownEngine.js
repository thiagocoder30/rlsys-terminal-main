'use strict';

/**
 * Strategy Cooldown Engine.
 *
 * Converts strategy result ledger metrics into per-strategy cooldown decisions.
 * It protects bankroll after LOSS events, loss streaks and negative units.
 *
 * This engine does not interrupt the whole PAPER session by itself. It only
 * controls whether a specific strategy may be used. Live money is always blocked.
 */
class StrategyCooldownEngine {
  constructor(config) {
    this.config = Object.freeze({
      baseCooldownRounds: Number.isInteger(config && config.baseCooldownRounds)
        ? Number(config.baseCooldownRounds)
        : 3,
      lossStreakMultiplier: Number.isInteger(config && config.lossStreakMultiplier)
        ? Number(config.lossStreakMultiplier)
        : 2,
      maxCooldownRounds: Number.isInteger(config && config.maxCooldownRounds)
        ? Number(config.maxCooldownRounds)
        : 20,
      hardBlockLossStreak: Number.isInteger(config && config.hardBlockLossStreak)
        ? Number(config.hardBlockLossStreak)
        : 3,
      hardBlockNetUnits: Number.isFinite(config && config.hardBlockNetUnits)
        ? Number(config.hardBlockNetUnits)
        : -5,
      recoveryWinStreakRequired: Number.isInteger(config && config.recoveryWinStreakRequired)
        ? Number(config.recoveryWinStreakRequired)
        : 2
    });

    this.assertValidConfig(this.config);
  }

  evaluate(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const ledger = input.ledger;

    if (!ledger || typeof ledger !== 'object') {
      return this.block(['missing_strategy_ledger']);
    }

    this.validateLedger(ledger, reasons);

    const currentRoundIndex = Number.isInteger(input.currentRoundIndex)
      ? input.currentRoundIndex
      : ledger.lastRoundIndex;

    if (!Number.isInteger(currentRoundIndex) || currentRoundIndex < 0) {
      reasons.push('invalid_current_round_index');
    }

    if (Number.isInteger(ledger.lastRoundIndex) && currentRoundIndex < ledger.lastRoundIndex) {
      reasons.push('current_round_before_last_result');
    }

    if (reasons.length > 0) {
      return this.block(reasons);
    }

    const lossStreak = Number.isInteger(ledger.currentLossStreak) ? ledger.currentLossStreak : 0;
    const winStreak = Number.isInteger(ledger.currentWinStreak) ? ledger.currentWinStreak : 0;
    const netUnits = Number.isFinite(ledger.netUnits) ? Number(ledger.netUnits) : 0;
    const lastOutcome = typeof ledger.lastOutcome === 'string' ? ledger.lastOutcome : 'NONE';

    if (lossStreak >= this.config.hardBlockLossStreak) {
      reasons.push('strategy_loss_streak_hard_block');
      return this.hardBlock(reasons, ledger, currentRoundIndex);
    }

    if (netUnits <= this.config.hardBlockNetUnits) {
      reasons.push('strategy_drawdown_hard_block');
      return this.hardBlock(reasons, ledger, currentRoundIndex);
    }

    if (lastOutcome === 'LOSS' && lossStreak > 0) {
      reasons.push('strategy_loss_cooldown_active');
      const cooldownRounds = this.calculateCooldownRounds(lossStreak);
      const roundsSinceLoss = currentRoundIndex - ledger.lastRoundIndex;
      const remainingRounds = Math.max(0, cooldownRounds - roundsSinceLoss);

      if (remainingRounds > 0) {
        return this.cooldown(reasons, ledger, cooldownRounds, remainingRounds, currentRoundIndex);
      }

      reasons.push('strategy_cooldown_elapsed');
      return this.review(reasons, ledger, currentRoundIndex);
    }

    if (ledger.strategyGate === 'REVIEW_REQUIRED' && winStreak < this.config.recoveryWinStreakRequired) {
      reasons.push('strategy_review_required');
      return this.review(reasons, ledger, currentRoundIndex);
    }

    return Object.freeze({
      status: 'STRATEGY_AVAILABLE',
      strategyAvailable: true,
      action: 'ALLOW_STRATEGY_EVALUATION',
      strategyId: ledger.strategyId,
      sessionId: ledger.sessionId,
      cooldownRounds: 0,
      remainingRounds: 0,
      currentLossStreak: lossStreak,
      currentWinStreak: winStreak,
      netUnits: this.round4(netUnits),
      reasons: Object.freeze([]),
      strategyGate: 'AVAILABLE',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  calculateCooldownRounds(lossStreak) {
    const raw = this.config.baseCooldownRounds + Math.max(0, lossStreak - 1) * this.config.lossStreakMultiplier;
    return Math.min(raw, this.config.maxCooldownRounds);
  }

  cooldown(reasons, ledger, cooldownRounds, remainingRounds, currentRoundIndex) {
    return Object.freeze({
      status: 'STRATEGY_COOLDOWN',
      strategyAvailable: false,
      action: 'WAIT',
      strategyId: ledger.strategyId,
      sessionId: ledger.sessionId,
      cooldownRounds,
      remainingRounds,
      currentRoundIndex,
      currentLossStreak: ledger.currentLossStreak,
      currentWinStreak: ledger.currentWinStreak,
      netUnits: this.round4(ledger.netUnits),
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'COOLDOWN',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  review(reasons, ledger, currentRoundIndex) {
    return Object.freeze({
      status: 'STRATEGY_REVIEW_REQUIRED',
      strategyAvailable: false,
      action: 'WAIT_FOR_RECOVERY',
      strategyId: ledger.strategyId,
      sessionId: ledger.sessionId,
      cooldownRounds: 0,
      remainingRounds: 0,
      currentRoundIndex,
      currentLossStreak: ledger.currentLossStreak,
      currentWinStreak: ledger.currentWinStreak,
      netUnits: this.round4(ledger.netUnits),
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'REVIEW_REQUIRED',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  hardBlock(reasons, ledger, currentRoundIndex) {
    return Object.freeze({
      status: 'STRATEGY_BLOCKED',
      strategyAvailable: false,
      action: 'DO_NOT_USE',
      strategyId: ledger.strategyId || 'UNKNOWN',
      sessionId: ledger.sessionId || 'UNKNOWN',
      cooldownRounds: this.config.maxCooldownRounds,
      remainingRounds: this.config.maxCooldownRounds,
      currentRoundIndex,
      currentLossStreak: Number.isInteger(ledger.currentLossStreak) ? ledger.currentLossStreak : 0,
      currentWinStreak: Number.isInteger(ledger.currentWinStreak) ? ledger.currentWinStreak : 0,
      netUnits: Number.isFinite(ledger.netUnits) ? this.round4(ledger.netUnits) : 0,
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'BLOCKED',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  block(reasons) {
    return Object.freeze({
      status: 'STRATEGY_BLOCKED',
      strategyAvailable: false,
      action: 'DO_NOT_USE',
      strategyId: 'UNKNOWN',
      sessionId: 'UNKNOWN',
      cooldownRounds: this.config.maxCooldownRounds,
      remainingRounds: this.config.maxCooldownRounds,
      currentLossStreak: 0,
      currentWinStreak: 0,
      netUnits: 0,
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  validateLedger(ledger, reasons) {
    if (typeof ledger.strategyId !== 'string' || ledger.strategyId.length === 0) {
      reasons.push('missing_strategy_id');
    }

    if (typeof ledger.sessionId !== 'string' || ledger.sessionId.length === 0) {
      reasons.push('missing_session_id');
    }

    if (!Array.isArray(ledger.entries)) {
      reasons.push('ledger_entries_not_array');
    }

    if (ledger.liveGate !== 'BLOCKED') {
      reasons.push('live_gate_must_remain_blocked');
    }

    if (ledger.productionMoneyAllowed !== false) {
      reasons.push('production_money_must_remain_disabled');
    }

    if (ledger.liveMoneyAuthorized !== false) {
      reasons.push('live_money_must_remain_disabled');
    }
  }

  round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  assertValidConfig(config) {
    if (config.baseCooldownRounds < 1) {
      throw new Error('baseCooldownRounds must be greater than zero');
    }

    if (config.lossStreakMultiplier < 0) {
      throw new Error('lossStreakMultiplier must be greater than or equal to zero');
    }

    if (config.maxCooldownRounds < config.baseCooldownRounds) {
      throw new Error('maxCooldownRounds must be greater than or equal to baseCooldownRounds');
    }

    if (config.hardBlockLossStreak < 1) {
      throw new Error('hardBlockLossStreak must be greater than zero');
    }

    if (config.recoveryWinStreakRequired < 1) {
      throw new Error('recoveryWinStreakRequired must be greater than zero');
    }
  }
}

module.exports = {
  StrategyCooldownEngine
};
