const {
  PaperSessionInitialRiskEvaluator,
} = require('../../../dist/application/runtime/PaperSessionInitialRiskEvaluator.js');

function configuration(overrides = {}) {
  return {
    status: 'CONFIGURED',
    sessionId: 'paper-risk-001',
    bankroll: 150,
    provider: 'EVOLUTION',
    minimumChipValue: 0.50,
    operatorId: 'Thiago',
    riskMode: 'CONSERVATIVE',
    allowMartingale: false,
    ...overrides,
  };
}

describe('PaperSessionInitialRiskEvaluator', () => {
  test('calculates conservative profile and evaluates initial risk state', () => {
    const calls = [];

    const profileCalculator = {
      calculate(input) {
        calls.push({
          type: 'profile',
          input,
        });

        return {
          bankroll: input.bankroll,
          riskMode: input.riskMode,
          baseStake: 1.50,
          dailyStopWin: 7.50,
          dailyStopLoss: 4.50,
          maxSingleExposure: 3,
          maxMartingaleSteps: 0,
          recommendedSessionGoal: 'Paper supervision.',
        };
      },
    };

    const riskGateway = {
      evaluate(input) {
        calls.push({
          type: 'risk',
          input,
        });

        return {
          verdict: 'RISK_ALLOW',
          reason: 'Initial state accepted.',
          bankroll: {},
          profit: {},
          cooldown: {},
          guidance: {},
        };
      },
    };

    const evaluator =
      new PaperSessionInitialRiskEvaluator(
        profileCalculator,
        riskGateway,
      );

    const result = evaluator.evaluate({
      configuration: configuration(),
      nowEpochMs: 123456,
    });

    expect(calls[0]).toEqual({
      type: 'profile',
      input: {
        bankroll: 150,
        riskMode: 'CONSERVATIVE',
        allowMartingale: false,
      },
    });

    expect(calls[1].type).toBe('risk');

    expect(calls[1].input.commandType).toBe('OTHER');
    expect(calls[1].input.currentBalance).toBe(150);
    expect(calls[1].input.requestedStake).toBe(1.50);
    expect(calls[1].input.currentSessionPnl).toBe(0);
    expect(calls[1].input.martingaleStep).toBe(0);
    expect(calls[1].input.nowEpochMs).toBe(123456);

    expect(result.currentBalance).toBe(150);
    expect(result.currentSessionPnl).toBe(0);
    expect(result.requestedStake).toBe(1.50);
    expect(result.martingaleStep).toBe(0);
    expect(result.decision.verdict).toBe('RISK_ALLOW');

    expect(result.paperOnly).toBe(true);
    expect(result.liveMoneyAuthorization).toBe(false);
    expect(result.automaticExecutionAllowed).toBe(false);
    expect(result.humanSupervisionRequired).toBe(true);
  });

  test('preserves explicit moderate risk and martingale policy', () => {
    const profileCalculator = {
      calculate(input) {
        return {
          bankroll: input.bankroll,
          riskMode: input.riskMode,
          baseStake: 3,
          dailyStopWin: 12,
          dailyStopLoss: 7.50,
          maxSingleExposure: 6,
          maxMartingaleSteps: input.allowMartingale ? 1 : 0,
          recommendedSessionGoal: 'Moderate paper supervision.',
        };
      },
    };

    const riskGateway = {
      evaluate(input) {
        return {
          verdict: 'RISK_REVIEW',
          reason: 'Review required.',
          bankroll: {},
          profit: {},
          cooldown: {},
          guidance: {},
        };
      },
    };

    const evaluator =
      new PaperSessionInitialRiskEvaluator(
        profileCalculator,
        riskGateway,
      );

    const result = evaluator.evaluate({
      configuration: configuration({
        bankroll: 200,
        riskMode: 'MODERATE',
        allowMartingale: true,
      }),
      nowEpochMs: 2000,
    });

    expect(result.profile.riskMode).toBe('MODERATE');
    expect(result.profile.maxMartingaleSteps).toBe(1);
    expect(result.requestedStake).toBe(
      result.profile.baseStake,
    );
    expect(result.decision.verdict).toBe('RISK_REVIEW');
  });

  test('preserves gateway block decision without rewriting it', () => {
    const evaluator =
      new PaperSessionInitialRiskEvaluator(
        {
          calculate(input) {
            return {
              bankroll: input.bankroll,
              riskMode: input.riskMode,
              baseStake: 1,
              dailyStopWin: 5,
              dailyStopLoss: 3,
              maxSingleExposure: 2,
              maxMartingaleSteps: 0,
              recommendedSessionGoal: 'Safe.',
            };
          },
        },

        {
          evaluate() {
            return {
              verdict: 'RISK_BLOCK',
              reason: 'Risk gate blocked.',
              bankroll: {},
              profit: {},
              cooldown: {},
              guidance: {},
            };
          },
        },
      );

    const result = evaluator.evaluate({
      configuration: configuration(),
      nowEpochMs: 3000,
    });

    expect(result.decision.verdict).toBe('RISK_BLOCK');
    expect(result.decision.reason).toBe('Risk gate blocked.');
  });

  test('uses real OperatorRiskProfileCalculator by default', () => {
    const evaluator =
      new PaperSessionInitialRiskEvaluator();

    const result = evaluator.evaluate({
      configuration: configuration({
        bankroll: 150,
        riskMode: 'CONSERVATIVE',
        allowMartingale: false,
      }),
      nowEpochMs: 4000,
    });

    expect(result.profile.bankroll).toBe(150);
    expect(result.profile.riskMode).toBe('CONSERVATIVE');
    expect(result.profile.baseStake).toBeGreaterThan(0);
    expect(result.profile.maxMartingaleSteps).toBe(0);

    expect([
      'RISK_ALLOW',
      'RISK_REVIEW',
      'RISK_BLOCK',
    ]).toContain(
      result.decision.verdict,
    );
  });

  test('rejects configuration that is not ready', () => {
    const evaluator =
      new PaperSessionInitialRiskEvaluator();

    expect(() =>
      evaluator.evaluate({
        configuration: configuration({
          status: 'PENDING',
        }),
        nowEpochMs: 5000,
      }),
    ).toThrow(
      'paper_session_initial_risk_configuration_not_ready',
    );
  });
});
