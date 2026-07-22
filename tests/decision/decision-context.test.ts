import { DecisionContext, StrategyPerformance } from '../../src/decision/DecisionContext';

describe('DecisionContext interface', () => {
  it('should accept a valid DecisionContext object', () => {
    const strategyPerf: StrategyPerformance = {
      strategy: 'TestStrategy',
      score: 0.85,
      confidence: 0.9,
    };

    const context: DecisionContext = {
      timeline: [1, 2, 3],
      bankroll: 1000,
      vix: 12.5,
      markovMatrix: [0.1, 0.2, 0.3],
      strategyPerformance: [strategyPerf],
      cooldown: 30,
      burnIn: 5,
    };

    expect(context).toMatchObject({
      timeline: expect.any(Array),
      bankroll: expect.any(Number),
      vix: expect.any(Number),
      markovMatrix: expect.any(Array),
      strategyPerformance: expect.any(Array),
      cooldown: expect.any(Number),
      burnIn: expect.any(Number),
    });

    expect(context.strategyPerformance[0]).toEqual(strategyPerf);
  });
});
