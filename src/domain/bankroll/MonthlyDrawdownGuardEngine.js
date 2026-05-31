'use strict';

/**
 * MonthlyDrawdownGuardEngine
 *
 * Proteção institucional de drawdown mensal.
 *
 * Doutrina:
 * - Nunca autoriza dinheiro real.
 * - Nunca permite que o operador aumente limite institucional.
 * - Permite que o operador reduza o limite mensal.
 * - Bloqueia operação PAPER quando o drawdown mensal atinge o limite efetivo.
 *
 * Complexidade:
 * - Tempo: O(1)
 * - Espaço: O(1)
 */

const MONTHLY_DRAWDOWN_GUARD_VERSION = '1.0.0';

const MonthlyDrawdownGuardDecision = Object.freeze({
  PAPER_COMPATIVEL: 'PAPER_COMPATIVEL',
  AGUARDAR: 'AGUARDAR',
  NAO_UTILIZAR: 'NAO_UTILIZAR',
});

const MonthlyDrawdownGuardReason = Object.freeze({
  BELOW_WARNING: 'MONTHLY_DRAWDOWN_BELOW_WARNING_THRESHOLD',
  WARNING_REACHED: 'MONTHLY_DRAWDOWN_WARNING_THRESHOLD_REACHED',
  LIMIT_REACHED: 'MONTHLY_DRAWDOWN_LIMIT_REACHED',
  INVALID_INPUT: 'INVALID_MONTHLY_DRAWDOWN_GUARD_INPUT',
  INVALID_CONFIG: 'INVALID_MONTHLY_DRAWDOWN_GUARD_CONFIG',
  LIVE_MONEY_FORBIDDEN: 'LIVE_MONEY_FORBIDDEN',
  USER_LIMIT_ABOVE_INSTITUTIONAL_CAP: 'USER_MONTHLY_LIMIT_ABOVE_INSTITUTIONAL_CAP',
});

const DEFAULT_CONFIG = Object.freeze({
  institutionalMonthlyDrawdownLimitPercent: 25,
  warningRatio: 0.8,
  minMonthlyDrawdownLimitPercent: 0.1,
  maxMonthlyDrawdownLimitPercent: 35,
  productionMoneyAllowed: false,
});

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value) {
  return Math.round(value * 10000) / 10000;
}

function ok(value) {
  return { ok: true, value };
}

function err(reason, message, details) {
  return {
    ok: false,
    error: {
      reason,
      message,
      details: details || {},
    },
  };
}

class MonthlyDrawdownGuardEngine {
  constructor(config) {
    this.config = Object.assign({}, DEFAULT_CONFIG, config || {});
  }

  validateConfig() {
    const config = this.config;

    if (config.productionMoneyAllowed !== false) {
      return err(
        MonthlyDrawdownGuardReason.LIVE_MONEY_FORBIDDEN,
        'MonthlyDrawdownGuardEngine cannot be configured for production money.',
        { productionMoneyAllowed: config.productionMoneyAllowed }
      );
    }

    if (!isFiniteNumber(config.institutionalMonthlyDrawdownLimitPercent)) {
      return err(
        MonthlyDrawdownGuardReason.INVALID_CONFIG,
        'institutionalMonthlyDrawdownLimitPercent must be finite.',
        { institutionalMonthlyDrawdownLimitPercent: config.institutionalMonthlyDrawdownLimitPercent }
      );
    }

    if (
      config.institutionalMonthlyDrawdownLimitPercent < config.minMonthlyDrawdownLimitPercent ||
      config.institutionalMonthlyDrawdownLimitPercent > config.maxMonthlyDrawdownLimitPercent
    ) {
      return err(
        MonthlyDrawdownGuardReason.INVALID_CONFIG,
        'institutionalMonthlyDrawdownLimitPercent is outside institutional bounds.',
        {
          institutionalMonthlyDrawdownLimitPercent: config.institutionalMonthlyDrawdownLimitPercent,
          minMonthlyDrawdownLimitPercent: config.minMonthlyDrawdownLimitPercent,
          maxMonthlyDrawdownLimitPercent: config.maxMonthlyDrawdownLimitPercent,
        }
      );
    }

    if (!isFiniteNumber(config.warningRatio) || config.warningRatio <= 0 || config.warningRatio >= 1) {
      return err(
        MonthlyDrawdownGuardReason.INVALID_CONFIG,
        'warningRatio must be greater than 0 and lower than 1.',
        { warningRatio: config.warningRatio }
      );
    }

    return ok({ valid: true });
  }

