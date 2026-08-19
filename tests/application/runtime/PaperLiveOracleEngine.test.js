const {
  PaperLiveOracleEngine,
} = require(
  '../../../dist/application/runtime/PaperLiveOracleEngine.js'
);


function analyticsResult(
  recommendation,
  confidence = 0.5,
  risk = 0.5,
) {
  return {
    recommendation,
    confidence,
    risk,

    triplicacao: {
      totalTrios: 50,
      tc: 20,
      ntc: 10,
      ta: 10,
      nta: 10,
      zeroTrios: 0,
      dominantPattern: 'TC',
      dominantRatio: 0.4,
    },

    heatmap: {
      hotNumbers: [1, 2, 3],
      coldNumbers: [34, 35, 36],
      zeroFrequency: 0.02,
    },

    consensus: {
      enginesAligned: 2,
      enginesTotal: 3,

      classification:
        recommendation ===
        'PAPER_SINAL_FORTE'
          ? 'PAPER_ONLY'
          : recommendation ===
            'PAPER_SINAL_FRACO'
            ? 'WATCHLIST'
            : 'WEAK_CONTEXT',
    },

    message:
      recommendation,

    paperOnly: true,
    liveMoneyAuthorization: false,
    automaticBetExecutionAllowed: false,
  };
}


function presenter() {
  return {
    present(input) {
      const blockers =
        input.blockers || [];

      const riskScore =
        input.riskScore || 0;

      const riskLevel =
        blockers.length > 0
          ? 'ELEVADO'
          : riskScore >= 0.67
            ? 'ELEVADO'
            : riskScore >= 0.34
              ? 'MODERADO'
              : 'CONTROLADO';

      return {
        ok: true,

        value: {
          strategyName:
            input.strategyName,

          status:
            input.finalDecision ===
            'PAPER_FAVORAVEL'
              ? 'FAVORAVEL'
              : input.finalDecision ===
                'NAO_UTILIZAR'
                ? 'BLOQUEADO'
                : 'AGUARDAR',

          confidencePercent:
            Math.round(
              (input.confidenceScore || 0) *
              100,
            ),

          riskLevel,

          headline:
            'test',

          actionLabel:
            input.finalDecision ===
            'PAPER_FAVORAVEL'
              ? 'CONSIDERAR_ENTRADA_MANUAL_SUPERVISIONADA'
              : 'AGUARDAR_NOVO_GIRO',

          explanation:
            input.operatorSummary,

          reasons:
            input.reasons || [],

          warnings:
            input.warnings || [],

          blockers,

          currentRoundIndex:
            input.currentRoundIndex,

          observedRounds:
            input.observedRounds,

          operatorDecisionRequired:
            true,

          supervisedRecommendationOnly:
            true,

          institutionalAnalysisMode:
            true,
        },
      };
    },
  };
}


function noTarget() {
  return {
    status:
      'NONE',

    strategySignal:
      null,

    target:
      null,

    confidenceScore:
      0,

    confidencePercent:
      0,

    suggestedFraction:
      0,

    suggestedStake:
      0,

    riskLevel:
      'UNAVAILABLE',

    rationale:
      'No target.',

    warnings: [],

    reasons: [
      'NO_TARGET',
    ],

    analyzedRounds:
      0,

    paperOnly: true,

    liveMoneyAuthorization: false,

    automaticBetExecutionAllowed: false,

    operatorDecisionRequired: true,
  };
}


function candidateTarget() {
  return {
    status:
      'CANDIDATE',

    strategySignal:
      'SECTOR_BIAS',

    target:
      'voisins',

    confidenceScore:
      0.72,

    confidencePercent:
      72,

    suggestedFraction:
      0.005,

    suggestedStake:
      0.15,

    riskLevel:
      'MEDIUM',

    rationale:
      'Bias estrutural em voisins.',

    warnings: [],

    reasons: [
      'TARGET_SECTOR:voisins',
    ],

    analyzedRounds:
      206,

    paperOnly: true,

    liveMoneyAuthorization: false,

    automaticBetExecutionAllowed: false,

    operatorDecisionRequired: true,
  };
}


