const fs =
  require('node:fs');

const {
  TriplicacaoLiveTerminalController,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveTerminalController.js'
);

const {
  isTriplicacaoCounterfactualDecisionPoint,
} = require(
  '../../../dist/application/runtime/TriplicacaoCounterfactualDecisionPoint.js'
);


const TEST_FILE =
  'data/test/triplicacao-zero-formation-integrity.json';


function analysis() {
  return {
    baseAnalysis: {
      dominantPatternKind:
        'TC',

      dominantFrequencyScore:
        40,

      confidenceScore:
        0.50,

      riskScore:
        0.50,

      operationalMode:
        'OBSERVE',
    },

    metrics:
      [],

    selectedPatternKind:
      'TC',

    advancedEvidenceScore:
      50,

    advancedConfidenceScore:
      0.50,

    advancedRiskScore:
      0.45,

    probabilityMode:
      'OBSERVE',

    liveMoneyAuthorized:
      false,

    reasons:
      [],

    warnings:
      [],

    blockers:
      [],
  };
}


function controller() {
  return new TriplicacaoLiveTerminalController(
    {
      sessionId:
        'zero-integrity-regression',

      synchronizedHistory: [
        1,
        3,
        5,
      ],

      bankroll:
        30,

      riskMode:
        'moderate',

      minimumStake:
        0.10,

      martingaleEnabled:
        false,

      signalRepositoryPath:
        TEST_FILE,
    },

    {
      analyze() {
        return analysis();
      },
    },
  );
}


function enterLive(
  runtime,
) {
  runtime.confirmHistoryCurrent(
    's',
  );

  expect(
    runtime.snapshot().mode,
  ).toBe(
    'LIVE',
  );
}


beforeEach(
  () => {
    fs.rmSync(
      TEST_FILE,
      {
        force:
          true,
      },
    );

    fs.rmSync(
      `${TEST_FILE}.tmp`,
      {
        force:
          true,
      },
    );
  },
);


afterAll(
  () => {
    fs.rmSync(
      TEST_FILE,
      {
        force:
          true,
      },
    );

    fs.rmSync(
      `${TEST_FILE}.tmp`,
      {
        force:
          true,
      },
    );
  },
);


