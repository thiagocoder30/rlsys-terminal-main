const {
  OperatorExplainabilityPresenter,
} = require(
  '../../../dist/application/runtime/OperatorExplainabilityPresenter.js'
);


function blockedQualification() {
  return {
    service:
      'WarmupQualificationRuntimePipeline',

    schemaVersion:
      '1.0.0',

    generatedAt:
      '2026-08-18T00:00:00.000Z',

    source:
      'manual',

    status:
      'BLOCKED',

    reason:
      'WARMUP_TABLE_NO_GO',

    operationalGate:
      'BLOCKED',

    extraction: {
      values:
        Array.from(
          {
            length:
              180,
          },
          (
            _,
            index,
          ) =>
            index %
            37,
        ),

      accepted:
        180,

      rejected:
        0,

      declaredTotal:
        180,

      confidence:
        0.93,

      warnings: [],

      reliability: {
        status:
          'ACCEPTED',

        score:
          0.93,

        issues: [],
      },
    },

    warmup: {
      engineVersion:
        'warmup-session-v1',

      sample: {
        received:
          180,

        used:
          180,

        warmupSize:
          200,

        completeness:
          0.90,
      },

      tableGate:
        'NO_GO',

      operationalGate:
        'BLOCKED',

      riskLabel:
        'MODERATE',

      metrics: {
        normalizedEntropy:
          0.98,

        thirdLawDeviation:
          0,

        maxNumberConcentration:
          0.056,

        uniqueNumbers:
          37,

        longestRepeatRun:
          2,

        zeroRatio:
          0.02,

        evenOddImbalance:
          0.01,

        lowHighImbalance:
          0.01,
      },

      sectors: [],

      blockers: [
        'WARMUP_INCOMPLETE_100_ROUNDS',
      ],

      recommendations: [],
    },

    confidenceScore:
      0.326,

    decision: {
      tableQualified:
        false,

      supervisedObservationAllowed:
        false,

      supervisedOperationAllowed:
        false,

      liveMoneyAllowed:
        false,

      productionMoneyAllowed:
        false,

      requiresHumanReview:
        true,
    },

    humanExplanation: [
      'Warm-up processou 180 rodadas válidas com confiança 0.93.',
      'Gate estatístico da mesa: NO_GO.',
      'Risco contextual: MODERATE.',
    ],
  };
}


describe(
  'OperatorExplainabilityPresenter formal language regression',
  () => {
    const presenter =
      new OperatorExplainabilityPresenter();


    test(
      'qualification HUD does not expose raw NO_GO or MODERATE in assessment',
      () => {
        const presentation =
          presenter.qualification(
            blockedQualification(),
          );

        const assessment =
          presentation.assessment.join(
            ' ',
          );

        expect(
          assessment,
        ).not.toContain(
          'NO_GO',
        );

        expect(
          assessment,
        ).not.toContain(
          'MODERATE',
        );

        expect(
          assessment,
        ).toContain(
          '90,0%',
        );

        expect(
          assessment,
        ).toContain(
          'moderado',
        );
      },
    );


    test(
      'qualification HUD labels confidence as qualification confidence',
      () => {
        const text =
          presenter
            .qualificationLines(
              blockedQualification(),
            )
            .join(
              '\n',
            );

        expect(
          text,
        ).toContain(
          'Confiança da qualificação',
        );

        expect(
          text,
        ).not.toContain(
          ' Confiança ..........',
        );
      },
    );


    test(
      'technical code remains available only in audit detail',
      () => {
        const text =
          presenter
            .qualificationLines(
              blockedQualification(),
            )
            .join(
              '\n',
            );

        expect(
          text,
        ).toContain(
          'Código técnico',
        );

        expect(
          text,
        ).toContain(
          'WARMUP_TABLE_NO_GO',
        );

        expect(
          text,
        ).not.toContain(
          'Gate estatístico da mesa: NO_GO',
        );

        expect(
          text,
        ).not.toContain(
          'Risco contextual: MODERATE',
        );
      },
    );
  },
);
