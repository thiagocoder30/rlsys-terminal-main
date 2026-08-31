import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TriplicacaoTargetResolver,
} from '../dist/application/cli/TriplicacaoTargetResolver.js';

const resolver = new TriplicacaoTargetResolver();

test('TC continues RED when current colors are RED RED', () => {
  const result = resolver.resolve({
    patternKind: 'TC',
    firstColor: 'RED',
    secondColor: 'RED',
  });

  assert.equal(result.available, true);
  assert.equal(result.target, 'RED');
  assert.equal(result.strategyId, 'TRIPLICACAO_RED');
  assert.equal(result.projection, 'CONTINUATION');
});

test('TC continues BLACK when current colors are BLACK BLACK', () => {
  const result = resolver.resolve({
    patternKind: 'TC',
    firstColor: 'BLACK',
    secondColor: 'BLACK',
  });

  assert.equal(result.available, true);
  assert.equal(result.target, 'BLACK');
  assert.equal(result.strategyId, 'TRIPLICACAO_BLACK');
});

test('NTC alternates from RED to BLACK', () => {
  const result = resolver.resolve({
    patternKind: 'NTC',
    firstColor: 'RED',
    secondColor: 'RED',
  });

  assert.equal(result.available, true);
  assert.equal(result.target, 'BLACK');
  assert.equal(result.strategyId, 'TRIPLICACAO_BLACK');
  assert.equal(result.projection, 'ALTERNATION');
});

test('NTC alternates from BLACK to RED', () => {
  const result = resolver.resolve({
    patternKind: 'NTC',
    firstColor: 'BLACK',
    secondColor: 'BLACK',
  });

  assert.equal(result.available, true);
  assert.equal(result.target, 'RED');
  assert.equal(result.strategyId, 'TRIPLICACAO_RED');
});

test('TA alternates from second RED to BLACK', () => {
  const result = resolver.resolve({
    patternKind: 'TA',
    firstColor: 'BLACK',
    secondColor: 'RED',
  });

  assert.equal(result.available, true);
  assert.equal(result.target, 'BLACK');
  assert.equal(result.strategyId, 'TRIPLICACAO_BLACK');
  assert.equal(result.projection, 'ALTERNATION');
});

test('TA alternates from second BLACK to RED', () => {
  const result = resolver.resolve({
    patternKind: 'TA',
    firstColor: 'RED',
    secondColor: 'BLACK',
  });

  assert.equal(result.available, true);
  assert.equal(result.target, 'RED');
  assert.equal(result.strategyId, 'TRIPLICACAO_RED');
});

test('NTA continues second RED', () => {
  const result = resolver.resolve({
    patternKind: 'NTA',
    firstColor: 'BLACK',
    secondColor: 'RED',
  });

  assert.equal(result.available, true);
  assert.equal(result.target, 'RED');
  assert.equal(result.strategyId, 'TRIPLICACAO_RED');
  assert.equal(result.projection, 'CONTINUATION');
});

test('NTA continues second BLACK', () => {
  const result = resolver.resolve({
    patternKind: 'NTA',
    firstColor: 'RED',
    secondColor: 'BLACK',
  });

  assert.equal(result.available, true);
  assert.equal(result.target, 'BLACK');
  assert.equal(result.strategyId, 'TRIPLICACAO_BLACK');
});

test('TC fails closed when current colors do not satisfy doctrine', () => {
  const result = resolver.resolve({
    patternKind: 'TC',
    firstColor: 'RED',
    secondColor: 'BLACK',
  });

  assert.equal(result.available, false);
  assert.equal(result.target, undefined);
  assert.equal(result.strategyId, undefined);
  assert.equal(result.projection, 'UNAVAILABLE');
});

test('NTC fails closed when current colors do not satisfy doctrine', () => {
  const result = resolver.resolve({
    patternKind: 'NTC',
    firstColor: 'BLACK',
    secondColor: 'RED',
  });

  assert.equal(result.available, false);
});

test('TA fails closed when current colors do not satisfy doctrine', () => {
  const result = resolver.resolve({
    patternKind: 'TA',
    firstColor: 'RED',
    secondColor: 'RED',
  });

  assert.equal(result.available, false);
});

test('NTA fails closed when current colors do not satisfy doctrine', () => {
  const result = resolver.resolve({
    patternKind: 'NTA',
    firstColor: 'BLACK',
    secondColor: 'BLACK',
  });

  assert.equal(result.available, false);
});

test('every successful target remains supervised and manual-only', () => {
  const cases = [
    {
      patternKind: 'TC',
      firstColor: 'RED',
      secondColor: 'RED',
    },
    {
      patternKind: 'NTC',
      firstColor: 'BLACK',
      secondColor: 'BLACK',
    },
    {
      patternKind: 'TA',
      firstColor: 'RED',
      secondColor: 'BLACK',
    },
    {
      patternKind: 'NTA',
      firstColor: 'BLACK',
      secondColor: 'RED',
    },
  ];

  for (const input of cases) {
    const result = resolver.resolve(input);

    assert.equal(result.available, true);
    assert.equal(result.operatorDecisionRequired, true);
    assert.equal(result.supervisedRecommendationOnly, true);
    assert.equal(result.automaticEntry, false);
  }
});