function ensembleResult(
  decision =
    'CONSENSUS_READY',
) {
  const consensusReady =
    decision ===
    'CONSENSUS_READY';

  return {
    decision,

    historySize:
      206,

    assessments: [
      {
        strategyId:
          'triplicacao',

        label:
          'Triplicação Advanced',

        voteStatus:
          consensusReady
            ? 'SUPPORT'
            : decision ===
              'BLOCKED'
              ? 'BLOCKED'
              : 'ABSTAIN',

        confidenceScore:
          0.8,

        evidenceScore:
          0.75,

        riskScore:
          decision ===
          'BLOCKED'
            ? 0.8
            : 0.2,

        reasons: [],

        warnings: [],

        blockers:
          decision ===
          'BLOCKED'
            ? [
                'TRIPLICACAO_RISK_TOO_HIGH',
              ]
            : [],
      },

      {
        strategyId:
          'fusion-reduzida',

        label:
          'Fusion Reduzida',

        voteStatus:
          consensusReady
            ? 'SUPPORT'
            : 'ABSTAIN',

        confidenceScore:
          0.8,

        evidenceScore:
          0.75,

        riskScore:
          0.2,

        reasons: [],

        warnings: [],

        blockers: [],
      },
    ],

    votes: [],

    ensemble: {
      engineVersion:
        'strategy-ensemble-v1',

      voteCount:
        2,

      activeVoteCount:
        consensusReady
          ? 2
          : 0,

      decision:
        consensusReady
          ? 'CONSENSUS'
          : 'INSUFFICIENT_SUPPORT',

      selectedTarget:
        consensusReady
          ? {
              targetId:
                'PAPER_CONTEXT',

              targetLabel:
                'Contexto PAPER Favorável',

              supportVotes:
                2,

              opposeVotes:
                0,

              supportWeight:
                2,

              opposeWeight:
                0,

              averageConfidence:
                0.8,

              averageEvidenceScore:
                0.75,

              averageRiskPenalty:
                0.2,

              consensusScore:
                0.78,

              conflictScore:
                0,

              supportingStrategies: [
                'fusion-reduzida',
                'triplicacao',
              ],

              opposingStrategies: [],
            }
          : null,

      targets: [],

      supportWeight:
        consensusReady
          ? 2
          : 0,

      opposingWeight:
        0,

      abstainWeight:
        consensusReady
          ? 0
          : 2,

      blockedWeight:
        decision ===
        'BLOCKED'
          ? 1
          : 0,

      blockers:
        decision ===
        'BLOCKED'
          ? [
              'strategy blocked',
            ]
          : [],

      warnings: [],
    },

    triplicacao: {},

    fusion: {},

    consensusReady,

    reasons: [],

    warnings: [],

    blockers:
      decision ===
      'BLOCKED'
        ? [
            'TRIPLICACAO:TRIPLICACAO_RISK_TOO_HIGH',
          ]
        : [],

    paperOnly: true,

    liveMoneyAuthorization: false,

    automaticBetExecutionAllowed: false,

    operatorDecisionRequired: true,
  };
}


function oracle({
  recommendation =
    'AGUARDAR',

  confidence =
    0.18,

  risk =
    0.82,

  target =
    noTarget(),

  ensemble =
    ensembleResult(
      'OBSERVE',
    ),
} = {}) {
  return new PaperLiveOracleEngine(
    [1, 2, 3],
    30,

    {
      evaluate() {
        return analyticsResult(
          recommendation,
          confidence,
          risk,
        );
      },
    },

    presenter(),

    {
      resolve() {
        return target;
      },
    },

    {
      analyze() {
        return ensemble;
      },
    },
  );
}


