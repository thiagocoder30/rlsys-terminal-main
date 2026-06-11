const assert = require('node:assert/strict');
const test = require('node:test');

const {
  TriplicacaoAuditExplainabilityEngine,
} = require('../../../dist/application/runtime/TriplicacaoAuditExplainabilityEngine.js');

test('TriplicacaoAuditExplainabilityEngine lê grid de baixo para cima e direita para esquerda', () => {
  const engine = new TriplicacaoAuditExplainabilityEngine();

  const report = engine.auditFromGrid([
    [23, 18, 5],
    [12, 7, 30],
    [34, 16, 11],
  ]);

  assert.deepEqual(report.rounds.map((round) => round.roundNumber), [
    11, 16, 34,
    30, 7, 12,
    5, 18, 23,
  ]);
  assert.equal(report.readDirection, 'BOTTOM_TO_TOP_RIGHT_TO_LEFT');
  assert.ok(report.debugText.includes('0: 11 BLACK row=2 col=2'));
  assert.ok(report.debugText.includes('8: 23 RED row=0 col=0'));
});

test('TriplicacaoAuditExplainabilityEngine forma e classifica trios corretamente', () => {
  const engine = new TriplicacaoAuditExplainabilityEngine();

  const report = engine.auditFromSequence([
    1, 3, 5,
    1, 3, 2,
    1, 2, 3,
    1, 2, 4,
  ]);

  assert.equal(report.validTrioCount, 4);
  assert.deepEqual(report.trios.map((trio) => trio.patternKind), ['TC', 'NTC', 'TA', 'NTA']);
  assert.equal(report.trios[0].colors.join(','), 'RED,RED,RED');
  assert.equal(report.trios[1].colors.join(','), 'RED,RED,BLACK');
  assert.equal(report.trios[2].colors.join(','), 'RED,BLACK,RED');
  assert.equal(report.trios[3].colors.join(','), 'RED,BLACK,BLACK');
});

test('TriplicacaoAuditExplainabilityEngine descarta trio com zero de forma auditável', () => {
  const engine = new TriplicacaoAuditExplainabilityEngine();

  const report = engine.auditFromSequence([
    1, 0, 5,
    1, 3, 5,
  ]);

  assert.equal(report.discardedZeroTrioCount, 1);
  assert.equal(report.validTrioCount, 1);
  assert.equal(report.zeroDiscards[0].reason, 'ZERO_IN_TRIO');
  assert.deepEqual(report.zeroDiscards[0].numbers, [1, 0, 5]);
  assert.ok(report.debugText.includes('ZERO_DISCARDS'));
});

test('TriplicacaoAuditExplainabilityEngine calcula resumo estatístico por padrão', () => {
  const engine = new TriplicacaoAuditExplainabilityEngine();

  const report = engine.auditFromSequence([
    1, 3, 5,
    1, 3, 5,
    1, 3, 2,
    1, 2, 3,
  ]);

  const tc = report.summaries.find((summary) => summary.patternKind === 'TC');
  const ntc = report.summaries.find((summary) => summary.patternKind === 'NTC');

  assert.ok(tc);
  assert.ok(ntc);
  assert.equal(tc.count, 2);
  assert.equal(tc.frequencyPercent, 50);
  assert.equal(tc.maxConsecutive, 2);
  assert.equal(ntc.count, 1);
  assert.ok(report.auditText.includes('TC: count=2 freq=50%'));
});

test('TriplicacaoAuditExplainabilityEngine retorna últimos trios', () => {
  const engine = new TriplicacaoAuditExplainabilityEngine();

  const report = engine.auditFromSequence([
    1, 3, 5,
    1, 3, 2,
    1, 2, 3,
    1, 2, 4,
  ], {
    latestLimit: 2,
  });

  assert.equal(report.latestTrios.length, 2);
  assert.deepEqual(report.latestTrios.map((trio) => trio.patternKind), ['TA', 'NTA']);
  assert.ok(report.latestText.includes('#3 [RED,BLACK,RED] TA'));
  assert.ok(report.latestText.includes('#4 [RED,BLACK,BLACK] NTA'));
});

test('TriplicacaoAuditExplainabilityEngine explica padrão dominante', () => {
  const engine = new TriplicacaoAuditExplainabilityEngine();

  const report = engine.auditFromSequence([
    1, 3, 5,
    7, 9, 12,
    1, 3, 2,
    1, 2, 3,
  ]);

  assert.ok(report.explainText.includes('DOMINANT_PATTERN=TC'));
  assert.ok(report.explainText.includes('DOMINANT_FREQUENCY=50%'));
  assert.ok(report.explainText.includes('liveMoneyAuthorized=false'));
});

test('TriplicacaoAuditExplainabilityEngine formata comandos audit/latest/debug/explain', () => {
  const engine = new TriplicacaoAuditExplainabilityEngine();
  const report = engine.auditFromSequence([1, 3, 5]);

  assert.ok(engine.formatCommand(report, 'triplicacao audit').startsWith('TRIPLICACAO AUDIT'));
  assert.ok(engine.formatCommand(report, 'triplicacao latest').startsWith('TRIPLICACAO LATEST'));
  assert.ok(engine.formatCommand(report, 'triplicacao debug').startsWith('TRIPLICACAO DEBUG'));
  assert.ok(engine.formatCommand(report, 'triplicacao explain').startsWith('TRIPLICACAO EXPLAIN'));
});

test('TriplicacaoAuditExplainabilityEngine mantém governança PAPER only', () => {
  const engine = new TriplicacaoAuditExplainabilityEngine();

  const report = engine.auditFromSequence([
    1, 3, 5,
    1, 3, 2,
  ]);

  assert.equal(report.paperOnly, true);
  assert.equal(report.liveMoneyAuthorized, false);
  assert.equal(report.productionMoneyAllowed, false);
  assert.ok(report.auditText.includes('paperOnly=true'));
});
