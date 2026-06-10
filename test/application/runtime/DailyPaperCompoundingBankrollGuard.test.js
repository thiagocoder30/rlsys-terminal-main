const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DailyPaperCompoundingBankrollGuard,
} = require('../../../dist/application/runtime/DailyPaperCompoundingBankrollGuard.js');

test('DailyPaperCompoundingBankrollGuard cria política padrão PAPER 8/4 com banca inicial', () => {
  const guard = new DailyPaperCompoundingBankrollGuard();

  const state = guard.createInitialState(100, '2026-06-10T12:00:00.000Z');

  assert.equal(state.currentDay.openingBankroll, 100);
  assert.equal(state.currentDay.currentBankroll, 100);
  assert.equal(state.currentDay.stopWinAmount, 8);
  assert.equal(state.currentDay.stopLossAmount, 4);
  assert.equal(state.currentDay.stopWinBankroll, 108);
  assert.equal(state.currentDay.stopLossBankroll, 96);
  assert.equal(state.paperOnly, true);
  assert.equal(state.liveMoneyAuthorized, false);
  assert.equal(state.productionMoneyAllowed, false);
});

test('DailyPaperCompoundingBankrollGuard permite iniciar sessão quando dia está READY', () => {
  const guard = new DailyPaperCompoundingBankrollGuard();
  const state = guard.createInitialState(100, '2026-06-10T12:00:00.000Z');

  const evaluation = guard.startSession(state, '2026-06-10T12:05:00.000Z');

  assert.equal(evaluation.allowedToStartSession, true);
  assert.equal(evaluation.allowedToContinueSession, true);
  assert.equal(evaluation.state.currentDay.status, 'ACTIVE');
  assert.equal(evaluation.state.currentDay.sessionCount, 1);
});

test('DailyPaperCompoundingBankrollGuard aciona Stop Win e bloqueia reentrada no mesmo dia', () => {
  const guard = new DailyPaperCompoundingBankrollGuard();
  let state = guard.createInitialState(100, '2026-06-10T12:00:00.000Z');

  state = guard.startSession(state, '2026-06-10T12:05:00.000Z').state;

  const evaluation = guard.evaluateBankroll(state, {
    currentBankroll: 108,
    nowIso: '2026-06-10T13:00:00.000Z',
  });

  assert.equal(evaluation.stopTriggered, true);
  assert.equal(evaluation.stopReason, 'STOP_WIN');
  assert.equal(evaluation.allowedToStartSession, false);
  assert.equal(evaluation.allowedToContinueSession, false);
  assert.equal(evaluation.state.currentDay.status, 'STOP_WIN_LOCKED');
  assert.equal(evaluation.state.currentDay.lockedUntilLocalDate, '2026-06-11');
  assert.equal(evaluation.blockers.includes('DAILY_PAPER_STOP_WIN_REACHED'), true);

  const reentry = guard.startSession(evaluation.state, '2026-06-10T14:00:00.000Z');

  assert.equal(reentry.allowedToStartSession, false);
  assert.equal(reentry.blockers.includes('DAILY_PAPER_REENTRY_BLOCKED_UNTIL_NEXT_LOCAL_DAY'), true);
});

test('DailyPaperCompoundingBankrollGuard aciona Stop Loss e bloqueia reentrada no mesmo dia', () => {
  const guard = new DailyPaperCompoundingBankrollGuard();
  let state = guard.createInitialState(100, '2026-06-10T12:00:00.000Z');

  state = guard.startSession(state, '2026-06-10T12:05:00.000Z').state;

  const evaluation = guard.evaluateBankroll(state, {
    currentBankroll: 96,
    nowIso: '2026-06-10T13:00:00.000Z',
  });

  assert.equal(evaluation.stopTriggered, true);
  assert.equal(evaluation.stopReason, 'STOP_LOSS');
  assert.equal(evaluation.state.currentDay.status, 'STOP_LOSS_LOCKED');
  assert.equal(evaluation.state.currentDay.lockedUntilLocalDate, '2026-06-11');
  assert.equal(evaluation.blockers.includes('DAILY_PAPER_STOP_LOSS_REACHED'), true);
  assert.equal(evaluation.warnings.includes('DAILY_PAPER_PROTECTIVE_LOCK_ACTIVE'), true);
});

