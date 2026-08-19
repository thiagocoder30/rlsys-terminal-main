const {
  TriplicacaoProspectivePerformanceAnalyzer,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectivePerformanceAnalyzer.js'
);


function record({
  signalId,
  pattern = 'TC',
  confidence = 0.75,
  evidence = 80,
  risk = 0.20,
  stake = 0.60,
  operatorDecision = 'UNDECIDED',
  status = 'SETTLED',
  result = 'WIN',
  createdAt = 1000,
  settledAt = 2000,
  operatorDecisionAt = null,
} = {}) {
  const pending =
    status ===
    'PENDING';

  const thirdNumber =
    pending
      ? null
      : result ===
        'VOID'
        ? 0
        : result ===
          'WIN'
          ? 5
          : 2;

  const thirdColor =
    pending
      ? null
      : result ===
        'VOID'
        ? 'ZERO'
        : result ===
          'WIN'
          ? 'RED'
          : 'BLACK';

  const effectiveOperatorDecisionAt =
    operatorDecision ===
    'UNDECIDED'
      ? null
      : operatorDecisionAt ??
        createdAt +
        100;

  return {
    signalId:
      signalId ||
      `signal-${createdAt}`,

    sessionId:
      'paper-1',

    createdAtEpochMs:
      createdAt,

    settledAtEpochMs:
      pending
        ? null
        : settledAt,

    operatorDecisionAtEpochMs:
      effectiveOperatorDecisionAt,

    status,

    operatorDecision,

    pattern,

    firstNumber:
      1,

    secondNumber:
      3,

    thirdNumber,

    firstColor:
      'RED',

    secondColor:
      'RED',

    thirdColor,

    targetColor:
      'RED',

    suggestedStake:
      stake,

    confidenceScore:
      confidence,

    evidenceScore:
      evidence,

    riskScore:
      risk,

    result:
      pending
        ? null
        : result,

    rationale:
      'test',

    reasons: [],

    warnings: [],

    paperOnly:
      true,

    recommendationOnly:
      true,

    humanExecutionRequired:
      true,

    liveMoneyAuthorization:
      false,

    automaticBetExecutionAllowed:
      false,
  };
}


