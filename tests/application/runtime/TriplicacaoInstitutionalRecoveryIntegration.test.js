const fs =
  require('node:fs');

const {
  TriplicacaoActionSemantics,
} = require(
  '../../../dist/application/runtime/TriplicacaoActionSemantics.js'
);

const {
  TriplicacaoProspectiveFormationCoordinator,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveFormationCoordinator.js'
);

const {
  TriplicacaoProspectiveRecorder,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveRecorder.js'
);

const {
  TriplicacaoProspectivePerformanceAnalyzer,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectivePerformanceAnalyzer.js'
);

const {
  TriplicacaoProspectiveSessionRuntime,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveSessionRuntime.js'
);

const {
  JsonTriplicacaoProspectiveSignalRepository,
} = require(
  '../../../dist/infrastructure/runtime/JsonTriplicacaoProspectiveSignalRepository.js'
);


const TEST_FILE =
  'data/test/triplicacao-recovery-integration.json';


function analysis(
  pattern = 'TC',
  risk = 0.19,
) {
  return {
    baseAnalysis: {},
    metrics: [],

    selectedPatternKind:
      pattern,

    advancedEvidenceScore:
      83,

    advancedConfidenceScore:
      0.81,

    advancedRiskScore:
      risk,

    probabilityMode:
      'PAPER_ONLY',

    liveMoneyAuthorized:
      false,

    reasons: [],
    warnings: [],
    blockers: [],
  };
}


function clock() {
  let value =
    1000;

  return {
    now() {
      value +=
        1000;

      return value;
    },
  };
}


function idFactory() {
  let sequence =
    0;

  return {
    next({
      sessionId,
    }) {
      sequence +=
        1;

      return `signal-${sessionId}-${sequence}`;
    },
  };
}


function createRuntime(
  overrides = {},
) {
  const repository =
    new JsonTriplicacaoProspectiveSignalRepository(
      TEST_FILE,
    );

  const recorder =
    new TriplicacaoProspectiveRecorder(
      repository,
      clock(),
      idFactory(),
    );

  return new TriplicacaoProspectiveSessionRuntime(
    'paper-test',

    new TriplicacaoProspectiveFormationCoordinator(
      new TriplicacaoActionSemantics(),
    ),

    recorder,

    new TriplicacaoProspectivePerformanceAnalyzer(),

    {
      initialBankroll:
        30,

      riskMode:
        'moderate',

      minimumStake:
        0.10,

      martingaleEnabled:
        true,

      ...overrides,
    },
  );
}


function spin(
  runtime,
  number,
  pattern = 'TC',
  risk = 0.19,
) {
  return runtime.ingest({
    sessionId:
      'paper-test',

    spin:
      number,

    analysis:
      analysis(
        pattern,
        risk,
      ),
  });
}


function followed(
  runtime,
) {
  return runtime.recordOperatorDecisionRaw({
    sessionId:
      'paper-test',

    raw:
      's',
  });
}