  evaluate(input) {
    const configResult = this.validateConfig();

    if (!configResult.ok) {
      return configResult;
    }

    if (!input || typeof input !== 'object') {
      return err(
        MonthlyDrawdownGuardReason.INVALID_INPUT,
        'Monthly drawdown guard input is required.',
        { received: input === null ? 'null' : typeof input }
      );
    }

    if (input.productionMoneyAllowed !== false) {
      return err(
        MonthlyDrawdownGuardReason.LIVE_MONEY_FORBIDDEN,
        'Monthly drawdown guard only supports PAPER operation.',
        { productionMoneyAllowed: input.productionMoneyAllowed }
      );
    }

    if (!isFiniteNumber(input.startingMonthlyBankroll) || input.startingMonthlyBankroll <= 0) {
      return err(
        MonthlyDrawdownGuardReason.INVALID_INPUT,
        'startingMonthlyBankroll must be a positive finite number.',
        { startingMonthlyBankroll: input.startingMonthlyBankroll }
      );
    }

    if (!isFiniteNumber(input.currentBankroll) || input.currentBankroll < 0) {
      return err(
        MonthlyDrawdownGuardReason.INVALID_INPUT,
        'currentBankroll must be a finite number greater than or equal to zero.',
        { currentBankroll: input.currentBankroll }
      );
    }

    const institutionalPercent = this.config.institutionalMonthlyDrawdownLimitPercent;
    const requestedPercent = input.userMonthlyDrawdownLimitPercent;

    if (requestedPercent !== undefined) {
      if (!isFiniteNumber(requestedPercent) || requestedPercent <= 0) {
        return err(
          MonthlyDrawdownGuardReason.INVALID_INPUT,
          'userMonthlyDrawdownLimitPercent must be positive when provided.',
          { userMonthlyDrawdownLimitPercent: requestedPercent }
        );
      }

      if (requestedPercent > institutionalPercent) {
        return ok(this.createDecision({
          input,
          decision: MonthlyDrawdownGuardDecision.NAO_UTILIZAR,
          reason: MonthlyDrawdownGuardReason.USER_LIMIT_ABOVE_INSTITUTIONAL_CAP,
          effectiveMonthlyDrawdownLimitPercent: institutionalPercent,
          userMonthlyDrawdownLimitPercent: requestedPercent,
          message: 'User monthly drawdown limit cannot loosen the institutional cap.',
        }));
      }
    }

    const effectiveMonthlyDrawdownLimitPercent = requestedPercent === undefined
      ? institutionalPercent
      : Math.min(requestedPercent, institutionalPercent);

    const drawdownAmount = Math.max(0, input.startingMonthlyBankroll - input.currentBankroll);
    const limitAmount = roundCurrency(input.startingMonthlyBankroll * (effectiveMonthlyDrawdownLimitPercent / 100));
    const warningAmount = roundCurrency(limitAmount * this.config.warningRatio);

    if (drawdownAmount >= limitAmount) {
      return ok(this.createDecision({
        input,
        decision: MonthlyDrawdownGuardDecision.NAO_UTILIZAR,
        reason: MonthlyDrawdownGuardReason.LIMIT_REACHED,
        effectiveMonthlyDrawdownLimitPercent,
        drawdownAmount,
        limitAmount,
        warningAmount,
        message: 'Monthly drawdown limit reached. PAPER operation must remain blocked.',
      }));
    }

    if (drawdownAmount >= warningAmount) {
      return ok(this.createDecision({
        input,
        decision: MonthlyDrawdownGuardDecision.AGUARDAR,
        reason: MonthlyDrawdownGuardReason.WARNING_REACHED,
        effectiveMonthlyDrawdownLimitPercent,
        drawdownAmount,
        limitAmount,
        warningAmount,
        message: 'Monthly drawdown is near the institutional limit. Operator must wait and review.',
      }));
    }

    return ok(this.createDecision({
      input,
      decision: MonthlyDrawdownGuardDecision.PAPER_COMPATIVEL,
      reason: MonthlyDrawdownGuardReason.BELOW_WARNING,
      effectiveMonthlyDrawdownLimitPercent,
      drawdownAmount,
      limitAmount,
      warningAmount,
      message: 'Monthly drawdown is inside the institutional PAPER-compatible boundary.',
    }));
  }

  createDecision(params) {
    const drawdownAmount = isFiniteNumber(params.drawdownAmount)
      ? params.drawdownAmount
      : Math.max(0, params.input.startingMonthlyBankroll - params.input.currentBankroll);

    const limitAmount = isFiniteNumber(params.limitAmount)
      ? params.limitAmount
      : roundCurrency(params.input.startingMonthlyBankroll * (params.effectiveMonthlyDrawdownLimitPercent / 100));

    const warningAmount = isFiniteNumber(params.warningAmount)
      ? params.warningAmount
      : roundCurrency(limitAmount * this.config.warningRatio);

    const utilizationRatio = limitAmount > 0 ? drawdownAmount / limitAmount : 1;

    return Object.freeze({
      engine: 'MonthlyDrawdownGuardEngine',
      version: MONTHLY_DRAWDOWN_GUARD_VERSION,
      decision: params.decision,
      reason: params.reason,
      message: params.message,
      productionMoneyAllowed: false,
      startingMonthlyBankroll: roundCurrency(params.input.startingMonthlyBankroll),
      currentBankroll: roundCurrency(params.input.currentBankroll),
      monthlyDrawdownAmount: roundCurrency(drawdownAmount),
      institutionalMonthlyDrawdownLimitPercent: roundPercent(this.config.institutionalMonthlyDrawdownLimitPercent),
      effectiveMonthlyDrawdownLimitPercent: roundPercent(params.effectiveMonthlyDrawdownLimitPercent),
      userMonthlyDrawdownLimitPercent: params.userMonthlyDrawdownLimitPercent === undefined
        ? (params.input.userMonthlyDrawdownLimitPercent === undefined ? null : roundPercent(params.input.userMonthlyDrawdownLimitPercent))
        : roundPercent(params.userMonthlyDrawdownLimitPercent),
      monthlyDrawdownLimitAmount: roundCurrency(limitAmount),
      monthlyWarningAmount: roundCurrency(warningAmount),
      utilizationRatio: roundPercent(utilizationRatio),
      evidence: Object.freeze([
        `startingMonthlyBankroll=${roundCurrency(params.input.startingMonthlyBankroll)}`,
        `currentBankroll=${roundCurrency(params.input.currentBankroll)}`,
        `monthlyDrawdown=${roundCurrency(drawdownAmount)}`,
        `monthlyLimit=${roundCurrency(limitAmount)}`,
        `warning=${roundCurrency(warningAmount)}`,
        'liveMoney=false',
      ]),
    });
  }
}

module.exports = {
  MonthlyDrawdownGuardEngine,
  MonthlyDrawdownGuardDecision,
  MonthlyDrawdownGuardReason,
  DEFAULT_CONFIG,
};
