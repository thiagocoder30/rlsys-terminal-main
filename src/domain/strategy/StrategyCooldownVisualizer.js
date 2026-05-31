'use strict';

class StrategyCooldownVisualizer {
  visualize(input) {
    if (!input || typeof input !== 'object') return this.block(['input_not_object']);

    const cooldown = input.cooldownDecision;
    const recovery = input.recoveryDecision;

    if (!cooldown || typeof cooldown !== 'object') return this.block(['missing_cooldown_decision']);
    if (!recovery || typeof recovery !== 'object') return this.block(['missing_recovery_decision']);

    const reasons = [];
    this.validateCooldown(cooldown, reasons);
    this.validateRecovery(recovery, reasons);

    if (reasons.length > 0) return this.block(reasons, cooldown.strategyId);

    const strategyId = cooldown.strategyId || recovery.strategyId || 'UNKNOWN';
    const title = this.resolveTitle(strategyId);
    const remainingRounds = this.readNonNegativeInteger(cooldown.remainingRounds, recovery.remainingRounds);
    const cooldownRounds = this.readNonNegativeInteger(cooldown.cooldownRounds, 0);
    const severity = this.resolveSeverity(cooldown, recovery);
    const displayStatus = this.resolveDisplayStatus(cooldown, recovery);
    const displayAction = this.resolveDisplayAction(cooldown, recovery);
    const progressPercent = this.resolveProgressPercent(cooldownRounds, remainingRounds);
    const message = this.resolveMessage(displayStatus, remainingRounds);
    const mergedReasons = this.unique(
      []
        .concat(Array.isArray(cooldown.reasons) ? cooldown.reasons : [])
        .concat(Array.isArray(recovery.reasons) ? recovery.reasons : [])
    );

    return Object.freeze({
      status: 'STRATEGY_COOLDOWN_VISUAL_READY',
      strategyId,
      title,
      displayStatus,
      displayAction,
      severity,
      cooldownRounds,
      remainingRounds,
      progressPercent,
      currentLossStreak: Number.isInteger(cooldown.currentLossStreak) ? cooldown.currentLossStreak : 0,
      currentWinStreak: Number.isInteger(cooldown.currentWinStreak) ? cooldown.currentWinStreak : 0,
      netUnits: Number.isFinite(cooldown.netUnits) ? this.round4(cooldown.netUnits) : 0,
      message,
      reasons: Object.freeze(mergedReasons),
      rendered: this.renderCard(title, displayStatus, displayAction, severity, remainingRounds, progressPercent, message),
      strategyGate: this.resolveStrategyGate(cooldown, recovery),
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  validateCooldown(cooldown, reasons) {
    if (cooldown.liveGate !== 'BLOCKED') reasons.push('cooldown_live_gate_must_remain_blocked');
    if (cooldown.productionMoneyAllowed !== false) reasons.push('cooldown_production_money_must_remain_disabled');
    if (cooldown.liveMoneyAuthorized !== false) reasons.push('cooldown_live_money_must_remain_disabled');
    if (typeof cooldown.status !== 'string' || cooldown.status.length === 0) reasons.push('missing_cooldown_status');
  }

  validateRecovery(recovery, reasons) {
    if (recovery.liveGate !== 'BLOCKED') reasons.push('recovery_live_gate_must_remain_blocked');
    if (recovery.productionMoneyAllowed !== false) reasons.push('recovery_production_money_must_remain_disabled');
    if (recovery.liveMoneyAuthorized !== false) reasons.push('recovery_live_money_must_remain_disabled');
    if (typeof recovery.status !== 'string' || recovery.status.length === 0) reasons.push('missing_recovery_status');
  }

  resolveSeverity(cooldown, recovery) {
    if (cooldown.status === 'STRATEGY_BLOCKED' || recovery.status === 'STRATEGY_RECOVERY_BLOCKED') return 'CRITICAL';
    if (recovery.status === 'STRATEGY_RECOVERY_APPROVED') return 'INFO';
    if (cooldown.status === 'STRATEGY_COOLDOWN' || recovery.status === 'STRATEGY_RECOVERY_WAIT_COOLDOWN') return 'WARNING';
    if (cooldown.status === 'STRATEGY_REVIEW_REQUIRED' || recovery.status === 'STRATEGY_RECOVERY_WAIT_CONTEXT') return 'WARNING';
    return 'INFO';
  }

  resolveDisplayStatus(cooldown, recovery) {
    if (cooldown.status === 'STRATEGY_BLOCKED' || recovery.status === 'STRATEGY_RECOVERY_BLOCKED') return 'BLOQUEADO';
    if (recovery.status === 'STRATEGY_RECOVERY_APPROVED') return 'RECUPERADO';
    if (cooldown.status === 'STRATEGY_COOLDOWN' || recovery.status === 'STRATEGY_RECOVERY_WAIT_COOLDOWN') return 'COOLDOWN';
    if (cooldown.status === 'STRATEGY_REVIEW_REQUIRED' || recovery.status === 'STRATEGY_RECOVERY_WAIT_CONTEXT') return 'REVISAO';
    return 'DISPONIVEL';
  }

  resolveDisplayAction(cooldown, recovery) {
    if (cooldown.status === 'STRATEGY_BLOCKED' || recovery.status === 'STRATEGY_RECOVERY_BLOCKED') return 'NAO_UTILIZAR';
    if (recovery.status === 'STRATEGY_RECOVERY_APPROVED') return 'LIBERADO_PARA_REAVALIACAO';
    if (cooldown.status === 'STRATEGY_COOLDOWN' || recovery.status === 'STRATEGY_RECOVERY_WAIT_COOLDOWN') return 'AGUARDAR_COOLDOWN';
    if (cooldown.status === 'STRATEGY_REVIEW_REQUIRED' || recovery.status === 'STRATEGY_RECOVERY_WAIT_CONTEXT') return 'AGUARDAR_RECUPERACAO';
    return 'LIBERADO_PARA_REAVALIACAO';
  }

  resolveProgressPercent(cooldownRounds, remainingRounds) {
    if (cooldownRounds <= 0) return remainingRounds > 0 ? 0 : 100;
    const ratio = (cooldownRounds - remainingRounds) / cooldownRounds;
    if (ratio <= 0) return 0;
    if (ratio >= 1) return 100;
    return Math.round(ratio * 100);
  }

  resolveMessage(displayStatus, remainingRounds) {
    if (displayStatus === 'BLOQUEADO') return 'Estratégia bloqueada. Não utilizar.';
    if (displayStatus === 'COOLDOWN') return `Aguardar cooldown da estratégia. Rodadas restantes: ${remainingRounds}.`;
    if (displayStatus === 'REVISAO') return 'Aguardar recuperação contextual antes de nova avaliação.';
    if (displayStatus === 'RECUPERADO') return 'Estratégia recuperada para reavaliação institucional.';
    return 'Estratégia disponível para avaliação.';
  }

  resolveStrategyGate(cooldown, recovery) {
    if (cooldown.strategyGate === 'BLOCKED' || recovery.strategyGate === 'BLOCKED') return 'BLOCKED';
    if (recovery.strategyGate === 'RECOVERED') return 'RECOVERED';
    if (cooldown.strategyGate === 'COOLDOWN' || recovery.strategyGate === 'COOLDOWN') return 'COOLDOWN';
    if (cooldown.strategyGate === 'REVIEW_REQUIRED' || recovery.strategyGate === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
    return 'AVAILABLE';
  }

  renderCard(title, displayStatus, displayAction, severity, remainingRounds, progressPercent, message) {
    return [
      '================================',
      `Estratégia: ${title}`,
      `Cooldown Status: ${displayStatus}`,
      `Ação: ${displayAction}`,
      `Severidade: ${severity}`,
      `Rodadas restantes: ${remainingRounds}`,
      `Progresso: ${progressPercent}%`,
      `Mensagem: ${message}`,
      'Live Money: BLOQUEADO',
      '================================'
    ].join('\n');
  }

  readNonNegativeInteger(primary, fallback) {
    const value = Number.isInteger(primary) ? primary : fallback;
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }

  resolveTitle(strategyId) {
    if (strategyId === 'UNKNOWN') return 'UNKNOWN';
    return strategyId.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  unique(values) {
    const seen = new Set();
    const result = [];
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (!seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
    }
    return result;
  }

  round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  block(reasons, strategyId) {
    const safeStrategyId = strategyId || 'UNKNOWN';
    return Object.freeze({
      status: 'STRATEGY_COOLDOWN_VISUAL_BLOCKED',
      strategyId: safeStrategyId,
      title: this.resolveTitle(safeStrategyId),
      displayStatus: 'BLOQUEADO',
      displayAction: 'NAO_UTILIZAR',
      severity: 'CRITICAL',
      cooldownRounds: 0,
      remainingRounds: 0,
      progressPercent: 0,
      currentLossStreak: 0,
      currentWinStreak: 0,
      netUnits: 0,
      message: 'Visualização de cooldown bloqueada por proteção institucional.',
      reasons: Object.freeze(reasons.slice()),
      rendered: this.renderCard(this.resolveTitle(safeStrategyId), 'BLOQUEADO', 'NAO_UTILIZAR', 'CRITICAL', 0, 0, 'Visualização de cooldown bloqueada por proteção institucional.'),
      strategyGate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }
}

module.exports = { StrategyCooldownVisualizer };