describe(
  'Triplicacao zero formation integrity regression',
  () => {
    test(
      '0 17 24 is one discarded trio and 8 starts the next trio',
      () => {
        const runtime =
          controller();

        enterLive(
          runtime,
        );

        const first =
          runtime.ingestLiveSpin(
            0,
          );

        expect(
          first.runtime
            .formationState,
        ).toBe(
          'WAITING_SECOND',
        );

        expect(
          first.runtime
            .formation
            .trioDiscarded,
        ).toBe(
          false,
        );

        const second =
          runtime.ingestLiveSpin(
            17,
          );

        expect(
          second.runtime
            .formationState,
        ).toBe(
          'WAITING_THIRD',
        );

        expect(
          second.runtime
            .formation
            .action,
        ).toBeNull();

        const third =
          runtime.ingestLiveSpin(
            24,
          );

        expect(
          third.runtime
            .event,
        ).toBe(
          'TRIO_VOID',
        );

        expect(
          third.runtime
            .formation
            .trioDiscarded,
        ).toBe(
          true,
        );

        expect(
          third.runtime
            .formation
            .firstNumber,
        ).toBe(
          0,
        );

        expect(
          third.runtime
            .formation
            .secondNumber,
        ).toBe(
          17,
        );

        expect(
          third.runtime
            .formation
            .spin,
        ).toBe(
          24,
        );

        const next =
          runtime.ingestLiveSpin(
            8,
          );

        expect(
          next.runtime
            .formation
            .stateBefore,
        ).toBe(
          'WAITING_FIRST',
        );

        expect(
          next.runtime
            .formation
            .firstNumber,
        ).toBe(
          8,
        );
      },
    );


    test(
      '11 0 27 is one discarded trio and cannot create recommendation',
      () => {
        const runtime =
          controller();

        enterLive(
          runtime,
        );

        runtime.ingestLiveSpin(
          11,
        );

        const second =
          runtime.ingestLiveSpin(
            0,
          );

        expect(
          second.runtime
            .formationState,
        ).toBe(
          'WAITING_THIRD',
        );

        expect(
          second.runtime
            .recommendation,
        ).toBeNull();

        expect(
          second.runtime
            .pendingSignalId,
        ).toBeNull();

        const third =
          runtime.ingestLiveSpin(
            27,
          );

        expect(
          third.runtime.event,
        ).toBe(
          'TRIO_VOID',
        );

        expect(
          third.runtime
            .recommendation,
        ).toBeNull();

        expect(
          third.runtime
            .settledSignal,
        ).toBeNull();
      },
    );


    test(
      '11 20 0 is discarded at the natural third-position boundary',
      () => {
        const runtime =
          controller();

        enterLive(
          runtime,
        );

        runtime.ingestLiveSpin(
          11,
        );

        runtime.ingestLiveSpin(
          20,
        );

        const third =
          runtime.ingestLiveSpin(
            0,
          );

        expect(
          third.runtime
            .formation
            .trioDiscarded,
        ).toBe(
          true,
        );

        expect(
          third.runtime
            .formationState,
        ).toBe(
          'WAITING_FIRST',
        );
      },
    );


    test(
      'opening pair containing zero is never a counterfactual decision point',
      () => {
        expect(
          isTriplicacaoCounterfactualDecisionPoint({
            liveSpinIndex:
              2,

            spin:
              17,

            sessionEvent:
              'NO_RECOMMENDATION',

            formationState:
              'WAITING_THIRD',

            firstNumber:
              0,

            secondNumber:
              17,

            trioCompleted:
              false,

            trioDiscarded:
              false,

            trioNumbers:
              null,

            actualPatternKind:
              null,

            actionStatus:
              null,

            selectedPatternKind:
              'TC',

            probabilityMode:
              'OBSERVE',

            advancedEvidenceScore:
              50,

            advancedConfidenceScore:
              0.50,

            advancedRiskScore:
              0.45,

            baseOperationalMode:
              'OBSERVE',

            baseDominantPattern:
              'TC',

            baseDominantFrequencyScore:
              40,

            baseConfidenceScore:
              0.50,

            baseRiskScore:
              0.50,

            gateSummary: {
              total:
                8,

              passed:
                1,

              failed:
                7,

              allPassed:
                false,

              evaluations:
                [],
            },

            rationale:
              null,

            reasons:
              [],

            warnings:
              [],

            blockers:
              [],

            recommendationIssued:
              false,
          }),
        ).toBe(
          false,
        );


        expect(
          isTriplicacaoCounterfactualDecisionPoint({
            liveSpinIndex:
              2,

            spin:
              0,

            sessionEvent:
              'NO_RECOMMENDATION',

            formationState:
              'WAITING_THIRD',

            firstNumber:
              11,

            secondNumber:
              0,

            trioCompleted:
              false,

            trioDiscarded:
              false,

            trioNumbers:
              null,

            actualPatternKind:
              null,

            actionStatus:
              null,

            selectedPatternKind:
              'TC',

            probabilityMode:
              'OBSERVE',

            advancedEvidenceScore:
              50,

            advancedConfidenceScore:
              0.50,

            advancedRiskScore:
              0.45,

            baseOperationalMode:
              'OBSERVE',

            baseDominantPattern:
              'TC',

            baseDominantFrequencyScore:
              40,

            baseConfidenceScore:
              0.50,

            baseRiskScore:
              0.50,

            gateSummary: {
              total:
                8,

              passed:
                1,

              failed:
                7,

              allPassed:
                false,

              evaluations:
                [],
            },

            rationale:
              null,

            reasons:
              [],

            warnings:
              [],

            blockers:
              [],

            recommendationIssued:
              false,
          }),
        ).toBe(
          false,
        );
      },
    );


    test(
      'zero-first fixed trio contributes zero decision points to calibration',
      () => {
        const runtime =
          controller();

        enterLive(
          runtime,
        );

        runtime.ingestLiveSpin(
          0,
        );

        runtime.ingestLiveSpin(
          17,
        );

        runtime.ingestLiveSpin(
          24,
        );

        const calibration =
          runtime
            .jointCalibrationSnapshot();

        expect(
          calibration
            .decisionApplicableEvents,
        ).toBe(
          0,
        );

        const settlement =
          runtime
            .counterfactualSettlementSnapshot();

        expect(
          settlement
            .decisionApplicableEvents,
        ).toBe(
          0,
        );
      },
    );


    test(
      'zero-second fixed trio contributes zero decision points to calibration',
      () => {
        const runtime =
          controller();

        enterLive(
          runtime,
        );

        runtime.ingestLiveSpin(
          11,
        );

        runtime.ingestLiveSpin(
          0,
        );

        runtime.ingestLiveSpin(
          27,
        );

        const calibration =
          runtime
            .jointCalibrationSnapshot();

        expect(
          calibration
            .decisionApplicableEvents,
        ).toBe(
          0,
        );

        const settlement =
          runtime
            .counterfactualSettlementSnapshot();

        expect(
          settlement
            .decisionApplicableEvents,
        ).toBe(
          0,
        );
      },
    );


    test(
      'stats count one discarded trio rather than shifting the LIVE grouping',
      () => {
        const runtime =
          controller();

        enterLive(
          runtime,
        );

        runtime.ingestLiveSpin(
          0,
        );

        runtime.ingestLiveSpin(
          17,
        );

        runtime.ingestLiveSpin(
          24,
        );

        runtime.ingestLiveSpin(
          1,
        );

        runtime.ingestLiveSpin(
          3,
        );

        runtime.ingestLiveSpin(
          5,
        );

        const stats =
          runtime.statsSnapshot(
            12,
          );

        expect(
          stats.liveDiscardedTrios,
        ).toBe(
          1,
        );

        expect(
          stats.liveCompletedTrios,
        ).toBe(
          1,
        );

        expect(
          stats.live.zeroDiscarded,
        ).toBe(
          1,
        );

        expect(
          stats.live.tc,
        ).toBe(
          1,
        );
      },
    );


    test(
      'zero integrity never adds automatic execution authority',
      () => {
        const runtime =
          controller();

        expect(
          runtime.snapshot()
            .automaticBetExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          runtime.placeBet,
        ).toBeUndefined();

        expect(
          runtime.executeBet,
        ).toBeUndefined();
      },
    );
  },
);
