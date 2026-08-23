const fs =
  require('node:fs');

const path =
  require('node:path');


describe(
  'PAPER canonical financial authority',
  () => {
    test(
      'session configuration owns provider and minimum chip',
      () => {
        const source =
          fs.readFileSync(
            path.join(
              process.cwd(),
              'src/application/runtime/PaperSessionOperatorConfiguration.ts',
            ),
            'utf8',
          );

        expect(
          source,
        ).toContain(
          'minimumChipValue',
        );

        expect(
          source,
        ).toContain(
          "'PRAGMATIC'",
        );

        expect(
          source,
        ).toContain(
          "'EVOLUTION'",
        );
      },
    );


    test(
      'duplicate PaperMonetaryProfile authority is absent',
      () => {
        expect(
          fs.existsSync(
            path.join(
              process.cwd(),
              'src/application/runtime/PaperMonetaryProfile.ts',
            ),
          ),
        ).toBe(
          false,
        );
      },
    );


    test(
      'stake resolver remains sovereign exposure authority',
      () => {
        const source =
          fs.readFileSync(
            path.join(
              process.cwd(),
              'src/application/runtime/PaperStakeRecommendationResolver.ts',
            ),
            'utf8',
          );

        expect(
          source,
        ).toContain(
          'exposureLimitAmount',
        );

        expect(
          source,
        ).toContain(
          'suggestedStake',
        );

        expect(
          source,
        ).toContain(
          'PAPER_STAKE_MINIMUM_EXCEEDS_SAFE_EXPOSURE',
        );
      },
    );


    test(
      'capital preservation remains sovereign stop authority',
      () => {
        const source =
          fs.readFileSync(
            path.join(
              process.cwd(),
              'src/application/runtime/PaperCapitalPreservationGuard.ts',
            ),
            'utf8',
          );

        expect(
          source,
        ).toContain(
          "'STOP_WIN_REACHED'",
        );

        expect(
          source,
        ).toContain(
          "'STOP_LOSS_REACHED'",
        );

        expect(
          source,
        ).toContain(
          "'MAX_DRAWDOWN_REACHED'",
        );
      },
    );


    test(
      'multi-target plan only consumes an already-authorized maximum budget',
      () => {
        const source =
          fs.readFileSync(
            path.join(
              process.cwd(),
              'src/application/runtime/StrategyPaperStakePlan.ts',
            ),
            'utf8',
          );

        expect(
          source,
        ).toContain(
          'maximumTotalStake',
        );

        expect(
          source,
        ).toContain(
          'paper_stake_plan_exposure_cap_violated',
        );

        expect(
          source,
        ).not.toContain(
          'initialBankroll',
        );

        expect(
          source,
        ).not.toContain(
          'currentBankroll',
        );
      },
    );


    test(
      'legacy institutional position sizing is not a runtime consumer',
      () => {
        const roots = [
          'src/application/runtime',
        ];

        const consumers =
          [];

        function walk(
          directory,
        ) {
          for (
            const entry of
            fs.readdirSync(
              directory,
              {
                withFileTypes:
                  true,
              },
            )
          ) {
            const absolute =
              path.join(
                directory,
                entry.name,
              );

            if (
              entry.isDirectory()
            ) {
              walk(
                absolute,
              );

              continue;
            }

            if (
              !entry.name.endsWith(
                '.ts',
              ) ||
              entry.name ===
                'InstitutionalPositionSizingEngine.ts'
            ) {
              continue;
            }

            const source =
              fs.readFileSync(
                absolute,
                'utf8',
              );

            if (
              source.includes(
                'InstitutionalPositionSizingEngine',
              )
            ) {
              consumers.push(
                absolute,
              );
            }
          }
        }

        for (
          const root of
          roots
        ) {
          walk(
            path.join(
              process.cwd(),
              root,
            ),
          );
        }

        expect(
          consumers,
        ).toEqual([]);
      },
    );
  },
);
