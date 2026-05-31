'use strict';

/**
 * Daily Loss Guard Engine.
 *
 * Protects the operator from exceeding an institutional daily loss limit.
 *
 * Principle:
 * - The system calculates a defensive cap from bankroll.
 * - The user may tighten the limit.
 * - The user can never loosen beyond the institutional cap.
 * - Live money is always blocked.
 */
class DailyLossGuardEngine {
  constructor(config) {
    const safeConfig = config || {};

    this.config = Object.freeze({
      defaultDailyLossPercent: Number.isFinite(safeConfig.defaultDailyLossPercent)
        ? Number(safeConfig.defaultDailyLossPercent)
        : 0.05,
      maxDailyLossPercent: Number.isFinite(safeConfig.maxDailyLossPercent)
        ? Number(safeConfig.maxDailyLossPercent)
        : 0.05,
      warningUsageRatio: Number.isFinite(safeConfig.warningUsageRatio)
        ? Number(safeConfig.warningUsageRatio)
        : 0.75
    });

    this.assertValidConfig(this.config);
  }

  evaluate(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.block(['input_not_object']);
    }

    const bankroll = this.readMoney(input.bankroll);
    const dailyNetUnits = this.readMoney(input.dailyNetUnits);
    const userDailyLossLimit = Number.isFinite(input.userDailyLossLimit)
      ? Number(input.userDailyLossLimit)
      : null;

    if (bankroll <= 0) {
      reasons.push('invalid_bankroll');
    }

    if (!Number.isFinite(input.dailyNetUnits)) {
      reasons.push('invalid_daily_net_units');
    }

    if (input.liveMoneyAuthorized === true || input.productionMoneyAllowed === true) {
      reasons.push('live_money_invariant_violation');
    }

    if (reasons.length > 0) {
      return this.block(reasons);
    }

    const institutionalLimit = this.round2(bankroll * this.config.maxDailyLossPercent);
    const defaultLimit = this.round2(bankroll * this.config.defaultDailyLossPercent);
    const effectiveLimit = this.resolveEffectiveLimit({
      userDailyLossLimit,
      institutionalLimit,
      defaultLimit
    });

    const lossAmount = dailyNetUnits < 0 ? this.round2(Math.abs(dailyNetUnits)) : 0;
    const usageRatio = effectiveLimit > 0 ? this.clamp01(lossAmount / effectiveLimit) : 1;

    if (lossAmount >= effectiveLimit) {
      return this.blockDailyLoss({
        bankroll,
        dailyNetUnits,
        lossAmount,
        institutionalLimit,
        defaultLimit,
        effectiveLimit,
        usageRatio,
        reasons: ['daily_loss_limit_reached']
      });
    }

    if (usageRatio >= this.config.warningUsageRatio) {
      return this.warn({
        bankroll,
        dailyNetUnits,
        lossAmount,
        institutionalLimit,
        defaultLimit,
        effectiveLimit,
        usageRatio,
        reasons: ['daily_loss_warning_threshold_reached']
      });
    }

    return Object.freeze({
      status: 'DAILY_LOSS_GUARD_OK',
      allowed: true,
      action: 'ALLOW_PAPER_SESSION',
      bankroll: this.round2(bankroll),
      dailyNetUnits: this.round2(dailyNetUnits),
      dailyLossAmount: lossAmount,
      institutionalDailyLossLimit: institutionalLimit,
      defaultDailyLossLimit: defaultLimit,
      effectiveDailyLossLimit: effectiveLimit,
      usageRatio: this.round4(usageRatio),
      usagePercent: this.toPercent(usageRatio),
      reasons: Object.freeze([]),
      bankrollGate: 'OK',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  resolveEffectiveLimit(values) {
    const userLimit = values.userDailyLossLimit;
    const institutionalLimit = values.institutionalLimit;
    const defaultLimit = values.defaultLimit;

    if (Number.isFinite(userLimit) && userLimit > 0) {
      return this.round2(Math.min(userLimit, institutionalLimit));
    }

    return this.round2(Math.min(defaultLimit, institutionalLimit));
  }

  warn(values) {
    return Object.freeze({
      status: 'DAILY_LOSS_GUARD_WARNING',
      allowed: true,
      action: 'ALLOW_WITH_CAUTION',
      bankroll: this.round2(values.bankroll),
      dailyNetUnits: this.round2(values.dailyNetUnits),
      dailyLossAmount: values.lossAmount,
      institutionalDailyLossLimit: values.institutionalLimit,
      defaultDailyLossLimit: values.defaultLimit,
      effectiveDailyLossLimit: values.effectiveLimit,
      usageRatio: this.round4(values.usageRatio),
      usagePercent: this.toPercent(values.usageRatio),
      reasons: Object.freeze(values.reasons.slice()),
      bankrollGate: 'WARNING',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  blockDailyLoss(values) {
    return Object.freeze({
      status: 'DAILY_LOSS_GUARD_BLOCKED',
      allowed: false,
      action: 'BLOCK_SESSION_UNTIL_NEXT_DAY',
      bankroll: this.round2(values.bankroll),
      dailyNetUnits: this.round2(values.dailyNetUnits),
      dailyLossAmount: values.lossAmount,
      institutionalDailyLossLimit: values.institutionalLimit,
      defaultDailyLossLimit: values.defaultLimit,
      effectiveDailyLossLimit: values.effectiveLimit,
      usageRatio: this.round4(values.usageRatio),
      usagePercent: this.toPercent(values.usageRatio),
      reasons: Object.freeze(values.reasons.slice()),
      bankrollGate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  block(reasons) {
    return Object.freeze({
      status: 'DAILY_LOSS_GUARD_BLOCKED',
      allowed: false,
      action: 'BLOCK_SESSION_UNTIL_REVIEW',
      bankroll: 0,
      dailyNetUnits: 0,
      dailyLossAmount: 0,
      institutionalDailyLossLimit: 0,
      defaultDailyLossLimit: 0,
      effectiveDailyLossLimit: 0,
      usageRatio: 1,
      usagePercent: 100,
      reasons: Object.freeze(reasons.slice()),
      bankrollGate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  readMoney(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Number(value);
  }

  clamp01(value) {
    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return value;
  }

  toPercent(value) {
    return Math.round(this.clamp01(value) * 100);
  }

  round2(value) {
    return Math.round(value * 100) / 100;
  }

  round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  assertValidConfig(config) {
    if (config.defaultDailyLossPercent <= 0 || config.defaultDailyLossPercent > 1) {
      throw new Error('defaultDailyLossPercent must be between 0 and 1');
    }

    if (config.maxDailyLossPercent <= 0 || config.maxDailyLossPercent > 1) {
      throw new Error('maxDailyLossPercent must be between 0 and 1');
    }

    if (config.defaultDailyLossPercent > config.maxDailyLossPercent) {
      throw new Error('defaultDailyLossPercent must be <= maxDailyLossPercent');
    }

    if (config.warningUsageRatio <= 0 || config.warningUsageRatio >= 1) {
      throw new Error('warningUsageRatio must be greater than 0 and lower than 1');
    }
  }
}

module.exports = {
  DailyLossGuardEngine
};
