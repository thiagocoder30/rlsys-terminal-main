'use strict';

/**
 * Strategy Result Ledger Engine.
 *
 * Records immutable per-strategy PAPER outcomes and computes lightweight
 * institutional metrics for future cooldown, drawdown guard, recovery and
 * strategy status presentation.
 *
 * This engine is pure, deterministic and side-effect free. It never authorizes
 * live money and never suggests entries.
 */
class StrategyResultLedgerEngine {
  constructor(config) {
    this.config = Object.freeze({
      maxEntries: Number.isInteger(config && config.maxEntries) ? Number(config.maxEntries) : 1000,
      maxRecentWindow: Number.isInteger(config && config.maxRecentWindow) ? Number(config.maxRecentWindow) : 20
    });

    this.assertValidConfig(this.config);
  }

  createEmptyLedger(strategyId, sessionId) {
    const reasons = [];

    if (typeof strategyId !== 'string' || strategyId.trim().length === 0) {
      reasons.push('missing_strategy_id');
    }

    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      reasons.push('missing_session_id');
    }

    if (reasons.length > 0) {
      return this.rejectCreate(reasons);
    }

    return Object.freeze({
      ok: true,
      value: Object.freeze({
        strategyId: strategyId.trim(),
        sessionId: sessionId.trim(),
        entries: Object.freeze([]),
        totalEntries: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        skipped: 0,
        currentLossStreak: 0,
        currentWinStreak: 0,
        maxLossStreak: 0,
        maxWinStreak: 0,
        netUnits: 0,
        lastOutcome: 'NONE',
        lastRoundIndex: -1,
        strategyGate: 'NEUTRAL',
        operationalGate: 'PAPER_AUTHORIZED',
        paperGate: 'PAPER_AUTHORIZED',
        liveGate: 'BLOCKED',
        productionMoneyAllowed: false,
        liveMoneyAuthorized: false
      })
    });
  }

  appendResult(input) {
    const reasons = [];

    if (!input || typeof input !== 'object') {
      return this.rejectAppend(['input_not_object']);
    }

    const ledger = input.ledger;

    if (!ledger || typeof ledger !== 'object') {
      return this.rejectAppend(['missing_strategy_ledger']);
    }

    this.validateLedger(ledger, reasons);

    const outcome = typeof input.outcome === 'string' ? input.outcome : '';
    const validOutcomes = ['WIN', 'LOSS', 'PUSH', 'SKIPPED'];

    if (!validOutcomes.includes(outcome)) {
      reasons.push('invalid_strategy_outcome');
    }

    const roundIndex = Number.isInteger(input.roundIndex) ? input.roundIndex : -1;

    if (roundIndex < 0) {
      reasons.push('invalid_round_index');
    }

    if (Number.isInteger(ledger.lastRoundIndex) && roundIndex <= ledger.lastRoundIndex) {
      reasons.push('round_index_must_increase');
    }

    const units = Number.isFinite(input.units) ? Number(input.units) : this.defaultUnitsForOutcome(outcome);

    if (!Number.isFinite(units)) {
      reasons.push('invalid_units');
    }

    if (ledger.entries.length >= this.config.maxEntries) {
      reasons.push('strategy_ledger_max_entries_exceeded');
    }

    if (input.liveMoneyAuthorized === true || input.productionMoneyAllowed === true) {
      reasons.push('live_money_result_rejected');
    }

    if (reasons.length > 0) {
      return this.rejectAppend(reasons);
    }

    const entry = Object.freeze({
      entryId: this.createEntryId(ledger.strategyId, ledger.sessionId, roundIndex, outcome, units),
      strategyId: ledger.strategyId,
      sessionId: ledger.sessionId,
      roundIndex,
      outcome,
      units: this.round4(units),
      contextTag: typeof input.contextTag === 'string' ? input.contextTag : 'PAPER',
      createdAtMs: Number.isInteger(input.createdAtMs) && input.createdAtMs >= 0 ? input.createdAtMs : 0,
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });

    const entries = ledger.entries.slice();
    entries.push(entry);

    const nextLedger = this.recomputeLedger(ledger.strategyId, ledger.sessionId, entries);

    return Object.freeze({
      status: 'STRATEGY_RESULT_RECORDED',
      recorded: true,
      entry,
      ledger: nextLedger,
      reasons: Object.freeze([]),
      strategyGate: nextLedger.strategyGate,
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  summarize(ledger, recentWindow) {
    const reasons = [];

    if (!ledger || typeof ledger !== 'object') {
      return this.rejectSummary(['missing_strategy_ledger']);
    }

    this.validateLedger(ledger, reasons);

    if (reasons.length > 0) {
      return this.rejectSummary(reasons);
    }

    const windowSize = Number.isInteger(recentWindow) && recentWindow > 0
      ? Math.min(recentWindow, this.config.maxRecentWindow)
      : Math.min(this.config.maxRecentWindow, ledger.entries.length);

    const recentEntries = ledger.entries.slice(Math.max(0, ledger.entries.length - windowSize));
    const recent = this.computeRecentMetrics(recentEntries);

    return Object.freeze({
      ok: true,
      value: Object.freeze({
        strategyId: ledger.strategyId,
        sessionId: ledger.sessionId,
        totalEntries: ledger.totalEntries,
        wins: ledger.wins,
        losses: ledger.losses,
        pushes: ledger.pushes,
        skipped: ledger.skipped,
        currentLossStreak: ledger.currentLossStreak,
        currentWinStreak: ledger.currentWinStreak,
        maxLossStreak: ledger.maxLossStreak,
        maxWinStreak: ledger.maxWinStreak,
        netUnits: this.round4(ledger.netUnits),
        winRate: this.round4(this.safeRatio(ledger.wins, ledger.wins + ledger.losses)),
        lossRate: this.round4(this.safeRatio(ledger.losses, ledger.wins + ledger.losses)),
        recentWindowSize: windowSize,
        recentLosses: recent.losses,
        recentWins: recent.wins,
        recentNetUnits: this.round4(recent.netUnits),
        lastOutcome: ledger.lastOutcome,
        lastRoundIndex: ledger.lastRoundIndex,
        strategyGate: ledger.strategyGate,
        operationalGate: 'PAPER_AUTHORIZED',
        paperGate: 'PAPER_AUTHORIZED',
        liveGate: 'BLOCKED',
        productionMoneyAllowed: false,
        liveMoneyAuthorized: false
      })
    });
  }

  recomputeLedger(strategyId, sessionId, entries) {
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let skipped = 0;
    let currentLossStreak = 0;
    let currentWinStreak = 0;
    let maxLossStreak = 0;
    let maxWinStreak = 0;
    let netUnits = 0;
    let lastOutcome = 'NONE';
    let lastRoundIndex = -1;

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];

      lastOutcome = entry.outcome;
      lastRoundIndex = entry.roundIndex;
      netUnits += entry.units;

      if (entry.outcome === 'WIN') {
        wins += 1;
        currentWinStreak += 1;
        currentLossStreak = 0;
      } else if (entry.outcome === 'LOSS') {
        losses += 1;
        currentLossStreak += 1;
        currentWinStreak = 0;
      } else if (entry.outcome === 'PUSH') {
        pushes += 1;
      } else if (entry.outcome === 'SKIPPED') {
        skipped += 1;
      }

      if (currentLossStreak > maxLossStreak) {
        maxLossStreak = currentLossStreak;
      }

      if (currentWinStreak > maxWinStreak) {
        maxWinStreak = currentWinStreak;
      }
    }

    return Object.freeze({
      strategyId,
      sessionId,
      entries: Object.freeze(entries.slice()),
      totalEntries: entries.length,
      wins,
      losses,
      pushes,
      skipped,
      currentLossStreak,
      currentWinStreak,
      maxLossStreak,
      maxWinStreak,
      netUnits: this.round4(netUnits),
      lastOutcome,
      lastRoundIndex,
      strategyGate: currentLossStreak > 0 ? 'REVIEW_REQUIRED' : 'NEUTRAL',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  computeRecentMetrics(entries) {
    let wins = 0;
    let losses = 0;
    let netUnits = 0;

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];

      if (entry.outcome === 'WIN') {
        wins += 1;
      } else if (entry.outcome === 'LOSS') {
        losses += 1;
      }

      netUnits += entry.units;
    }

    return {
      wins,
      losses,
      netUnits
    };
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
      return;
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

    let previousRoundIndex = -1;

    for (let index = 0; index < ledger.entries.length; index += 1) {
      const entry = ledger.entries[index];

      if (!entry || typeof entry !== 'object') {
        reasons.push('ledger_entry_invalid');
        return;
      }

      if (!Number.isInteger(entry.roundIndex) || entry.roundIndex <= previousRoundIndex) {
        reasons.push('ledger_entry_round_index_invalid');
        return;
      }

      previousRoundIndex = entry.roundIndex;

      if (entry.productionMoneyAllowed !== false || entry.liveMoneyAuthorized !== false) {
        reasons.push('ledger_entry_live_money_invariant_violation');
        return;
      }
    }
  }

  defaultUnitsForOutcome(outcome) {
    if (outcome === 'WIN') {
      return 1;
    }

    if (outcome === 'LOSS') {
      return -1;
    }

    return 0;
  }

  createEntryId(strategyId, sessionId, roundIndex, outcome, units) {
    let hash = 2166136261;
    const seed = `${strategyId}:${sessionId}:${roundIndex}:${outcome}:${Math.round(units * 10000)}`;

    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return `strategy-result-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  safeRatio(numerator, denominator) {
    if (denominator <= 0) {
      return 0;
    }

    return numerator / denominator;
  }

  rejectCreate(reasons) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: 'strategy_result_ledger_rejected',
        reasons: Object.freeze(reasons.slice())
      })
    });
  }

  rejectAppend(reasons) {
    return Object.freeze({
      status: 'STRATEGY_RESULT_REJECTED',
      recorded: false,
      reasons: Object.freeze(reasons.slice()),
      strategyGate: 'BLOCKED',
      operationalGate: 'BLOCKED',
      paperGate: 'BLOCKED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    });
  }

  rejectSummary(reasons) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: 'strategy_result_summary_rejected',
        reasons: Object.freeze(reasons.slice())
      })
    });
  }

  round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  assertValidConfig(config) {
    if (config.maxEntries < 1) {
      throw new Error('maxEntries must be greater than zero');
    }

    if (config.maxRecentWindow < 1) {
      throw new Error('maxRecentWindow must be greater than zero');
    }
  }
}

module.exports = {
  StrategyResultLedgerEngine
};