describe(
  'PaperLiveOracleEngine',
  () => {
    test(
      'preserves synchronized history and appends new live spin',
      () => {
        const calls = [];

        const instance =
          new PaperLiveOracleEngine(
            [1, 2, 3],
            30,

            {
              evaluate(input) {
                calls.push(
                  input,
                );

                return analyticsResult(
                  'AGUARDAR',
                  0.18,
                  0.82,
                );
              },
            },

            presenter(),

            {
              resolve() {
                return noTarget();
              },
            },

            {
              analyze() {
                return ensembleResult(
                  'OBSERVE',
                );
              },
            },
          );

        const result =
          instance.ingest(17);

        expect(
          result.liveRounds,
        ).toEqual([17]);

        expect(
          result.warmupRounds,
        ).toEqual(
          [1, 2, 3],
        );

        expect(
          calls[0].warmupRounds,
        ).toEqual(
          ['1', '2', '3'],
        );

        expect(
          calls[0].liveRounds,
        ).toEqual(
          ['17'],
        );
      },
    );


    test(
      'maps ordinary analytics observation to OBSERVAR',
      () => {
        const result =
          oracle().ingest(5);

        expect(
          result.oracleDecision,
        ).toBe('OBSERVAR');
      },
    );


    test(
      'does not promote weak signal to entry recommendation',
      () => {
        const result =
          oracle({
            recommendation:
              'PAPER_SINAL_FRACO',

            confidence:
              0.55,

            risk:
              0.45,

            ensemble:
              ensembleResult(
                'CONSENSUS_READY',
              ),
          }).ingest(5);

        expect(
          result.oracleDecision,
        ).toBe('WATCHLIST');

        expect(
          result.presentation.status,
        ).toBe('AGUARDAR');
      },
    );


    test(
      'strong analytics signal still observes without strategy consensus',
      () => {
        const result =
          oracle({
            recommendation:
              'PAPER_SINAL_FORTE',

            confidence:
              0.78,

            risk:
              0.22,

            ensemble:
              ensembleResult(
                'OBSERVE',
              ),

            target:
              candidateTarget(),
          }).ingest(5);

        expect(
          result.oracleDecision,
        ).toBe('OBSERVAR');

        expect(
          result.presentation.status,
        ).toBe('AGUARDAR');
      },
    );


    test(
      'requires target after strong analytics and strategy consensus',
      () => {
        const result =
          oracle({
            recommendation:
              'PAPER_SINAL_FORTE',

            confidence:
              0.78,

            risk:
              0.22,

            ensemble:
              ensembleResult(
                'CONSENSUS_READY',
              ),

            target:
              noTarget(),
          }).ingest(5);

        expect(
          result.oracleDecision,
        ).toBe(
          'PAPER_FAVORAVEL',
        );

        expect(
          result.target.status,
        ).toBe('NONE');

        expect(
          result.presentation.status,
        ).toBe('AGUARDAR');
      },
    );


    test(
      'presents PAPER favorable only with strong analytics consensus and target',
      () => {
        const result =
          oracle({
            recommendation:
              'PAPER_SINAL_FORTE',

            confidence:
              0.78,

            risk:
              0.22,

            ensemble:
              ensembleResult(
                'CONSENSUS_READY',
              ),

            target:
              candidateTarget(),
          }).ingest(5);

        expect(
          result.oracleDecision,
        ).toBe(
          'PAPER_FAVORAVEL',
        );

        expect(
          result.target.status,
        ).toBe(
          'CANDIDATE',
        );

        expect(
          result.presentation.status,
        ).toBe('FAVORAVEL');
      },
    );


    test(
      'strategy block overrides strong analytical signal',
      () => {
        const result =
          oracle({
            recommendation:
              'PAPER_SINAL_FORTE',

            confidence:
              0.82,

            risk:
              0.18,

            ensemble:
              ensembleResult(
                'BLOCKED',
              ),

            target:
              candidateTarget(),
          }).ingest(5);

        expect(
          result.oracleDecision,
        ).toBe(
          'BLOQUEADO',
        );

        expect(
          result.presentation.status,
        ).toBe(
          'BLOQUEADO',
        );

        expect(
          result.presentation.blockers.length,
        ).toBeGreaterThan(0);
      },
    );


    test(
      'accumulates live rounds incrementally',
      () => {
        const instance =
          oracle();

        instance.ingest(3);
        instance.ingest(4);

        expect(
          instance.snapshot()
            .liveRounds,
        ).toEqual([3, 4]);

        expect(
          instance.snapshot()
            .totalObservedRounds,
        ).toBe(5);
      },
    );


    test(
      'rejects roulette number outside zero through thirty six',
      () => {
        const instance =
          oracle();

        expect(
          () =>
            instance.ingest(37),
        ).toThrow(
          'paper_live_oracle_invalid_spin',
        );
      },
    );


    test(
      'preserves PAPER safety invariants',
      () => {
        const result =
          oracle().ingest(2);

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