function ignored(
  runtime,
) {
  return runtime.recordOperatorDecisionRaw({
    sessionId:
      'paper-test',

    raw:
      'n',
  });
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
  'Triplicacao institutional recovery integration',
  () => {
    test(
      'martingale off never adds recovery component after loss',
      () => {
        const runtime =
          createRuntime({
            martingaleEnabled:
              false,
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(runtime, 1);
        spin(runtime, 3);
        followed(runtime);

        spin(
          runtime,
          2,
        );

        spin(runtime, 1);

        const next =
          spin(
            runtime,
            3,
          );

        expect(
          next.recommendation
            .baseStakeAmount,
        ).toBe(0.50);

        expect(
          next.recommendation
            .suggestedStake,
        ).toBe(0.50);

        expect(
          next.recommendation
            .recoveryComponent,
        ).toBe(0);
      },
    );


    test(
      'martingale on uses controlled recovery after followed loss',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(runtime, 1);
        spin(runtime, 3);
        followed(runtime);

        const loss =
          spin(
            runtime,
            2,
          );

        expect(
          loss.currentBankroll,
        ).toBe(29.40);

        expect(
          loss.pendingLossDebt,
        ).toBe(0.60);

        spin(runtime, 1);

        const recovery =
          spin(
            runtime,
            3,
          );

        expect(
          recovery.financialRecommendation
            .decision,
        ).toBe(
          'RECOVERY_STAKE',
        );

        expect(
          recovery.recommendation
            .baseStakeAmount,
        ).toBe(0.50);

        expect(
          recovery.recommendation
            .recoveryComponent,
        ).toBe(0.30);

        expect(
          recovery.recommendation
            .suggestedStake,
        ).toBe(0.80);
      },
    );


    test(
      'recovery composition survives persistence',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(runtime, 1);
        spin(runtime, 3);
        followed(runtime);
        spin(runtime, 2);

        spin(runtime, 1);

        const recovery =
          spin(
            runtime,
            3,
          );

        expect(
          recovery.recommendation
            .suggestedStake,
        ).toBe(
          recovery.recommendation
            .baseStakeAmount +
          recovery.recommendation
            .recoveryComponent,
        );
      },
    );


    test(
      'followed recovery win reduces debt only by recovery component',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(runtime, 1);
        spin(runtime, 3);
        followed(runtime);
        spin(runtime, 2);

        spin(runtime, 1);
        spin(runtime, 3);
        followed(runtime);

        const win =
          spin(
            runtime,
            5,
          );

        expect(
          win.financialSettlement
            .financialSettlement,
        ).toBe('WIN');

        expect(
          win.pendingLossDebt,
        ).toBe(0.30);
      },
    );


    test(
      'second followed loss increases debt',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(runtime, 1);
        spin(runtime, 3);
        followed(runtime);
        spin(runtime, 2);

        spin(runtime, 1);
        spin(runtime, 3);
        followed(runtime);

        const loss =
          spin(
            runtime,
            2,
          );

        expect(
          loss.currentBankroll,
        ).toBe(28.60);

        expect(
          loss.pendingLossDebt,
        ).toBe(1.40);
      },
    );


    test(
      'ignored recommendation never changes bankroll or debt',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(runtime, 1);
        spin(runtime, 3);
        ignored(runtime);

        const result =
          spin(
            runtime,
            2,
          );

        expect(
          result.currentBankroll,
        ).toBe(30);

        expect(
          result.pendingLossDebt,
        ).toBe(0);

        expect(
          result.financialSettlement
            .financialSettlement,
        ).toBe(
          'NO_EXPOSURE',
        );
      },
    );


    test(
      'followed zero remains strategy VOID and financial ZERO_LOSS',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(runtime, 1);
        spin(runtime, 3);
        followed(runtime);

        const result =
          spin(
            runtime,
            0,
          );

        expect(
          result.settledSignal
            .result,
        ).toBe('VOID');

        expect(
          result.financialSettlement
            .financialSettlement,
        ).toBe(
          'ZERO_LOSS',
        );

        expect(
          result.currentBankroll,
        ).toBe(29.40);

        expect(
          result.pendingLossDebt,
        ).toBe(0.60);
      },
    );


    test(
      'winning operation updates peak bankroll',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(runtime, 1);
        spin(runtime, 3);
        followed(runtime);

        const result =
          spin(
            runtime,
            5,
          );

        expect(
          result.currentBankroll,
        ).toBe(30.60);

        expect(
          result.peakBankroll,
        ).toBe(30.60);
      },
    );


    test(
      'snapshot exposes shared financial state',
      () => {
        const runtime =
          createRuntime();

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.currentBankroll,
        ).toBe(30);

        expect(
          snapshot.peakBankroll,
        ).toBe(30);

        expect(
          snapshot.pendingLossDebt,
        ).toBe(0);

        expect(
          snapshot.capitalDecision,
        ).toBe('ALLOW');

        expect(
          snapshot.martingaleEnabled,
        ).toBe(true);
      },
    );


    test(
      'small bankroll may block strategy exposure',
      () => {
        const runtime =
          createRuntime({
            initialBankroll:
              8,

            riskMode:
              'conservative',

            minimumStake:
              0.50,
          });

        runtime.confirmHistoryCurrent(
          's',
        );

        spin(runtime, 1);

        const result =
          spin(
            runtime,
            3,
          );

        expect(
          result.event,
        ).toBe(
          'STAKE_BLOCKED',
        );

        expect(
          result.recommendation,
        ).toBeNull();
      },
    );


    test(
      'catch-up remains outside prospective and financial accounting',
      () => {
        const runtime =
          createRuntime();

        runtime.confirmHistoryCurrent(
          'n',
        );

        runtime.recordCatchUpSpin(
          17,
        );

        runtime.recordCatchUpSpin(
          32,
        );

        const snapshot =
          runtime.snapshot();

        expect(
          snapshot.currentBankroll,
        ).toBe(30);

        expect(
          snapshot.pendingLossDebt,
        ).toBe(0);

        expect(
          snapshot.totalRecordedSignals,
        ).toBe(0);
      },
    );


    test(
      'runtime exposes no automatic bet API',
      () => {
        const runtime =
          createRuntime();

        expect(
          runtime.snapshot()
            .recommendationOnly,
        ).toBe(true);

        expect(
          runtime.snapshot()
            .humanExecutionRequired,
        ).toBe(true);

        expect(
          runtime.snapshot()
            .automaticBetExecutionAllowed,
        ).toBe(false);

        expect(
          typeof runtime.execute,
        ).toBe('undefined');

        expect(
          typeof runtime.placeBet,
        ).toBe('undefined');

        expect(
          typeof runtime.autoBet,
        ).toBe('undefined');
      },
    );
  },
);
