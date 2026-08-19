const {
  PaperOracleStrategyArena,
} = require(
  '../../../dist/application/runtime/PaperOracleStrategyArena.js'
);


function triplicacao(
  overrides = {},
) {
  return {
    baseAnalysis: {
      validTrioCount: 60,
      minValidTrios: 20,
    },

    metrics: [],

    selectedPatternKind:
      'TA',

    advancedEvidenceScore:
      78,

    advancedConfidenceScore:
      0.82,

    advancedRiskScore:
      0.20,

    probabilityMode:
      'PAPER_ONLY',

    liveMoneyAuthorized:
      false,

    reasons: [
      'TRIPLICACAO_ADVANCED_SELECTED:TA',
    ],

    warnings: [],

    blockers: [],

    ...overrides,
  };
}


function fusion(
  overrides = {},
) {
  return {
    heatmap: {
      sampleSize:
        200,
    },

    mode:
      'FUSION_READY',

    signalStrength:
      'STRONG',

    fusionConfidenceScore:
      0.78,

    fusionRiskScore:
      0.24,

    targetRegions: [
      {
        regionId:
          'SECTOR_TEST',

        source:
          'HOT_SECTOR',

        numbers:
          [1, 2, 3],

        heatScore:
          80,

        confidenceContribution:
          75,
      },
    ],

    hotNumberCount:
      3,

    coldNumberCount:
      3,

    fusionPressureScore:
      72,

    recencyPressureScore:
      70,

    dispersionScore:
      30,

    blockers: [],

    warnings: [],

    reasons: [
      'FUSION_HEATMAP_READY',
    ],

    auditText:
      'test',

    paperOnly:
      true,

    liveMoneyAuthorized:
      false,

    productionMoneyAllowed:
      false,

    ...overrides,
  };
}


function arena({
  trip =
    triplicacao(),

  fus =
    fusion(),
} = {}) {
  return new PaperOracleStrategyArena(
    {
      analyze() {
        return trip;
      },
    },

    {
      analyze() {
        return fus;
      },
    },
  );
}


