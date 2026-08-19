const fs =
  require('node:fs');

const {
  TriplicacaoLiveTerminalController,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveTerminalController.js'
);


const TEST_FILE =
  'data/test/triplicacao-cf-settlement-controller.json';


function fakeProbabilityEngine() {
  return {
    analyze() {
      return {
        baseAnalysis: {
          dominantPatternKind:
            'TC',

          dominantFrequencyScore:
            35,

          confidenceScore:
            0.40,

          riskScore:
            0.55,

          operationalMode:
            'OBSERVE',
        },

        metrics:
          [],

        selectedPatternKind:
          'TC',

        advancedEvidenceScore:
          45,

        advancedConfidenceScore:
          0.42,

        advancedRiskScore:
          0.50,

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
    },
  };
}


function settlementSpy() {
  return {
    calls:
      [],

    analyze(input) {
      this.calls.push(
        input,
      );

      return Object.freeze({
        totalLiveEvents:
          input.events.length,

        decisionApplicableEvents:
          0,

        scenarios:
          Object.freeze([]),

        officialPolicyPreserved:
          true,

        counterfactualOnly:
          true,

        recommendationOnly:
          true,

        bankrollMutationAllowed:
          false,

        automaticBetExecutionAllowed:
          false,
      });
    },
  };
}


function controller(
  settlement,
) {
  return new TriplicacaoLiveTerminalController(
    {
      sessionId:
        'counterfactual-settlement-controller',

      synchronizedHistory: [
        7,
        32,
        18,
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

    fakeProbabilityEngine(),

    undefined,

    undefined,

    undefined,

    settlement,
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


describe(
  'Triplicacao counterfactual settlement controller integration',
  () => {
    test(
      'snapshot delegates LIVE diagnostic history to settlement engine',
      () => {
        const settlement =
          settlementSpy();

        const runtime =
          controller(
            settlement,
          );

        runtime.confirmHistoryCurrent(
          's',
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

        const report =
          runtime
            .counterfactualSettlementSnapshot();

        expect(
          settlement.calls,
        ).toHaveLength(
          1,
        );

        expect(
          settlement.calls[0]
            .events,
        ).toHaveLength(
          3,
        );

        expect(
          report.totalLiveEvents,
        ).toBe(
          3,
        );
      },
    );


    test(
      'controller supplies joint calibration to settlement',
      () => {
        const settlement =
          settlementSpy();

        const runtime =
          controller(
            settlement,
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          1,
        );

        runtime.ingestLiveSpin(
          3,
        );

        runtime.counterfactualSettlementSnapshot();

        expect(
          settlement.calls[0]
            .calibration,
        ).toBeDefined();

        expect(
          settlement.calls[0]
            .calibration
            .scenarios
            .map(
              (scenario) =>
                scenario.policy.id,
            ),
        ).toEqual([
          'OFFICIAL',
          'P25_PERMISSIVE',
          'P50_BALANCED',
          'EMPIRICAL_STEP',
          'P75_SELECTIVE',
        ]);
      },
    );


    test(
      'settlement snapshot does not mutate runtime or bankroll',
      () => {
        const settlement =
          settlementSpy();

        const runtime =
          controller(
            settlement,
          );

        runtime.confirmHistoryCurrent(
          's',
        );

        runtime.ingestLiveSpin(
          1,
        );

        const before =
          runtime.snapshot();

        runtime.counterfactualSettlementSnapshot();
        runtime.counterfactualSettlementSnapshot();

        const after =
          runtime.snapshot();

        expect(
          after,
        ).toEqual(
          before,
        );
      },
    );


    test(
      'settlement snapshot preserves manual-only invariants',
      () => {
        const settlement =
          settlementSpy();

        const result =
          controller(
            settlement,
          )
            .counterfactualSettlementSnapshot();

        expect(
          result.counterfactualOnly,
        ).toBe(
          true,
        );

        expect(
          result.bankrollMutationAllowed,
        ).toBe(
          false,
        );

        expect(
          result.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );
  },
);
