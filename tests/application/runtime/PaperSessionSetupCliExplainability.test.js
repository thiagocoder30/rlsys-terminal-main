const {
  PaperSessionSetupCli,
} = require(
  '../../../dist/presentation/cli/PaperSessionSetupCli.js'
);


function qualificationReport(
  status,
) {
  return {
    qualified:
      status === 'QUALIFIED',

    observationAllowed:
      status !== 'BLOCKED',

    synchronizedRounds:
      180,

    syncVersion:
      1,

    qualification: {
      service:
        'WarmupQualificationRuntimePipeline',

      schemaVersion:
        '1.0.0',

      generatedAt:
        '2026-08-18T00:00:00.000Z',

      source:
        'manual',

      status,

      reason:
        status === 'QUALIFIED'
          ? 'WARMUP_TABLE_QUALIFIED'
          : status === 'OBSERVE'
            ? 'WARMUP_TABLE_OBSERVE'
            : 'WARMUP_TABLE_NO_GO',

      operationalGate:
        status === 'QUALIFIED'
          ? 'ALLOW'
          : 'BLOCKED',

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
            180,

          used:
            180,

          warmupSize:
            200,

          completeness:
            0.90,
        },

        tableGate:
          status === 'QUALIFIED'
            ? 'GO_RESEARCH'
            : 'NO_GO',

        operationalGate:
          status === 'QUALIFIED'
            ? 'ALLOW'
            : 'BLOCKED',

        riskLabel:
          status === 'QUALIFIED'
            ? 'LOW'
            : 'HIGH',

        metrics: {
          normalizedEntropy:
            0.97,

          thirdLawDeviation:
            0.08,

          maxNumberConcentration:
            0.06,

          uniqueNumbers:
            37,

          longestRepeatRun:
            2,

          zeroRatio:
            0.03,

          evenOddImbalance:
            0.02,

          lowHighImbalance:
            0.01,
        },

        sectors: [],

        blockers:
          status === 'QUALIFIED'
            ? []
            : [
                'WARMUP_INCOMPLETE_100_ROUNDS',
              ],

        recommendations: [],
      },

      confidenceScore:
        status === 'QUALIFIED'
          ? 0.88
          : 0.326,

      decision: {
        tableQualified:
          status === 'QUALIFIED',

        supervisedObservationAllowed:
          status !== 'BLOCKED',

        supervisedOperationAllowed:
          status === 'QUALIFIED',

        liveMoneyAllowed:
          false,

        productionMoneyAllowed:
          false,

        requiresHumanReview:
          true,
      },

      humanExplanation: [
        'Warm-up processou 180 rodadas válidas.',
        status === 'QUALIFIED'
          ? 'Gate estatístico da mesa: GO_RESEARCH.'
          : 'Gate estatístico da mesa: NO_GO.',
        status === 'QUALIFIED'
          ? 'Risco contextual: LOW.'
          : 'Risco contextual: HIGH.',
      ],
    },

    paperOnly:
      true,

    liveMoneyAuthorization:
      false,

    automaticExecutionAllowed:
      false,

    humanSupervisionRequired:
      true,
  };
}


