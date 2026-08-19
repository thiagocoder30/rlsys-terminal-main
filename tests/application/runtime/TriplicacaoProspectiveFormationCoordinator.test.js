const {
  TriplicacaoProspectiveFormationCoordinator,
} = require(
  '../../../dist/application/runtime/TriplicacaoProspectiveFormationCoordinator.js'
);


function analysis(
  pattern,
  overrides = {},
) {
  return {
    baseAnalysis: {},

    metrics: [],

    selectedPatternKind:
      pattern,

    advancedEvidenceScore:
      80,

    advancedConfidenceScore:
      0.78,

    advancedRiskScore:
      0.22,

    probabilityMode:
      'PAPER_ONLY',

    liveMoneyAuthorized:
      false,

    reasons: [],

    warnings: [],

    blockers: [],

    ...overrides,
  };
}


function ingest(
  coordinator,
  spin,
  pattern = 'TC',
) {
  return coordinator.ingest({
    spin,

    analysis:
      analysis(
        pattern,
      ),
  });
}


describe(
  'TriplicacaoProspectiveFormationCoordinator',
  () => {
    test(
      'advances through first and second positions before waiting for settlement',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        const first =
          ingest(
            coordinator,
            1,
          );

        expect(
          first.stateBefore,
        ).toBe(
          'WAITING_FIRST',
        );

        expect(
          first.stateAfter,
        ).toBe(
          'WAITING_SECOND',
        );

        const second =
          ingest(
            coordinator,
            3,
          );

        expect(
          second.stateBefore,
        ).toBe(
          'WAITING_SECOND',
        );

        expect(
          second.stateAfter,
        ).toBe(
          'WAITING_THIRD',
        );

        expect(
          second.action.status,
        ).toBe(
          'ACTION',
        );

        expect(
          second.action.targetColor,
        ).toBe(
          'RED',
        );
      },
    );


    test(
      'settles WIN when third color matches target',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          1,
        );

        ingest(
          coordinator,
          3,
        );

        const result =
          ingest(
            coordinator,
            5,
          );

        expect(
          result.trioCompleted,
        ).toBe(
          true,
        );

        expect(
          result.settlement,
        ).toBe(
          'WIN',
        );

        expect(
          result.settledTargetColor,
        ).toBe(
          'RED',
        );

        expect(
          result.settledSpinColor,
        ).toBe(
          'RED',
        );

        expect(
          result.stateAfter,
        ).toBe(
          'WAITING_FIRST',
        );
      },
    );


    test(
      'settles LOSS when third color misses target',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          1,
        );

        ingest(
          coordinator,
          3,
        );

        const result =
          ingest(
            coordinator,
            2,
          );

        expect(
          result.settlement,
        ).toBe(
          'LOSS',
        );

        expect(
          result.settledTargetColor,
        ).toBe(
          'RED',
        );

        expect(
          result.settledSpinColor,
        ).toBe(
          'BLACK',
        );
      },
    );


    test(
      'does not create settlement when opening pair produced NO_ACTION',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          1,
        );

        const second =
          ingest(
            coordinator,
            2,
          );

        expect(
          second.action.status,
        ).toBe(
          'NO_ACTION',
        );

        const third =
          ingest(
            coordinator,
            5,
          );

        expect(
          third.settlement,
        ).toBeNull();

        expect(
          third.trioCompleted,
        ).toBe(
          true,
        );
      },
    );


    test(
      'zero at first position invalidates but does not close fixed trio',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        const first =
          ingest(
            coordinator,
            0,
          );

        expect(
          first.stateBefore,
        ).toBe(
          'WAITING_FIRST',
        );

        expect(
          first.stateAfter,
        ).toBe(
          'WAITING_SECOND',
        );

        expect(
          first.firstNumber,
        ).toBe(
          0,
        );

        expect(
          first.trioDiscarded,
        ).toBe(
          false,
        );

        expect(
          first.settlement,
        ).toBeNull();

        expect(
          coordinator.snapshot()
            .zeroInvalidated,
        ).toBe(
          true,
        );

        expect(
          coordinator.snapshot()
            .zeroPosition,
        ).toBe(
          1,
        );
      },
    );


    test(
      'zero-first trio consumes second and third positions before discard',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          0,
        );

        const second =
          ingest(
            coordinator,
            17,
          );

        expect(
          second.stateBefore,
        ).toBe(
          'WAITING_SECOND',
        );

        expect(
          second.stateAfter,
        ).toBe(
          'WAITING_THIRD',
        );

        expect(
          second.firstNumber,
        ).toBe(
          0,
        );

        expect(
          second.secondNumber,
        ).toBe(
          17,
        );

        expect(
          second.action,
        ).toBeNull();

        expect(
          second.trioDiscarded,
        ).toBe(
          false,
        );

        const third =
          ingest(
            coordinator,
            24,
          );

        expect(
          third.stateBefore,
        ).toBe(
          'WAITING_THIRD',
        );

        expect(
          third.stateAfter,
        ).toBe(
          'WAITING_FIRST',
        );

        expect(
          third.firstNumber,
        ).toBe(
          0,
        );

        expect(
          third.secondNumber,
        ).toBe(
          17,
        );

        expect(
          third.spin,
        ).toBe(
          24,
        );

        expect(
          third.trioDiscarded,
        ).toBe(
          true,
        );

        expect(
          third.trioCompleted,
        ).toBe(
          false,
        );

        expect(
          third.settlement,
        ).toBe(
          'VOID',
        );
      },
    );


    test(
      'zero at second position invalidates but still waits for third position',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          11,
        );

        const second =
          ingest(
            coordinator,
            0,
          );

        expect(
          second.stateBefore,
        ).toBe(
          'WAITING_SECOND',
        );

        expect(
          second.stateAfter,
        ).toBe(
          'WAITING_THIRD',
        );

        expect(
          second.firstNumber,
        ).toBe(
          11,
        );

        expect(
          second.secondNumber,
        ).toBe(
          0,
        );

        expect(
          second.action,
        ).toBeNull();

        expect(
          second.trioDiscarded,
        ).toBe(
          false,
        );

        expect(
          coordinator.snapshot()
            .zeroInvalidated,
        ).toBe(
          true,
        );

        expect(
          coordinator.snapshot()
            .zeroPosition,
        ).toBe(
          2,
        );
      },
    );


    test(
      'zero-second trio is discarded only after third position is consumed',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          11,
        );

        ingest(
          coordinator,
          0,
        );

        const third =
          ingest(
            coordinator,
            27,
          );

        expect(
          third.firstNumber,
        ).toBe(
          11,
        );

        expect(
          third.secondNumber,
        ).toBe(
          0,
        );

        expect(
          third.spin,
        ).toBe(
          27,
        );

        expect(
          third.trioDiscarded,
        ).toBe(
          true,
        );

        expect(
          third.settlement,
        ).toBe(
          'VOID',
        );

        expect(
          third.stateAfter,
        ).toBe(
          'WAITING_FIRST',
        );
      },
    );


    test(
      'zero at third position voids pending action at natural trio boundary',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          1,
        );

        ingest(
          coordinator,
          3,
        );

        const result =
          ingest(
            coordinator,
            0,
          );

        expect(
          result.trioDiscarded,
        ).toBe(
          true,
        );

        expect(
          result.settlement,
        ).toBe(
          'VOID',
        );

        expect(
          result.settledTargetColor,
        ).toBeNull();

        expect(
          result.settledSpinColor,
        ).toBe(
          'ZERO',
        );

        expect(
          result.stateAfter,
        ).toBe(
          'WAITING_FIRST',
        );
      },
    );


    test(
      'fixed trio boundary is preserved after zero in first position',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          0,
        );

        ingest(
          coordinator,
          17,
        );

        const discarded =
          ingest(
            coordinator,
            24,
          );

        expect(
          discarded.trioDiscarded,
        ).toBe(
          true,
        );

        const next =
          ingest(
            coordinator,
            8,
          );

        expect(
          next.stateBefore,
        ).toBe(
          'WAITING_FIRST',
        );

        expect(
          next.stateAfter,
        ).toBe(
          'WAITING_SECOND',
        );

        expect(
          next.firstNumber,
        ).toBe(
          8,
        );
      },
    );


    test(
      'fixed trio boundary is preserved after zero in second position',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          11,
        );

        ingest(
          coordinator,
          0,
        );

        ingest(
          coordinator,
          27,
        );

        const next =
          ingest(
            coordinator,
            8,
          );

        expect(
          next.stateBefore,
        ).toBe(
          'WAITING_FIRST',
        );

        expect(
          next.firstNumber,
        ).toBe(
          8,
        );
      },
    );


    test(
      'fixed trio boundary is preserved after zero in third position',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          11,
        );

        ingest(
          coordinator,
          20,
        );

        ingest(
          coordinator,
          0,
        );

        const next =
          ingest(
            coordinator,
            8,
          );

        expect(
          next.stateBefore,
        ).toBe(
          'WAITING_FIRST',
        );

        expect(
          next.firstNumber,
        ).toBe(
          8,
        );
      },
    );


    test(
      'resets automatically after completed normal trio',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          1,
        );

        ingest(
          coordinator,
          3,
        );

        ingest(
          coordinator,
          5,
        );

        const next =
          ingest(
            coordinator,
            2,
          );

        expect(
          next.stateBefore,
        ).toBe(
          'WAITING_FIRST',
        );

        expect(
          next.firstNumber,
        ).toBe(
          2,
        );
      },
    );


    test(
      'uses NTC action semantics prospectively',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          1,
          'NTC',
        );

        const second =
          ingest(
            coordinator,
            3,
            'NTC',
          );

        expect(
          second.action.targetColor,
        ).toBe(
          'BLACK',
        );

        const result =
          ingest(
            coordinator,
            2,
            'NTC',
          );

        expect(
          result.settlement,
        ).toBe(
          'WIN',
        );
      },
    );


    test(
      'uses TA action semantics prospectively',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          1,
          'TA',
        );

        const second =
          ingest(
            coordinator,
            2,
            'TA',
          );

        expect(
          second.action.targetColor,
        ).toBe(
          'RED',
        );

        const result =
          ingest(
            coordinator,
            3,
            'TA',
          );

        expect(
          result.settlement,
        ).toBe(
          'WIN',
        );
      },
    );


    test(
      'uses NTA action semantics prospectively',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        ingest(
          coordinator,
          1,
          'NTA',
        );

        const second =
          ingest(
            coordinator,
            2,
            'NTA',
          );

        expect(
          second.action.targetColor,
        ).toBe(
          'BLACK',
        );

        const result =
          ingest(
            coordinator,
            4,
            'NTA',
          );

        expect(
          result.settlement,
        ).toBe(
          'WIN',
        );
      },
    );


    test(
      'rejects invalid roulette spin',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        expect(
          () =>
            ingest(
              coordinator,
              37,
            ),
        ).toThrow(
          'triplicacao_formation_invalid_spin',
        );
      },
    );


    test(
      'preserves PAPER safety invariants',
      () => {
        const coordinator =
          new TriplicacaoProspectiveFormationCoordinator();

        const result =
          ingest(
            coordinator,
            1,
          );

        expect(
          result.paperOnly,
        ).toBe(
          true,
        );

        expect(
          result.liveMoneyAuthorization,
        ).toBe(
          false,
        );

        expect(
          result.automaticBetExecutionAllowed,
        ).toBe(
          false,
        );

        expect(
          result.operatorDecisionRequired,
        ).toBe(
          true,
        );
      },
    );
  },
);
