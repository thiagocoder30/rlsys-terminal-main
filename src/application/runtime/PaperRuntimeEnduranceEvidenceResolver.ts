import {
  RuntimeBaselinePolicyFactory,
  type RuntimeBaselineProfileKind,
  type RuntimeBaselineCertificationProfile,
} from './RuntimeBaselineCertificationProfile.js';

import {
  RuntimeEnduranceCertificationEngine,
} from './RuntimeEnduranceCertificationEngine.js';

import {
  RuntimeEnduranceReportReader,
  RuntimeEnduranceTrendAnalyzer,
  type RuntimeEnduranceReportSource,
  type RuntimeEnduranceTrendSummary,
} from './RuntimeEnduranceReportReader.js';

import {
  RuntimeEnduranceCliReporter,
  type RuntimeEnduranceCliReport,
} from './RuntimeEnduranceCliReporter.js';


export type PaperRuntimeEnduranceBaselineKind =
  Exclude<RuntimeBaselineProfileKind, 'CUSTOM'>;


export interface PaperRuntimeEnduranceEvidenceInput {
  readonly sources:
    readonly RuntimeEnduranceReportSource[];

  readonly baseline:
    PaperRuntimeEnduranceBaselineKind;
}


export interface PaperRuntimeEnduranceEvidence {
  readonly status:
    RuntimeEnduranceCliReport['status'];

  readonly baseline:
    RuntimeBaselineCertificationProfile;

  readonly summary:
    RuntimeEnduranceTrendSummary;

  readonly report:
    RuntimeEnduranceCliReport;

  readonly sourceCount: number;

  readonly hasEvidence: boolean;

  readonly paperOnly: true;

  readonly liveMoneyAuthorization: false;
}


/**
 * Resolves persisted runtime endurance evidence using the existing
 * institutional certification chain.
 *
 * It does not:
 * - read files from disk;
 * - generate endurance reports;
 * - fabricate certification when reports are absent;
 * - authorize PAPER operation;
 * - authorize live money.
 *
 * Empty sources deliberately resolve to NO_DATA.
 *
 * Complexity:
 * - O(n log n) due to report parsing/sorting.
 * - Memory O(n), where n is endurance report count.
 */
export class PaperRuntimeEnduranceEvidenceResolver {
  private readonly baselineFactory =
    new RuntimeBaselinePolicyFactory();

  private readonly reader =
    new RuntimeEnduranceReportReader();

  private readonly certificationEngine =
    new RuntimeEnduranceCertificationEngine();

  private readonly reporter =
    new RuntimeEnduranceCliReporter();


  public resolve(
    input: PaperRuntimeEnduranceEvidenceInput,
  ): PaperRuntimeEnduranceEvidence {
    this.validate(input);

    const baseline =
      this.baselineFactory.create(
        input.baseline,
      );

    const reports =
      this.reader.readMany(
        input.sources,
      );

    const namedReports =
      reports.map(
        (report, index) => ({
          name:
            input.sources[index]?.name ??
            `endurance-${index}`,
          report,
        }),
      );

    const analyzer =
      new RuntimeEnduranceTrendAnalyzer(
        this.certificationEngine,
      );

    const summary =
      analyzer.analyze(
        namedReports,
        baseline.policy,
      );

    const report =
      this.reporter.render(
        summary,
        {
          compact: true,
        },
      );

    return Object.freeze({
      status:
        report.status,

      baseline,

      summary,

      report,

      sourceCount:
        input.sources.length,

      hasEvidence:
        input.sources.length > 0,

      paperOnly:
        true as const,

      liveMoneyAuthorization:
        false as const,
    });
  }


  private validate(
    input: PaperRuntimeEnduranceEvidenceInput,
  ): void {
    if (
      !Array.isArray(input.sources)
    ) {
      throw new Error(
        'paper_runtime_endurance_sources_invalid',
      );
    }

    if (
      input.baseline !==
        'MOBILE_CONSERVATIVE' &&
      input.baseline !==
        'MOBILE_BALANCED' &&
      input.baseline !==
        'DESKTOP_BALANCED'
    ) {
      throw new Error(
        'paper_runtime_endurance_baseline_invalid',
      );
    }
  }
}
