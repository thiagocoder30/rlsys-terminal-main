const {
  OperatorExplainabilityPresenter,
} = require(
  '../../../dist/application/runtime/OperatorExplainabilityPresenter.js'
);


function qualificationReport({
  accepted,
  used,
  warmupSize,
  completeness,
  status,
  reason,
  confidenceScore,
  riskLabel,
}) {
  return {
    service:
      'WarmupQualificationRuntimePipeline',

    schemaVersion:
      '1.0.0',

    generatedAt:
      '2026-08-18T00:00:00.000Z',

    source:
      'manual',

    status,

    reason,

    operationalGate:
      status ===
      'QUALIFIED'
        ? 'ALLOW'
        : 'BLOCKED',

    extraction: {
      values:
        Array.from(
          {
            length:
              accepted,
          },

          (
            _,
            index,
          ) =>
            index %
            37,
        ),

      accepted,

      rejected:
        0,

      declaredTotal:
        accepted,

      confidence:
        1,

      warnings: [],

      reliability: {
        status:
          'ACCEPTED',

        score:
          1,

        issues: [],
      },
    },

    warmup: {
      engineVersion:
        'warmup-session-v1',

      sample: {
        received:
          accepted,

        used,

        warmupSize,

        completeness,
      },

      tableGate:
        status ===
        'QUALIFIED'
          ? 'GO_RESEARCH'
          : 'NO_GO',

      operationalGate:
        status ===
        'QUALIFIED'
          ? 'ALLOW'
          : 'BLOCKED',

      riskLabel,

      metrics: {
        normalizedEntropy:
          0.98,

        thirdLawDeviation:
          0,

        maxNumberConcentration:
          0.06,

        uniqueNumbers:
          37,

        longestRepeatRun:
          2,

        zeroRatio:
          0.03,

        evenOddImbalance:
          0.01,

        lowHighImbalance:
          0.01,
      },

      sectors: [],

      blockers:
        status ===
        'QUALIFIED'
          ? []
          : [
              'WARMUP_INCOMPLETE_100_ROUNDS',
            ],

      recommendations: [],
    },

    confidenceScore,

    decision: {
      tableQualified:
        status ===
        'QUALIFIED',

      supervisedObservationAllowed:
        status !==
        'BLOCKED',

      supervisedOperationAllowed:
        status ===
        'QUALIFIED',

      liveMoneyAllowed:
        false,

      productionMoneyAllowed:
        false,

      requiresHumanReview:
        true,
    },

    humanExplanation: [],
  };
}


describe(
  'Operator qualification window HUD regression',
  () => {
    const presenter =
      new OperatorExplainabilityPresenter();


    test(
      '240 synchronized rounds explicitly show latest 200 qualification window',
      () => {
        const text =
          presenter
            .qualificationLines(
              qualificationReport({
                accepted:
                  240,

                used:
                  200,

                warmupSize:
                  200,

                completeness:
                  1,

                status:
                  'QUALIFIED',

                reason:
                  'WARMUP_TABLE_QUALIFIED',

                confidenceScore:
                  1,

                riskLabel:
                  'LOW',
              }),
            )
            .join(
              '\n',
            );

        expect(
          text,
        ).toContain(
          'Histórico sincronizado .... 240 giros',
        );

        expect(
          text,
        ).toContain(
          'Janela de qualificação .... 200 giros mais recentes',
        );

        expect(
          text,
        ).toContain(
          'Completude da janela ...... 100,0%',
        );

        expect(
          text,
        ).not.toContain(
          'Rodadas analisadas ........ 240',
        );
      },
    );


    test(
      '180 synchronized rounds explicitly show incomplete 180 of 200 window',
      () => {
        const text =
          presenter
            .qualificationLines(
              qualificationReport({
                accepted:
                  180,

                used:
                  180,

                warmupSize:
                  200,

                completeness:
                  0.9,

                status:
                  'BLOCKED',

                reason:
                  'WARMUP_TABLE_NO_GO',

                confidenceScore:
                  0.326,

                riskLabel:
                  'MODERATE',
              }),
            )
            .join(
              '\n',
            );

        expect(
          text,
        ).toContain(
          'Histórico sincronizado .... 180 giros',
        );

        expect(
          text,
        ).toContain(
          'Janela de qualificação .... 180 giros mais recentes',
        );

        expect(
          text,
        ).toContain(
          'Completude da janela ...... 90,0%',
        );
      },
    );


    test(
      'qualification HUD still distinguishes confidence from sample completeness',
      () => {
        const text =
          presenter
            .qualificationLines(
              qualificationReport({
                accepted:
                  180,

                used:
                  180,

                warmupSize:
                  200,

                completeness:
                  0.9,

                status:
                  'BLOCKED',

                reason:
                  'WARMUP_TABLE_NO_GO',

                confidenceScore:
                  0.326,

                riskLabel:
                  'MODERATE',
              }),
            )
            .join(
              '\n',
            );

        expect(
          text,
        ).toContain(
          'Completude da janela ...... 90,0%',
        );

        expect(
          text,
        ).toContain(
          'Confiança da qualificação . 32,6%',
        );

        expect(
          text,
        ).not.toContain(
          'Confiança da qualificação . 90,0%',
        );
      },
    );
  },
);
