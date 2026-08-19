const {
  PaperSessionOperatorConfiguration,
} = require('../../../dist/application/runtime/PaperSessionOperatorConfiguration.js');

describe('PaperSessionOperatorConfiguration', () => {
  test('configures pragmatic paper session with explicit risk policy', () => {
    const configuration =
      new PaperSessionOperatorConfiguration();

    const result = configuration.configure({
      sessionId: 'paper-001',
      bankroll: 100,
      provider: 'PRAGMATIC',
      operatorId: 'Thiago',
      riskMode: 'CONSERVATIVE',
      allowMartingale: false,
    });

    expect(result.status).toBe('CONFIGURED');
    expect(result.sessionId).toBe('paper-001');
    expect(result.bankroll).toBe(100);
    expect(result.provider).toBe('PRAGMATIC');
    expect(result.minimumChipValue).toBe(0.10);
    expect(result.operatorId).toBe('Thiago');
    expect(result.riskMode).toBe('CONSERVATIVE');
    expect(result.allowMartingale).toBe(false);
  });

  test('configures evolution paper session with explicit martingale permission', () => {
    const configuration =
      new PaperSessionOperatorConfiguration();

    const result = configuration.configure({
      sessionId: 'paper-002',
      bankroll: 150,
      provider: 'EVOLUTION',
      riskMode: 'MODERATE',
      allowMartingale: true,
    });

    expect(result.status).toBe('CONFIGURED');
    expect(result.minimumChipValue).toBe(0.50);
    expect(result.riskMode).toBe('MODERATE');
    expect(result.allowMartingale).toBe(true);
  });

  test('normalizes bankroll to currency precision', () => {
    const configuration =
      new PaperSessionOperatorConfiguration();

    const result = configuration.configure({
      sessionId: 'paper-money',
      bankroll: 100.126,
      provider: 'PRAGMATIC',
      riskMode: 'CONSERVATIVE',
      allowMartingale: false,
    });

    expect(result.bankroll).toBe(100.13);
  });

  test('normalizes optional operator id', () => {
    const configuration =
      new PaperSessionOperatorConfiguration();

    const result = configuration.configure({
      sessionId: 'paper-operator',
      bankroll: 100,
      provider: 'PRAGMATIC',
      operatorId: '  Thiago  ',
      riskMode: 'CONSERVATIVE',
      allowMartingale: false,
    });

    expect(result.operatorId).toBe('Thiago');
  });

  test('rejects invalid bankroll', () => {
    const configuration =
      new PaperSessionOperatorConfiguration();

    expect(() =>
      configuration.configure({
        sessionId: 'paper-invalid',
        bankroll: 0,
        provider: 'PRAGMATIC',
        riskMode: 'CONSERVATIVE',
        allowMartingale: false,
      }),
    ).toThrow(
      'paper_session_invalid_bankroll',
    );
  });

  test('rejects invalid provider', () => {
    const configuration =
      new PaperSessionOperatorConfiguration();

    expect(() =>
      configuration.configure({
        sessionId: 'paper-invalid',
        bankroll: 100,
        provider: 'UNKNOWN',
        riskMode: 'CONSERVATIVE',
        allowMartingale: false,
      }),
    ).toThrow(
      'paper_session_invalid_provider',
    );
  });

  test('rejects invalid risk mode', () => {
    const configuration =
      new PaperSessionOperatorConfiguration();

    expect(() =>
      configuration.configure({
        sessionId: 'paper-invalid-risk',
        bankroll: 100,
        provider: 'PRAGMATIC',
        riskMode: 'UNKNOWN',
        allowMartingale: false,
      }),
    ).toThrow(
      'paper_session_invalid_risk_mode',
    );
  });

  test('rejects invalid martingale policy', () => {
    const configuration =
      new PaperSessionOperatorConfiguration();

    expect(() =>
      configuration.configure({
        sessionId: 'paper-invalid-mg',
        bankroll: 100,
        provider: 'PRAGMATIC',
        riskMode: 'CONSERVATIVE',
        allowMartingale: 'off',
      }),
    ).toThrow(
      'paper_session_invalid_martingale_policy',
    );
  });
});