describe(
  'TriplicacaoProspectivePerformanceAnalyzer',
  () => {
    const analyzer =
      new TriplicacaoProspectivePerformanceAnalyzer();


    test(
      'overall performance includes followed ignored and undecided recommendations',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'followed-win',

              operatorDecision:
                'FOLLOWED',

              result:
                'WIN',
            }),

            record({
              signalId:
                'ignored-loss',

              operatorDecision:
                'IGNORED',

              result:
                'LOSS',

              createdAt:
                2000,
            }),

            record({
              signalId:
                'undecided-win',

              result:
                'WIN',

              createdAt:
                3000,
            }),
          ]);

        expect(
          report.wins,
        ).toBe(2);

        expect(
          report.losses,
        ).toBe(1);

        expect(
          report.hitRate,
        ).toBeCloseTo(
          2 / 3,
          6,
        );
      },
    );


    test(
      'calculates followed performance separately',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'a',

              operatorDecision:
                'FOLLOWED',

              result:
                'WIN',

              stake:
                0.60,
            }),

            record({
              signalId:
                'b',

              operatorDecision:
                'FOLLOWED',

              result:
                'LOSS',

              stake:
                0.80,

              createdAt:
                2000,
            }),

            record({
              signalId:
                'c',

              operatorDecision:
                'IGNORED',

              result:
                'WIN',

              stake:
                1.00,

              createdAt:
                3000,
            }),
          ]);

        expect(
          report.operator.followedSignals,
        ).toBe(2);

        expect(
          report.operator.ignoredSignals,
        ).toBe(1);

        expect(
          report.operator.followedWins,
        ).toBe(1);

        expect(
          report.operator.followedLosses,
        ).toBe(1);

        expect(
          report.operator.followedHitRate,
        ).toBe(0.5);

        expect(
          report.operator.totalSuggestedStakeFollowed,
        ).toBe(1.40);
      },
    );


    test(
      'ignored recommendation still affects engine hit rate',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'ignored',

              operatorDecision:
                'IGNORED',

              result:
                'LOSS',
            }),
          ]);

        expect(
          report.losses,
        ).toBe(1);

        expect(
          report.hitRate,
        ).toBe(0);

        expect(
          report.operator.followedSignals,
        ).toBe(0);
      },
    );


    test(
      'calculates wins losses voids and excludes void from hit rate',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'a',

              result:
                'WIN',
            }),

            record({
              signalId:
                'b',

              result:
                'LOSS',

              createdAt:
                2000,
            }),

            record({
              signalId:
                'c',

              result:
                'VOID',

              createdAt:
                3000,
            }),
          ]);

        expect(
          report.wins,
        ).toBe(1);

        expect(
          report.losses,
        ).toBe(1);

        expect(
          report.voids,
        ).toBe(1);

        expect(
          report.hitRate,
        ).toBe(0.5);

        expect(
          report.voidRate,
        ).toBeCloseTo(
          1 / 3,
          6,
        );
      },
    );


    test(
      'excludes pending signals from settled performance',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'settled',
            }),

            record({
              signalId:
                'pending',

              status:
                'PENDING',

              result:
                null,

              createdAt:
                2000,
            }),
          ]);

        expect(
          report.totalSignals,
        ).toBe(2);

        expect(
          report.pendingSignals,
        ).toBe(1);

        expect(
          report.settledSignals,
        ).toBe(1);
      },
    );


    test(
      'calculates performance by pattern',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'tc-win',

              pattern:
                'TC',

              result:
                'WIN',
            }),

            record({
              signalId:
                'tc-loss',

              pattern:
                'TC',

              result:
                'LOSS',

              createdAt:
                2000,
            }),

            record({
              signalId:
                'ta-win',

              pattern:
                'TA',

              result:
                'WIN',

              createdAt:
                3000,
            }),
          ]);

        const tc =
          report.byPattern.find(
            (item) =>
              item.pattern ===
              'TC',
          );

        const ta =
          report.byPattern.find(
            (item) =>
              item.pattern ===
              'TA',
          );

        expect(
          tc.hitRate,
        ).toBe(0.5);

        expect(
          ta.hitRate,
        ).toBe(1);
      },
    );


    test(
      'calculates confidence buckets',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'a',

              confidence:
                0.72,

              result:
                'WIN',
            }),

            record({
              signalId:
                'b',

              confidence:
                0.76,

              result:
                'LOSS',

              createdAt:
                2000,
            }),

            record({
              signalId:
                'c',

              confidence:
                0.83,

              result:
                'WIN',

              createdAt:
                3000,
            }),
          ]);

        const bucket70 =
          report.confidenceBuckets.find(
            (item) =>
              item.bucket ===
              '70-79%',
          );

        expect(
          bucket70.hitRate,
        ).toBe(0.5);

        expect(
          bucket70.averageConfidence,
        ).toBe(0.74);
      },
    );


    test(
      'calculates maximum loss streak',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'a',

              result:
                'LOSS',
            }),

            record({
              signalId:
                'b',

              result:
                'LOSS',

              createdAt:
                2000,
            }),

            record({
              signalId:
                'c',

              result:
                'WIN',

              createdAt:
                3000,
            }),
          ]);

        expect(
          report.maxLossStreak,
        ).toBe(2);

        expect(
          report.currentLossStreak,
        ).toBe(0);
      },
    );


    test(
      'warns about undecided operator recommendation',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'a',

              operatorDecision:
                'UNDECIDED',
            }),
          ]);

        expect(
          report.operator.undecidedSignals,
        ).toBe(1);

        expect(
          report.warnings,
        ).toContain(
          'TRIPLICACAO_OPERATOR_DECISIONS_PENDING',
        );
      },
    );


    test(
      'returns null followed hit rate when operator followed none',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'ignored',

              operatorDecision:
                'IGNORED',
            }),
          ]);

        expect(
          report.operator.followedHitRate,
        ).toBeNull();
      },
    );


    test(
      'preserves permanent supervised philosophy',
      () => {
        const report =
          analyzer.analyze([
            record({
              signalId:
                'a',
            }),
          ]);

        expect(
          report.recommendationOnly,
        ).toBe(true);

        expect(
          report.humanExecutionRequired,
        ).toBe(true);

        expect(
          report.liveMoneyAuthorization,
        ).toBe(false);

        expect(
          report.automaticBetExecutionAllowed,
        ).toBe(false);
      },
    );
  },
);
