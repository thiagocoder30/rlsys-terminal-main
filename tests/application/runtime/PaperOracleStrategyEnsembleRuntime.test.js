const {
  PaperOracleStrategyEnsembleRuntime,
} = require(
  '../../../dist/application/runtime/PaperOracleStrategyEnsembleRuntime.js'
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
      sampleSize: 200,
    },

    mode:
      'FUSION_READY',

    signalStrength:
      'STRONG',

    fusionConfidenceScore:
      0.80,

    fusionRiskScore:
      0.22,

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
      80,

    recencyPressureScore:
      75,

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


function runtime({
  trip =
    triplicacao(),

  fus =
    fusion(),
} = {}) {
  return new PaperOracleStrategyEnsembleRuntime(
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
  'PaperOracleStrategyEnsembleRuntime',
  () => {
    test(
      'forms consensus only when Triplicacao and Fusion both support PAPER context',
      () => {
        const result =
          runtime().analyze([
            1, 2, 3, 4, 5, 6,
          ]);

        expect(
          result.decision,
        ).toBe(
          'CONSENSUS_READY',
        );

        expect(
          result.consensusReady,
        ).toBe(true);

        expect(
          result.ensemble.decision,
        ).toBe(
          'CONSENSUS',
        );

        expect(
          result.votes.map(
            (vote) =>
              vote.status,
          ),
        ).toEqual([
          'SUPPORT',
          'SUPPORT',
        ]);

        expect(
          result.ensemble
            .selectedTarget
            .targetId,
        ).toBe(
          'PAPER_CONTEXT',
        );
      },
    );


    test(
      'keeps oracle observing when only Triplicacao supports',
      () => {
        const result =
          runtime({
            fus:
              fusion({
                mode:
                  'OBSERVE',

                signalStrength:
                  'WEAK',

                fusionConfidenceScore:
                  0.55,

                fusionRiskScore:
                  0.40,

                blockers: [],
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.decision,
        ).toBe('OBSERVE');

        expect(
          result.consensusReady,
        ).toBe(false);

        expect(
          result.votes.map(
            (vote) =>
              vote.status,
          ),
        ).toEqual([
          'SUPPORT',
          'ABSTAIN',
        ]);

        expect(
          result.ensemble.decision,
        ).toBe(
          'INSUFFICIENT_SUPPORT',
        );
      },
    );


    test(
      'keeps oracle observing when only Fusion supports',
      () => {
        const result =
          runtime({
            trip:
              triplicacao({
                probabilityMode:
                  'OBSERVE',

                advancedEvidenceScore:
                  55,

                advancedConfidenceScore:
                  0.58,

                advancedRiskScore:
                  0.40,

                blockers: [
                  'TRIPLICACAO_ADVANCED_EVIDENCIA_INSUFICIENTE',
                ],
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.decision,
        ).toBe('OBSERVE');

        expect(
          result.votes.map(
            (vote) =>
              vote.status,
          ),
        ).toEqual([
          'ABSTAIN',
          'SUPPORT',
        ]);
      },
    );


    test(
      'blocks ensemble when Triplicacao risk is critical',
      () => {
        const result =
          runtime({
            trip:
              triplicacao({
                probabilityMode:
                  'OBSERVE',

                advancedConfidenceScore:
                  0.20,

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
          result.votes[0].status,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.decision,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.consensusReady,
        ).toBe(false);
      },
    );


    test(
      'blocks ensemble when Fusion reports high risk',
      () => {
        const result =
          runtime({
            fus:
              fusion({
                mode:
                  'BLOCKED',

                signalStrength:
                  'NONE',

                fusionConfidenceScore:
                  0.30,

                fusionRiskScore:
                  0.75,

                blockers: [
                  'FUSION_HEATMAP_RISK_TOO_HIGH',
                ],
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.votes[1].status,
        ).toBe(
          'BLOCKED',
        );

        expect(
          result.decision,
        ).toBe(
          'BLOCKED',
        );
      },
    );


    test(
      'treats insufficient evidence as abstention instead of critical block',
      () => {
        const result =
          runtime({
            trip:
              triplicacao({
                probabilityMode:
                  'INSUFFICIENT_DATA',

                advancedEvidenceScore:
                  0,

                advancedConfidenceScore:
                  0,

                advancedRiskScore:
                  0.50,

                blockers: [
                  'TRIPLICACAO_ADVANCED_DADOS_INSUFICIENTES',
                ],
              }),

            fus:
              fusion({
                mode:
                  'BLOCKED',

                signalStrength:
                  'NONE',

                fusionConfidenceScore:
                  0.35,

                fusionRiskScore:
                  0.50,

                blockers: [
                  'FUSION_HEATMAP_SAMPLE_INSUFFICIENT',
                ],
              }),
          }).analyze([
            1, 2, 3,
          ]);

        expect(
          result.votes.map(
            (vote) =>
              vote.status,
          ),
        ).toEqual([
          'ABSTAIN',
          'ABSTAIN',
        ]);

        expect(
          result.decision,
        ).toBe('OBSERVE');

        expect(
          result.consensusReady,
        ).toBe(false);
      },
    );


    test(
      'normalizes evidence to ensemble zero through one contract',
      () => {
        const result =
          runtime().analyze([
            1, 2, 3,
          ]);

        expect(
          result.votes[0]
            .evidenceScore,
        ).toBe(0.78);

        expect(
          result.votes[1]
            .evidenceScore,
        ).toBe(0.80);

        for (
          const vote of
          result.votes
        ) {
          expect(
            vote.confidence,
          ).toBeGreaterThanOrEqual(0);

          expect(
            vote.confidence,
          ).toBeLessThanOrEqual(1);

          expect(
            vote.evidenceScore,
          ).toBeGreaterThanOrEqual(0);

          expect(
            vote.evidenceScore,
          ).toBeLessThanOrEqual(1);

          expect(
            vote.riskPenalty,
          ).toBeGreaterThanOrEqual(0);

          expect(
            vote.riskPenalty,
          ).toBeLessThanOrEqual(1);
        }
      },
    );


    test(
      'rejects invalid roulette history',
      () => {
        expect(
          () =>
            runtime().analyze([
              1,
              37,
              2,
            ]),
        ).toThrow(
          'paper_oracle_strategy_ensemble_invalid_spin',
        );
      },
    );


    test(
      'preserves PAPER safety invariants',
      () => {
        const result =
          runtime().analyze([
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
      },
    );
  },
);
