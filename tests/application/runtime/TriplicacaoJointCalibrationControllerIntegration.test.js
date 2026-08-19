const fs =
  require('node:fs');

const {
  TriplicacaoLiveTerminalController,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveTerminalController.js'
);


const TEST_FILE =
  'data/test/triplicacao-joint-calibration-controller.json';


function analysis() {
  return {
    baseAnalysis: {
      dominantPatternKind:
        'TC',

      dominantFrequencyScore:
        30,

      confidenceScore:
        0.33,

      riskScore:
        0.60,

      operationalMode:
        'OBSERVE',
    },

    metrics:
      [],

    selectedPatternKind:
      'TC',

    advancedEvidenceScore:
      36,

    advancedConfidenceScore:
      0.34,

    advancedRiskScore:
      0.54,

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
        'joint-calibration-controller',

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

    {
      analyze() {
        return analysis();
      },
    },
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
  'Triplicacao joint calibration controller integration',
  () => {
    test(
      'joint calibration snapshot is read-only',
      () => {
        const runtime =
          controller();

        const before =
          runtime.snapshot();

        const report =
          runtime.jointCalibrationSnapshot();

        const after =
          runtime.snapshot();

        expect(
          report.totalLiveEvents,
        ).toBe(
          0,
        );

        expect(
          after,
        ).toEqual(
          before,
        );
      },
    );


    test(
      'joint calibration consumes LIVE diagnostics',
      () => {
        const runtime =
          controller();

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
          runtime.jointCalibrationSnapshot();

        expect(
          report.totalLiveEvents,
        ).toBe(
          3,
        );

        expect(
          report.scenarios.map(
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
      'joint calibration preserves manual-only invariants',
      () => {
        const report =
          controller()
            .jointCalibrationSnapshot();

        expect(
          report.officialPolicyPreserved,
        ).toBe(
          true,
        );

        expect(
          report.counterfactualOnly,
        ).toBe(
          true,
        );

        expect(
          report.bankrollMutationAllowed,
        ).toBe(
          false,
        );

        expect(
          report.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );
  },
);
