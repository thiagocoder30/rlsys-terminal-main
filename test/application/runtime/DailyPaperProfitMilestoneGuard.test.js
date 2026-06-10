const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DailyPaperProfitMilestoneGuard,
} = require('../../../dist/application/runtime/DailyPaperProfitMilestoneGuard.js');

test('DailyPaperProfitMilestoneGuard cria milestones padrão 2/4/6/8 para banca 100', () => {
  const guard = new DailyPaperProfitMilestoneGuard();

  const state = guard.createInitialState(100);

  assert.equal(state.openingBankroll, 100);
  assert.equal(state.currentBankroll, 100);
  assert.equal(state.targetBankroll, 108);
  assert.deepEqual(state.milestones.map((milestone) => milestone.percent), [2, 4, 6, 8]);
  assert.deepEqual(state.milestones.map((milestone) => milestone.targetBankroll), [102, 104, 106, 108]);
  assert.equal(state.activeMode, 'BASELINE');
  assert.equal(state.decision, 'CONTINUE');
  assert.equal(state.liveMoneyAuthorized, false);
});

test('DailyPaperProfitMilestoneGuard marca primeiro milestone e exige cooldown', () => {
  const guard = new DailyPaperProfitMilestoneGuard();
  const state = guard.createInitialState(100);

  const evaluation = guard.evaluate(state, {
    currentBankroll: 102,
    roundIndex: 10,
  });

  assert.equal(evaluation.newlyReachedMilestones.length, 1);
  assert.equal(evaluation.newlyReachedMilestones[0].percent, 2);
  assert.equal(evaluation.state.lastReachedMilestonePercent, 2);
  assert.equal(evaluation.state.nextMilestonePercent, 4);
  assert.equal(evaluation.state.activeMode, 'DEFENSIVE');
  assert.equal(evaluation.state.decision, 'COOLDOWN_REQUIRED');
  assert.equal(evaluation.requiresCooldown, true);
  assert.equal(evaluation.allowedToOpenNewPaperSuggestion, false);
  assert.equal(evaluation.blockers.includes('DAILY_PROFIT_MILESTONE_COOLDOWN_ACTIVE'), true);
});

test('DailyPaperProfitMilestoneGuard libera após cooldown se ainda não atingiu novo milestone', () => {
  const guard = new DailyPaperProfitMilestoneGuard();
  let state = guard.createInitialState(100);

  state = guard.evaluate(state, {
    currentBankroll: 102,
    roundIndex: 10,
  }).state;

  const evaluation = guard.evaluate(state, {
    currentBankroll: 102,
    roundIndex: 12,
  });

  assert.equal(evaluation.requiresCooldown, false);
  assert.equal(evaluation.allowedToOpenNewPaperSuggestion, true);
  assert.equal(evaluation.state.activeMode, 'DEFENSIVE');
});

test('DailyPaperProfitMilestoneGuard entra em modo STRICT após 4%', () => {
  const guard = new DailyPaperProfitMilestoneGuard();
  const state = guard.createInitialState(100);

  const evaluation = guard.evaluate(state, {
    currentBankroll: 104,
    roundIndex: 20,
  });

  assert.equal(evaluation.state.activeMode, 'STRICT');
  assert.equal(evaluation.state.decision, 'STRICT_CONSENSUS_REQUIRED');
  assert.equal(evaluation.requiresStrictConsensus, true);
  assert.equal(evaluation.warnings.includes('DAILY_PROFIT_STRICT_CONSENSUS_REQUIRED'), true);
});

test('DailyPaperProfitMilestoneGuard entra em modo ULTRA_DEFENSIVE após 6%', () => {
  const guard = new DailyPaperProfitMilestoneGuard();
  const state = guard.createInitialState(100);

  const evaluation = guard.evaluate(state, {
    currentBankroll: 106,
    roundIndex: 30,
  });

  assert.equal(evaluation.state.activeMode, 'ULTRA_DEFENSIVE');
  assert.equal(evaluation.state.decision, 'ULTRA_DEFENSIVE_REQUIRED');
  assert.equal(evaluation.requiresUltraDefensiveConsensus, true);
  assert.equal(evaluation.warnings.includes('DAILY_PROFIT_ULTRA_DEFENSIVE_REQUIRED'), true);
});

test('DailyPaperProfitMilestoneGuard bloqueia ao atingir Stop Win 8%', () => {
  const guard = new DailyPaperProfitMilestoneGuard();
  const state = guard.createInitialState(100);

  const evaluation = guard.evaluate(state, {
    currentBankroll: 108,
    roundIndex: 40,
  });

  assert.equal(evaluation.stopWinReached, true);
  assert.equal(evaluation.state.activeMode, 'STOP_WIN_LOCKED');
  assert.equal(evaluation.state.decision, 'STOP_WIN_LOCKED');
  assert.equal(evaluation.allowedToOpenNewPaperSuggestion, false);
  assert.equal(evaluation.blockers.includes('DAILY_PROFIT_STOP_WIN_REACHED'), true);
});

test('DailyPaperProfitMilestoneGuard calcula milestones compostos sobre banca 108', () => {
  const guard = new DailyPaperProfitMilestoneGuard();

  const state = guard.createInitialState(108);

  assert.equal(state.targetBankroll, 116.64);
  assert.deepEqual(state.milestones.map((milestone) => milestone.targetBankroll), [110.16, 112.32, 114.48, 116.64]);
});

test('DailyPaperProfitMilestoneGuard aceita política customizada 10% com milestones 2.5/5/7.5/10', () => {
  const guard = new DailyPaperProfitMilestoneGuard();

  const state = guard.createInitialState(100, {
    targetPercent: 10,
    milestonesPercent: [2.5, 5, 7.5, 10],
    strictModeAfterPercent: 5,
    ultraDefensiveAfterPercent: 7.5,
  });

  assert.equal(state.targetBankroll, 110);
  assert.deepEqual(state.milestones.map((milestone) => milestone.targetBankroll), [102.5, 105, 107.5, 110]);

  const evaluation = guard.evaluate(state, {
    currentBankroll: 107.5,
    roundIndex: 30,
  }, {
    targetPercent: 10,
    milestonesPercent: [2.5, 5, 7.5, 10],
    strictModeAfterPercent: 5,
    ultraDefensiveAfterPercent: 7.5,
  });

  assert.equal(evaluation.state.activeMode, 'ULTRA_DEFENSIVE');
});

test('DailyPaperProfitMilestoneGuard nunca autoriza dinheiro real', () => {
  const guard = new DailyPaperProfitMilestoneGuard();
  const state = guard.createInitialState(100);

  const evaluation = guard.evaluate(state, {
    currentBankroll: 108,
    roundIndex: 40,
  });

  assert.equal(state.paperOnly, true);
  assert.equal(state.liveMoneyAuthorized, false);
  assert.equal(state.productionMoneyAllowed, false);
  assert.equal(evaluation.state.paperOnly, true);
  assert.equal(evaluation.state.liveMoneyAuthorized, false);
  assert.equal(evaluation.state.productionMoneyAllowed, false);
});
