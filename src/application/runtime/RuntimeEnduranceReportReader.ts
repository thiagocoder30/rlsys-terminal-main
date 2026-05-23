import type {
  RuntimeEnduranceCertification,
  RuntimeEnduranceCertificationEngine,
  RuntimeEnduranceCertificationPolicy,
  RuntimeEnduranceSoakReport,
} from "./RuntimeEnduranceCertificationEngine.js";

export interface RuntimeEnduranceReportSource {
  readonly name: string;
  readonly content: string;
}

export interface RuntimeEnduranceCertifiedReport {
  readonly name: string;
  readonly report: RuntimeEnduranceSoakReport;
  readonly certification: RuntimeEnduranceCertification;
}

export interface RuntimeEnduranceTrendSummary {
  readonly reports: readonly RuntimeEnduranceCertifiedReport[];
  readonly totalReports: number;
  readonly certifiedReports: number;
  readonly failedReports: number;
  readonly warnings: number;
  readonly heapDriftRegression: boolean;
  readonly lagRegression: boolean;
  readonly regressionMessages: readonly string[];
}

/**
 * Parses and validates persisted endurance soak reports.
 *
 * Complexity:
 * - O(n log n), where n is report count, due to chronological sorting.
 * - Memory O(n), because reports are returned for audit/history.
 */
export class RuntimeEnduranceReportReader {
  public readMany(sources: readonly RuntimeEnduranceReportSource[]): RuntimeEnduranceSoakReport[] {
    const reports = sources.map((source) => this.readOne(source));

    return reports.sort((left, right) => left.generatedAtEpochMs - right.generatedAtEpochMs);
  }

  public readOne(source: RuntimeEnduranceReportSource): RuntimeEnduranceSoakReport {
    if (source.name.trim().length === 0) {
      throw new Error("Invalid endurance report source: name cannot be empty.");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(source.content);
    } catch (error: unknown) {
      throw new Error(`Invalid endurance report ${source.name}: JSON parsing failed.`);
    }

    return this.validateReport(source.name, parsed);
  }

  private validateReport(name: string, value: unknown): RuntimeEnduranceSoakReport {
    if (typeof value !== "object" || value === null) {
      throw new Error(`Invalid endurance report ${name}: expected object.`);
    }

    const record = value as Record<string, unknown>;
    const result = record.result;

    if (typeof result !== "object" || result === null) {
      throw new Error(`Invalid endurance report ${name}: result must be object.`);
    }

    const resultRecord = result as Record<string, unknown>;

    const report: RuntimeEnduranceSoakReport = {
      generatedAtEpochMs: this.number(name, record.generatedAtEpochMs, "generatedAtEpochMs"),
      durationMs: this.number(name, record.durationMs, "durationMs"),
      result: {
        stable: this.boolean(name, resultRecord.stable, "result.stable"),
        iterations: this.number(name, resultRecord.iterations, "result.iterations"),
        heapDriftBytes: this.number(name, resultRecord.heapDriftBytes, "result.heapDriftBytes"),
        peakEventLoopLagMs: this.number(name, resultRecord.peakEventLoopLagMs, "result.peakEventLoopLagMs"),
        pressureViolations: this.number(name, resultRecord.pressureViolations, "result.pressureViolations"),
      },
    };

    return report;
  }

  private number(name: string, value: unknown, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid endurance report ${name}: ${field} must be finite and non-negative.`);
    }

    return value;
  }

  private boolean(name: string, value: unknown, field: string): boolean {
    if (typeof value !== "boolean") {
      throw new Error(`Invalid endurance report ${name}: ${field} must be boolean.`);
    }

    return value;
  }
}

/**
 * Certifies historical endurance reports and detects basic regressions.
 *
 * Complexity:
 * - O(n), where n is report count.
 * - Memory O(n), preserving certified reports for audit output.
 */
export class RuntimeEnduranceTrendAnalyzer {
  public constructor(
    private readonly certificationEngine: RuntimeEnduranceCertificationEngine,
  ) {}

  public analyze(
    namedReports: readonly { readonly name: string; readonly report: RuntimeEnduranceSoakReport }[],
    policy: RuntimeEnduranceCertificationPolicy,
  ): RuntimeEnduranceTrendSummary {
    const certifiedReports = namedReports.map((entry): RuntimeEnduranceCertifiedReport => ({
      name: entry.name,
      report: entry.report,
      certification: this.certificationEngine.certify(entry.report, policy),
    }));

    const regressionMessages: string[] = [];
    const heapDriftRegression = this.hasIncreasingTrend(
      certifiedReports.map((entry) => entry.report.result.heapDriftBytes),
    );

    const lagRegression = this.hasIncreasingTrend(
      certifiedReports.map((entry) => entry.report.result.peakEventLoopLagMs),
    );

    if (heapDriftRegression) {
      regressionMessages.push("Heap drift increased monotonically across endurance reports.");
    }

    if (lagRegression) {
      regressionMessages.push("Peak event loop lag increased monotonically across endurance reports.");
    }

    return {
      reports: certifiedReports,
      totalReports: certifiedReports.length,
      certifiedReports: certifiedReports.filter((entry) => entry.certification.status === "CERTIFIED").length,
      failedReports: certifiedReports.filter((entry) => entry.certification.status === "FAILED").length,
      warnings: certifiedReports.filter((entry) => entry.certification.status === "WARNING").length,
      heapDriftRegression,
      lagRegression,
      regressionMessages,
    };
  }

  private hasIncreasingTrend(values: readonly number[]): boolean {
    if (values.length < 3) {
      return false;
    }

    for (let index = 1; index < values.length; index += 1) {
      if (values[index] <= values[index - 1]) {
        return false;
      }
    }

    return true;
  }
}
