const fs =
  require('node:fs');

const {
  TriplicacaoLiveTerminalController,
} = require(
  '../../../dist/application/runtime/TriplicacaoLiveTerminalController.js'
);


const TEST_FILE =
  'data/test/triplicacao-calibration-controller.json';


function analysis() {
  return {
    baseAnalysis: {
      dominantPatternKind:
        'TC',

      dominantFrequencyScore:
        35,

      confidenceScore:
        0.40,

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
      0.45,

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

    blockers: [
      'TRIPLICACAO_ADVANCED_EVIDENCIA_INSUFICIENTE',
    ],
  };
}


function controller() {
  return new TriplicacaoLiveTerminalController(
    {
      sessionId:
        'calibration-controller-test',

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
  'Triplicacao calibration controller integration',
  () => {
    test(
      'calibration is available before LIVE without mutating state',
      () => {
        const runtime =
          controller();

        const before =
          runtime.snapshot();

        const calibration =
          runtime.calibrationSnapshot();

        const after =
          runtime.snapshot();

        expect(
          calibration.totalLiveEvents,
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
      'calibration consumes accepted diagnostic events',
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

        const calibration =
          runtime.calibrationSnapshot();

        expect(
          calibration.totalLiveEvents,
        ).toBe(
          3,
        );

        expect(
          calibration.decisionApplicableEvents,
        ).toBeGreaterThan(
          0,
        );

        expect(
          calibration.scenarios.map(
            (scenario) =>
              scenario.policy.id,
          ),
        ).toEqual([
          'OFFICIAL',
          'D50_ONLY',
          'D45_ONLY',
          'D42_ONLY',
        ]);
      },
    );


    test(
      'calibration does not mutate bankroll or runtime state',
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

        const before =
          runtime.snapshot();

        runtime.calibrationSnapshot();
        runtime.calibrationSnapshot();

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
      'calibration remains counterfactual and manual-only',
      () => {
        const calibration =
          controller()
            .calibrationSnapshot();

        expect(
          calibration.officialPolicyPreserved,
        ).toBe(
          true,
        );

        expect(
          calibration.counterfactualOnly,
        ).toBe(
          true,
        );

        expect(
          calibration.bankrollMutationAllowed,
        ).toBe(
          false,
        );

        expect(
          calibration.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );
      },
    );
  },
);