function coordinator(
  status,
) {
  let configured =
    false;

  let history =
    {
      status:
        'UNSYNCED',

      rounds: [],

      roundCount:
        0,

      syncVersion:
        0,
    };

  let qualification =
    null;

  return {
    configure() {
      configured =
        true;

      return {
        sessionId:
          'paper-test',

        bankroll:
          40,

        provider:
          'PRAGMATIC',

        minimumChipValue:
          0.10,

        riskMode:
          'AGGRESSIVE',

        allowMartingale:
          true,

        status:
          'CONFIGURED',
      };
    },

    sync(
      rawHistory,
    ) {
      const rounds =
        rawHistory
          .trim()
          .split(/\s+/)
          .map(Number);

      history = {
        status:
          'SYNCED',

        rounds,

        roundCount:
          rounds.length,

        syncVersion:
          1,
      };

      return {
        parsed: {
          accepted:
            true,

          rounds,

          invalidTokens: [],

          message:
            'Histórico aceito.',
        },

        history,
      };
    },

    resync(
      rawHistory,
    ) {
      return this.sync(
        rawHistory,
      );
    },

    qualify() {
      qualification =
        qualificationReport(
          status,
        );

      return {
        qualification,
        bootstrapInput: {},
      };
    },

    snapshot() {
      return {
        status:
          qualification
            ? status
            : configured
              ? (
                  history.status ===
                    'UNSYNCED'
                    ? 'CONFIGURED'
                    : 'SYNCHRONIZED'
                )
              : 'PENDING_CONFIGURATION',

        configuration:
          configured
            ? {
                sessionId:
                  'paper-test',

                bankroll:
                  40,

                provider:
                  'PRAGMATIC',

                minimumChipValue:
                  0.10,

                riskMode:
                  'AGGRESSIVE',

                allowMartingale:
                  true,

                status:
                  'CONFIGURED',
              }
            : null,

        history,

        qualification,
      };
    },
  };
}


function runAutomaticQualification(
  status,
) {
  const output =
    [];

  const cli =
    new PaperSessionSetupCli(
      coordinator(
        status,
      ),

      {
        writeLine(
          message,
        ) {
          output.push(
            message,
          );
        },
      },

      {
        defaultWarmupSize:
          200,
      },
    );

  cli.step(
    'configure 40 pragmatic aggressive on Thiago',
  );

  cli.step(
    'sync',
  );

  cli.step(
    '1 2 3 4 5',
  );

  const result =
    cli.step(
      '',
    );

  return {
    result,
    output,
  };
}


describe(
  'PaperSessionSetupCli operator explainability',
  () => {
    test(
      'rejected table uses formal user-facing explanation',
      () => {
        const {
          result,
        } =
          runAutomaticQualification(
            'BLOCKED',
          );

        expect(
          result.message,
        ).toContain(
          'RL.SYS — AVALIAÇÃO DA MESA',
        );

        expect(
          result.message,
        ).toContain(
          'Status .................... NÃO QUALIFICADA',
        );

        expect(
          result.message,
        ).toContain(
          'Confiança da qualificação . 32,6%',
        );

        expect(
          result.message,
        ).toContain(
          'Risco contextual .......... ELEVADO',
        );

        expect(
          result.message,
        ).toContain(
          'Entropia normalizada: 97,0%.',
        );

        expect(
          result.message,
        ).toContain(
          'Código técnico ............. WARMUP_TABLE_NO_GO',
        );

        expect(
          result.message,
        ).not.toContain(
          'Motivo .............. WARMUP_TABLE_NO_GO',
        );

        expect(
          result.message,
        ).not.toContain(
          'Gate estatístico da mesa: NO_GO',
        );

        expect(
          result.message,
        ).not.toContain(
          'Risco contextual: HIGH',
        );
      },
    );


    test(
      'qualified table uses same formal presentation boundary',
      () => {
        const {
          result,
        } =
          runAutomaticQualification(
            'QUALIFIED',
          );

        expect(
          result.message,
        ).toContain(
          'Status .................... QUALIFICADA',
        );

        expect(
          result.message,
        ).toContain(
          'Confiança da qualificação . 88,0%',
        );

        expect(
          result.message,
        ).toContain(
          'Risco contextual .......... BAIXO',
        );

        expect(
          result.message,
        ).toContain(
          'Código técnico ............. WARMUP_TABLE_QUALIFIED',
        );
      },
    );


    test(
      'formal language never changes automatic qualification decision',
      () => {
        const rejected =
          runAutomaticQualification(
            'BLOCKED',
          );

        const approved =
          runAutomaticQualification(
            'QUALIFIED',
          );

        expect(
          rejected.result
            .automaticQualification
            .decision,
        ).toBe(
          'REJECTED',
        );

        expect(
          approved.result
            .automaticQualification
            .decision,
        ).toBe(
          'APPROVED',
        );
      },
    );
  },
);