describe(
  'PaperOracleStrategyArena',
  () => {
    test(
      'selects Triplicacao when it is the only candidate',
      () => {
        const result =
          arena({
            fus:
              fusion({
                mode:
                  'OBSERVE',

                signalStrength:
                  'WEAK',

                blockers: [],
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.decision,
        ).toBe(
          'CANDIDATE',
        );

        expect(
          result.winner.strategyId,
        ).toBe(
          'triplicacao',
        );

        expect(
          result.candidateCount,
        ).toBe(1);
      },
    );


    test(
      'selects Fusion when it is the only candidate',
      () => {
        const result =
          arena({
            trip:
              triplicacao({
                probabilityMode:
                  'OBSERVE',

                blockers: [
                  'TRIPLICACAO_ADVANCED_EVIDENCIA_INSUFICIENTE',
                ],

                advancedRiskScore:
                  0.40,
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.decision,
        ).toBe(
          'CANDIDATE',
        );

        expect(
          result.winner.strategyId,
        ).toBe(
          'fusion-reduzida',
        );

        expect(
          result.candidateCount,
        ).toBe(1);
      },
    );


    test(
      'ranks two independent candidates by current opportunity quality',
      () => {
        const result =
          arena({
            trip:
              triplicacao({
                advancedConfidenceScore:
                  0.86,

                advancedEvidenceScore:
                  84,

                advancedRiskScore:
                  0.18,
              }),

            fus:
              fusion({
                fusionConfidenceScore:
                  0.70,

                fusionPressureScore:
                  66,

                fusionRiskScore:
                  0.30,
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.candidateCount,
        ).toBe(2);

        expect(
          result.ranking.length,
        ).toBe(2);

        expect(
          result.ranking[0]
            .strategyId,
        ).toBe(
          'triplicacao',
        );

        expect(
          result.ranking[0]
            .opportunityScore,
        ).toBeGreaterThan(
          result.ranking[1]
            .opportunityScore,
        );
      },
    );


    test(
      'blocked Fusion does not veto valid Triplicacao candidate',
      () => {
        const result =
          arena({
            fus:
              fusion({
                mode:
                  'BLOCKED',

                signalStrength:
                  'NONE',

                fusionConfidenceScore:
                  0.20,

                fusionRiskScore:
                  0.80,

                blockers: [
                  'FUSION_HEATMAP_RISK_TOO_HIGH',
                ],
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.decision,
        ).toBe(
          'CANDIDATE',
        );

        expect(
          result.winner.strategyId,
        ).toBe(
          'triplicacao',
        );

        expect(
          result.blockedCount,
        ).toBe(1);
      },
    );


    test(
      'blocked Triplicacao does not veto valid Fusion candidate',
      () => {
        const result =
          arena({
            trip:
              triplicacao({
                probabilityMode:
                  'OBSERVE',

                advancedConfidenceScore:
                  0.20,

                advancedEvidenceScore:
                  20,

                advancedRiskScore:
                  0.80,

                blockers: [
                  'TRIPLICACAO_RISK_TOO_HIGH',
                ],
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.decision,
        ).toBe(
          'CANDIDATE',
        );

        expect(
          result.winner.strategyId,
        ).toBe(
          'fusion-reduzida',
        );

        expect(
          result.blockedCount,
        ).toBe(1);
      },
    );


    test(
      'arena blocks only when every participating strategy is blocked',
      () => {
        const result =
          arena({
            trip:
              triplicacao({
                probabilityMode:
                  'OBSERVE',

                advancedRiskScore:
                  0.82,

                blockers: [
                  'TRIPLICACAO_RISK_TOO_HIGH',
                ],
              }),

            fus:
              fusion({
                mode:
                  'BLOCKED',

                signalStrength:
                  'NONE',

                fusionRiskScore:
                  0.79,

                blockers: [
                  'FUSION_HEATMAP_RISK_TOO_HIGH',
                ],
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.decision,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.winner,
        ).toBeNull();

        expect(
          result.blockedCount,
        ).toBe(2);
      },
    );


    test(
      'observes when no strategy has a candidate and not all are blocked',
      () => {
        const result =
          arena({
            trip:
              triplicacao({
                probabilityMode:
                  'OBSERVE',

                advancedRiskScore:
                  0.40,

                blockers: [
                  'TRIPLICACAO_ADVANCED_EVIDENCIA_INSUFICIENTE',
                ],
              }),

            fus:
              fusion({
                mode:
                  'OBSERVE',

                signalStrength:
                  'WEAK',

                fusionRiskScore:
                  0.42,

                blockers: [],
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.decision,
        ).toBe(
          'OBSERVE',
        );

        expect(
          result.winner,
        ).toBeNull();

        expect(
          result.candidateCount,
        ).toBe(0);
      },
    );


    test(
      'preserves strategy-specific target semantics without inventing bet direction',
      () => {
        const result =
          arena().analyze([
            1, 2, 3,
          ]);

        const trip =
          result.candidates.find(
            (candidate) =>
              candidate.strategyId ===
              'triplicacao',
          );

        const fus =
          result.candidates.find(
            (candidate) =>
              candidate.strategyId ===
              'fusion-reduzida',
          );

        expect(
          trip.target.kind,
        ).toBe(
          'PATTERN',
        );

        expect(
          trip.target.id,
        ).toBe(
          'TRIPLICACAO_PATTERN_TA',
        );

        expect(
          trip.target.numbers,
        ).toEqual([]);

        expect(
          fus.target.kind,
        ).toBe(
          'REGION',
        );

        expect(
          fus.target.id,
        ).toBe(
          'SECTOR_TEST',
        );

        expect(
          fus.target.numbers,
        ).toEqual([
          1, 2, 3,
        ]);
      },
    );


    test(
      'rejects invalid roulette history',
      () => {
        expect(
          () =>
            arena().analyze([
              1,
              37,
              2,
            ]),
        ).toThrow(
          'paper_oracle_strategy_arena_invalid_spin',
        );
      },
    );


    test(
      'preserves PAPER safety invariants',
      () => {
        const result =
          arena().analyze([
            1, 2, 3,
          ]);

        expect(
          result.paperOnly,
        ).toBe(true);

        expect(
          result.liveMoneyAuthorization,
        ).toBe(false);

        expect(
          result.automaticBetExecutionAllowed,
        ).toBe(false);

        expect(
          result.operatorDecisionRequired,
        ).toBe(true);

        for (
          const candidate of
          result.candidates
        ) {
          expect(
            candidate.paperOnly,
          ).toBe(true);

          expect(
            candidate.liveMoneyAuthorization,
          ).toBe(false);

          expect(
            candidate.automaticBetExecutionAllowed,
          ).toBe(false);
        }
      },
    );
  },
);