test('DailyPaperCompoundingBankrollGuard carrega banca final para o próximo dia com juros compostos PAPER', () => {
  const guard = new DailyPaperCompoundingBankrollGuard();
  let state = guard.createInitialState(100, '2026-06-10T12:00:00.000Z', {
    stopWinPercent: 10,
    stopLossPercent: 5,
  });

  state = guard.startSession(state, '2026-06-10T12:05:00.000Z').state;
  state = guard.evaluateBankroll(state, {
    currentBankroll: 110,
    nowIso: '2026-06-10T13:00:00.000Z',
  }).state;

  const rolled = guard.rolloverIfNeeded(state, '2026-06-11T12:00:00.000Z');

  assert.equal(rolled.history.length, 1);
  assert.equal(rolled.history[0].currentBankroll, 110);
  assert.equal(rolled.currentDay.localDate, '2026-06-11');
  assert.equal(rolled.currentDay.openingBankroll, 110);
  assert.equal(rolled.currentDay.currentBankroll, 110);
  assert.equal(rolled.currentDay.stopWinAmount, 11);
  assert.equal(rolled.currentDay.stopLossAmount, 5.5);
  assert.equal(rolled.currentDay.stopWinBankroll, 121);
  assert.equal(rolled.currentDay.stopLossBankroll, 104.5);
  assert.equal(rolled.currentDay.status, 'READY');
});

test('DailyPaperCompoundingBankrollGuard mantém sessão ativa quando não atingiu stop', () => {
  const guard = new DailyPaperCompoundingBankrollGuard();
  let state = guard.createInitialState(100, '2026-06-10T12:00:00.000Z');

  state = guard.startSession(state, '2026-06-10T12:05:00.000Z').state;

  const evaluation = guard.evaluateBankroll(state, {
    currentBankroll: 103,
    nowIso: '2026-06-10T13:00:00.000Z',
  });

  assert.equal(evaluation.stopTriggered, false);
  assert.equal(evaluation.stopReason, 'NONE');
  assert.equal(evaluation.allowedToContinueSession, true);
  assert.equal(evaluation.state.currentDay.status, 'ACTIVE');
  assert.equal(evaluation.state.currentDay.realizedProfitLoss, 3);
});

test('DailyPaperCompoundingBankrollGuard gera HUD summary seguro', () => {
  const guard = new DailyPaperCompoundingBankrollGuard();
  const state = guard.createInitialState(100, '2026-06-10T12:00:00.000Z');

  const summary = guard.getHudSummary(state);

  assert.ok(summary.includes('status=READY'));
  assert.ok(summary.includes('opening=100'));
  assert.ok(summary.includes('stopWin=108'));
  assert.ok(summary.includes('stopLoss=96'));
  assert.ok(summary.includes('paperOnly=true'));
  assert.ok(summary.includes('liveMoneyAuthorized=false'));
});

test('DailyPaperCompoundingBankrollGuard nunca autoriza dinheiro real', () => {
  const guard = new DailyPaperCompoundingBankrollGuard();
  let state = guard.createInitialState(100, '2026-06-10T12:00:00.000Z', {
    stopWinPercent: 100,
    stopLossPercent: 50,
  });

  state = guard.startSession(state, '2026-06-10T12:05:00.000Z').state;

  const evaluation = guard.evaluateBankroll(state, {
    currentBankroll: 200,
    nowIso: '2026-06-10T13:00:00.000Z',
  });

  assert.equal(state.liveMoneyAuthorized, false);
  assert.equal(state.productionMoneyAllowed, false);
  assert.equal(evaluation.state.liveMoneyAuthorized, false);
  assert.equal(evaluation.state.productionMoneyAllowed, false);
  assert.equal(evaluation.state.paperOnly, true);
});
