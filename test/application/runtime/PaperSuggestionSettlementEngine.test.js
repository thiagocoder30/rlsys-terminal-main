const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PaperSuggestionSettlementEngine,
} = require('../../../dist/application/runtime/PaperSuggestionSettlementEngine.js');

test('PaperSuggestionSettlementEngine cria estado inicial PAPER seguro', () => {
  const engine = new PaperSuggestionSettlementEngine();
  const state = engine.createInitialState(70);

  assert.equal(state.bankroll, 70);
  assert.equal(state.pendingSuggestion, null);
  assert.equal(state.liveMoneyAuthorized, false);
  assert.equal(state.productionMoneyAllowed, false);
  assert.equal(state.operatorDecisionRequired, true);
  assert.equal(state.supervisedRecommendationOnly, true);
});

test('PaperSuggestionSettlementEngine abre sugestão PAPER pendente', () => {
  const engine = new PaperSuggestionSettlementEngine();
  const state = engine.createInitialState(70);

  const next = engine.openSuggestion(state, {
    suggestionId: 'sug-1',
    strategyId: 'triplicacao',
    targetColor: 'RED',
    stakeAmount: 2,
    openedAtRoundIndex: 200,
    confidenceScore: 0.82,
    riskScore: 0.21,
  }, '2026-06-10T00:00:00.000Z');

  assert.equal(next.pendingSuggestion.suggestionId, 'sug-1');
  assert.equal(next.pendingSuggestion.targetColor, 'RED');
  assert.equal(next.pendingSuggestion.stakeAmount, 2);
  assert.equal(next.bankroll, 70);
  assert.equal(next.ledger.length, 1);
  assert.equal(next.ledger[0].type, 'SUGGESTION_OPENED');
});

test('PaperSuggestionSettlementEngine liquida GREEN automaticamente quando cor alvo bate', () => {
  const engine = new PaperSuggestionSettlementEngine();
  let state = engine.createInitialState(70);

  state = engine.openSuggestion(state, {
    suggestionId: 'sug-green',
    strategyId: 'triplicacao',
    targetColor: 'RED',
    stakeAmount: 2,
    openedAtRoundIndex: 200,
    confidenceScore: 0.8,
    riskScore: 0.2,
  });

  const output = engine.settleOnRound(state, 7, 201, '2026-06-10T00:01:00.000Z');

  assert.equal(output.autoSettled, true);
  assert.equal(output.settledSuggestion.result, 'GREEN');
  assert.equal(output.settledSuggestion.profitLossAmount, 2);
  assert.equal(output.state.bankroll, 72);
  assert.equal(output.state.pendingSuggestion, null);
  assert.equal(output.state.settledSuggestions.length, 1);
  assert.equal(output.state.ledger.length, 2);
});

test('PaperSuggestionSettlementEngine liquida RED automaticamente quando cor alvo falha', () => {
  const engine = new PaperSuggestionSettlementEngine();
  let state = engine.createInitialState(70);

  state = engine.openSuggestion(state, {
    suggestionId: 'sug-red',
    strategyId: 'triplicacao',
    targetColor: 'RED',
    stakeAmount: 2,
    openedAtRoundIndex: 200,
    confidenceScore: 0.8,
    riskScore: 0.2,
  });

  const output = engine.settleOnRound(state, 2, 201);

  assert.equal(output.settledSuggestion.result, 'RED');
  assert.equal(output.settledSuggestion.settlementColor, 'BLACK');
  assert.equal(output.settledSuggestion.profitLossAmount, -2);
  assert.equal(output.state.bankroll, 68);
});

test('PaperSuggestionSettlementEngine liquida VOID no zero sem alterar banca', () => {
  const engine = new PaperSuggestionSettlementEngine();
  let state = engine.createInitialState(70);

  state = engine.openSuggestion(state, {
    suggestionId: 'sug-zero',
    strategyId: 'triplicacao',
    targetColor: 'BLACK',
    stakeAmount: 2,
    openedAtRoundIndex: 200,
    confidenceScore: 0.8,
    riskScore: 0.2,
  });

  const output = engine.settleOnRound(state, 0, 201);

  assert.equal(output.settledSuggestion.result, 'VOID');
  assert.equal(output.settledSuggestion.settlementColor, 'ZERO');
  assert.equal(output.settledSuggestion.profitLossAmount, 0);
  assert.equal(output.state.bankroll, 70);
  assert.equal(output.warnings.includes('ZERO_RESULT_VOID_NO_PROFIT_LOSS'), true);
});

test('PaperSuggestionSettlementEngine não liquida nada quando não há sugestão pendente', () => {
  const engine = new PaperSuggestionSettlementEngine();
  const state = engine.createInitialState(70);

  const output = engine.settleOnRound(state, 7, 201);

  assert.equal(output.autoSettled, false);
  assert.equal(output.settledSuggestion, null);
  assert.equal(output.state, state);
  assert.equal(output.reasons.includes('NO_PENDING_PAPER_SUGGESTION'), true);
});

test('PaperSuggestionSettlementEngine impede duas sugestões pendentes simultâneas', () => {
  const engine = new PaperSuggestionSettlementEngine();
  let state = engine.createInitialState(70);

  state = engine.openSuggestion(state, {
    suggestionId: 'sug-1',
    strategyId: 'triplicacao',
    targetColor: 'RED',
    stakeAmount: 2,
    openedAtRoundIndex: 200,
    confidenceScore: 0.8,
    riskScore: 0.2,
  });

  assert.throws(() => {
    engine.openSuggestion(state, {
      suggestionId: 'sug-2',
      strategyId: 'fusion-reduzida',
      targetColor: 'BLACK',
      stakeAmount: 2,
      openedAtRoundIndex: 201,
      confidenceScore: 0.8,
      riskScore: 0.2,
    });
  }, /PAPER_SUGGESTION_ALREADY_PENDING/);
});

test('PaperSuggestionSettlementEngine impede stake maior que banca PAPER', () => {
  const engine = new PaperSuggestionSettlementEngine();
  const state = engine.createInitialState(70);

  assert.throws(() => {
    engine.openSuggestion(state, {
      suggestionId: 'sug-risk',
      strategyId: 'triplicacao',
      targetColor: 'RED',
      stakeAmount: 100,
      openedAtRoundIndex: 200,
      confidenceScore: 0.8,
      riskScore: 0.2,
    });
  }, /PAPER_SUGGESTION_STAKE_EXCEEDS_BANKROLL/);
});

test('PaperSuggestionSettlementEngine nunca autoriza dinheiro real', () => {
  const engine = new PaperSuggestionSettlementEngine();
  let state = engine.createInitialState(70);

  state = engine.openSuggestion(state, {
    suggestionId: 'sug-safe',
    strategyId: 'triplicacao',
    targetColor: 'RED',
    stakeAmount: 2,
    openedAtRoundIndex: 200,
    confidenceScore: 1,
    riskScore: 0,
  });

  const output = engine.settleOnRound(state, 1, 201);

  assert.equal(state.liveMoneyAuthorized, false);
  assert.equal(state.productionMoneyAllowed, false);
  assert.equal(output.state.liveMoneyAuthorized, false);
  assert.equal(output.state.productionMoneyAllowed, false);
  assert.equal(output.settledSuggestion.liveMoneyAuthorized, false);
});
