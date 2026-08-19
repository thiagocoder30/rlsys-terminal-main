const {
  PaperRuntimeEnduranceEvidenceResolver,
} = require('../../../dist/application/runtime/PaperRuntimeEnduranceEvidenceResolver.js');

function source(name, overrides = {}) {
  return {
    name,
    content: JSON.stringify({
      generatedAtEpochMs: 1000,
      durationMs: 60000,
      result: {
        stable: true,
        iterations: 50000,
        heapDriftBytes: 1024,
        peakEventLoopLagMs: 10,
        pressureViolations: 0,
        ...overrides,
      },
    }),
  };
}

describe('PaperRuntimeEnduranceEvidenceResolver', () => {
  test('returns NO_DATA when no endurance evidence exists', () => {
    const resolver =
      new PaperRuntimeEnduranceEvidenceResolver();

    const result = resolver.resolve({
      sources: [],
      baseline: 'MOBILE_CONSERVATIVE',
    });

    expect(result.status).toBe('NO_DATA');
    expect(result.sourceCount).toBe(0);
    expect(result.hasEvidence).toBe(false);
    expect(result.summary.totalReports).toBe(0);
    expect(result.paperOnly).toBe(true);
    expect(result.liveMoneyAuthorization).toBe(false);
  });

  test('returns READY for certified endurance evidence', () => {
    const resolver =
      new PaperRuntimeEnduranceEvidenceResolver();

    const result = resolver.resolve({
      sources: [
        source('runtime-soak-report.json'),
      ],
      baseline: 'MOBILE_CONSERVATIVE',
    });

    expect(result.status).toBe('READY');
    expect(result.hasEvidence).toBe(true);
    expect(result.sourceCount).toBe(1);
    expect(result.summary.totalReports).toBe(1);
    expect(result.summary.certifiedReports).toBe(1);
    expect(result.summary.failedReports).toBe(0);
  });

  test('returns FAILED when endurance evidence violates certification policy', () => {
    const resolver =
      new PaperRuntimeEnduranceEvidenceResolver();

    const result = resolver.resolve({
      sources: [
        source('runtime-soak-failed.json', {
          stable: false,
          pressureViolations: 1,
        }),
      ],
      baseline: 'MOBILE_CONSERVATIVE',
    });

    expect(result.status).toBe('FAILED');
    expect(result.summary.failedReports).toBe(1);
  });

  test('returns WARNING when evidence reaches warning thresholds without failing', () => {
    const resolver =
      new PaperRuntimeEnduranceEvidenceResolver();

    const result = resolver.resolve({
      sources: [
        source('runtime-soak-warning.json', {
          heapDriftBytes: 10 * 1024 * 1024,
          peakEventLoopLagMs: 200,
        }),
      ],
      baseline: 'MOBILE_CONSERVATIVE',
    });

    expect(result.status).toBe('WARNING');
    expect(result.summary.warnings).toBe(1);
  });

  test('detects regression across multiple reports', () => {
    const resolver =
      new PaperRuntimeEnduranceEvidenceResolver();

    const result = resolver.resolve({
      sources: [
        source('soak-a.json', {
          heapDriftBytes: 1000,
          peakEventLoopLagMs: 10,
        }),
        {
          name: 'soak-b.json',
          content: JSON.stringify({
            generatedAtEpochMs: 2000,
            durationMs: 60000,
            result: {
              stable: true,
              iterations: 50000,
              heapDriftBytes: 2000,
              peakEventLoopLagMs: 20,
              pressureViolations: 0,
            },
          }),
        },
        {
          name: 'soak-c.json',
          content: JSON.stringify({
            generatedAtEpochMs: 3000,
            durationMs: 60000,
            result: {
              stable: true,
              iterations: 50000,
              heapDriftBytes: 3000,
              peakEventLoopLagMs: 30,
              pressureViolations: 0,
            },
          }),
        },
      ],
      baseline: 'MOBILE_CONSERVATIVE',
    });

    expect(
      result.summary.heapDriftRegression,
    ).toBe(true);

    expect(
      result.summary.lagRegression,
    ).toBe(true);

    expect(result.status).toBe('FAILED');
  });

  test('rejects invalid baseline', () => {
    const resolver =
      new PaperRuntimeEnduranceEvidenceResolver();

    expect(() =>
      resolver.resolve({
        sources: [],
        baseline: 'UNKNOWN',
      }),
    ).toThrow(
      'paper_runtime_endurance_baseline_invalid',
    );
  });
});
