const {
  PaperSessionHistoryInputParser,
} = require('../../../dist/application/runtime/PaperSessionHistoryInputParser.js');

describe('PaperSessionHistoryInputParser', () => {
  test('parses space separated history', () => {
    const parser = new PaperSessionHistoryInputParser();

    const result = parser.parse('32 15 0 19 22 7');

    expect(result.accepted).toBe(true);
    expect(result.status).toBe('PARSED');
    expect(result.rounds).toEqual([32, 15, 0, 19, 22, 7]);
    expect(result.roundCount).toBe(6);
  });

  test('parses comma separated history', () => {
    const parser = new PaperSessionHistoryInputParser();

    const result = parser.parse('32,15,0,19,22,7');

    expect(result.accepted).toBe(true);
    expect(result.rounds).toEqual([32, 15, 0, 19, 22, 7]);
  });

  test('parses semicolon, pipe and multiline mixed history', () => {
    const parser = new PaperSessionHistoryInputParser();

    const result = parser.parse(
      '32; 15 | 0\n19,22\n7 14',
    );

    expect(result.accepted).toBe(true);
    expect(result.rounds).toEqual([
      32,
      15,
      0,
      19,
      22,
      7,
      14,
    ]);
    expect(result.roundCount).toBe(7);
  });

  test('accepts roulette boundaries zero and thirty six', () => {
    const parser = new PaperSessionHistoryInputParser();

    const result = parser.parse('0 36');

    expect(result.accepted).toBe(true);
    expect(result.rounds).toEqual([0, 36]);
  });

  test('rejects roulette numbers above thirty six', () => {
    const parser = new PaperSessionHistoryInputParser();

    const result = parser.parse('12 37 8');

    expect(result.accepted).toBe(false);
    expect(result.status).toBe('INVALID');
    expect(result.invalidTokens).toEqual(['37']);
  });

  test('rejects accidental text mixed into clipboard', () => {
    const parser = new PaperSessionHistoryInputParser();

    const result = parser.parse('32 15 giro 19');

    expect(result.accepted).toBe(false);
    expect(result.status).toBe('INVALID');
    expect(result.invalidTokens).toEqual(['giro']);
  });

  test('rejects empty sync input', () => {
    const parser = new PaperSessionHistoryInputParser();

    const result = parser.parse('   \n   ');

    expect(result.accepted).toBe(false);
    expect(result.status).toBe('EMPTY');
    expect(result.roundCount).toBe(0);
  });
});
