import {
  OperatorDecisionPresentationAdapter,
  type InstitutionalPipelineDecision,
  type OperatorDecisionPresentationReport,
} from './OperatorDecisionPresentationAdapter.js';

import {
  PerSpinRecommendationSessionReporter,
  type PerSpinRecommendationSessionReport,
} from './PerSpinRecommendationSessionReporter.js';

export interface PerSpinOperatorCliDecisionInput {
  readonly finalDecision: InstitutionalPipelineDecision;
  readonly confidenceScore?: number;
  readonly institutionalScore?: number;
  readonly riskScore?: number;
  readonly operatorSummary?: string;
  readonly reasons?: readonly string[];
  readonly warnings?: readonly string[];
  readonly blockers?: readonly string[];
}

export interface PerSpinOperatorCliSessionInput {
  readonly sessionId: string;
  readonly strategyName: string;
  readonly generatedAtEpochMs: number;
  readonly decisions: readonly PerSpinOperatorCliDecisionInput[];
}

export interface PerSpinOperatorCliFrame {
  readonly spinIndex: number;
  readonly statusLine: string;
  readonly confidenceLine: string;
  readonly riskLine: string;
  readonly actionLine: string;
  readonly explanationLine: string;
  readonly renderedText: string;
}

export interface PerSpinOperatorCliSessionReport {
  readonly sessionId: string;
  readonly strategyName: string;
  readonly generatedAtEpochMs: number;
  readonly frames: readonly PerSpinOperatorCliFrame[];
  readonly sessionReport: PerSpinRecommendationSessionReport;
  readonly renderedText: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface PerSpinOperatorCliSessionFailure {
  readonly code:
    | 'INVALID_PER_SPIN_OPERATOR_CLI_SESSION_INPUT'
    | 'OPERATOR_PRESENTATION_FAILED'
    | 'PER_SPIN_SESSION_REPORT_FAILED';
  readonly stage: 'VALIDATION' | 'PRESENTATION' | 'REPORTING';
  readonly message: string;
  readonly decisionIndex: number | null;
}

export type PerSpinOperatorCliSessionResult =
  | { readonly ok: true; readonly value: PerSpinOperatorCliSessionReport }
  | { readonly ok: false; readonly error: PerSpinOperatorCliSessionFailure };

/**
 * Composes a lightweight CLI-ready per-spin operator session.
 *
 * This class does not calculate table intelligence. It consumes institutional
 * decisions that were already produced by the pipeline/runtime and delegates
 * presentation/reporting to the existing operator adapter and session reporter.
 *
 * Complexity:
 * - Time: O(n), where n is the number of spin decisions.
 * - Space: O(n), because CLI frames and session timeline are intentionally kept.
 */
export class PerSpinOperatorCliSession {
  private readonly presenter: OperatorDecisionPresentationAdapter;
  private readonly reporter: PerSpinRecommendationSessionReporter;

  public constructor(
    presenter: OperatorDecisionPresentationAdapter = new OperatorDecisionPresentationAdapter(),
    reporter: PerSpinRecommendationSessionReporter = new PerSpinRecommendationSessionReporter(),
  ) {
    this.presenter = presenter;
    this.reporter = reporter;
  }

  public compose(input: PerSpinOperatorCliSessionInput): PerSpinOperatorCliSessionResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const presentations: OperatorDecisionPresentationReport[] = [];
    const frames: PerSpinOperatorCliFrame[] = [];

    for (let index = 0; index < input.decisions.length; index += 1) {
      const decision = input.decisions[index];
      const presentation = this.presenter.present({
        strategyName: input.strategyName,
        finalDecision: decision.finalDecision,
        confidenceScore: decision.confidenceScore,
        institutionalScore: decision.institutionalScore,
        riskScore: decision.riskScore,
        operatorSummary: decision.operatorSummary,
        reasons: decision.reasons,
        warnings: decision.warnings,
        blockers: decision.blockers,
        currentRoundIndex: index + 1,
        observedRounds: input.decisions.length,
      });

      if (!presentation.ok) {
        return {
          ok: false,
          error: Object.freeze({
            code: 'OPERATOR_PRESENTATION_FAILED',
            stage: 'PRESENTATION',
            message: presentation.error.message,
            decisionIndex: index,
          }),
        };
      }

      presentations.push(presentation.value);
      frames.push(this.toFrame(index + 1, presentation.value));
    }

    const sessionReport = this.reporter.report({
      sessionId: input.sessionId,
      strategyName: input.strategyName,
      generatedAtEpochMs: input.generatedAtEpochMs,
      presentations,
    });

    if (!sessionReport.ok) {
      return {
        ok: false,
        error: Object.freeze({
          code: 'PER_SPIN_SESSION_REPORT_FAILED',
          stage: 'REPORTING',
          message: sessionReport.error.message,
          decisionIndex: null,
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        sessionId: input.sessionId.trim(),
        strategyName: input.strategyName.trim(),
        generatedAtEpochMs: input.generatedAtEpochMs,
        frames: Object.freeze(frames),
        sessionReport: sessionReport.value,
        renderedText: this.renderSession(input.strategyName.trim(), frames, sessionReport.value),
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(input: PerSpinOperatorCliSessionInput): PerSpinOperatorCliSessionFailure | null {
    if (typeof input.sessionId !== 'string' || input.sessionId.trim().length === 0) {
      return this.failure('sessionId is required');
    }

    if (typeof input.strategyName !== 'string' || input.strategyName.trim().length === 0) {
      return this.failure('strategyName is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (!Array.isArray(input.decisions)) {
      return this.failure('decisions must be an array');
    }

    for (let index = 0; index < input.decisions.length; index += 1) {
      const decision = input.decisions[index];

      if (
        decision.finalDecision !== 'PAPER_FAVORAVEL' &&
        decision.finalDecision !== 'OBSERVAR' &&
        decision.finalDecision !== 'NAO_UTILIZAR'
      ) {
        return Object.freeze({
          code: 'INVALID_PER_SPIN_OPERATOR_CLI_SESSION_INPUT',
          stage: 'VALIDATION',
          message: `decision at index ${index} has invalid finalDecision`,
          decisionIndex: index,
        });
      }

      if (!this.isOptionalFinite(decision.confidenceScore)) {
        return this.indexedFailure('confidenceScore must be finite when provided', index);
      }

      if (!this.isOptionalFinite(decision.institutionalScore)) {
        return this.indexedFailure('institutionalScore must be finite when provided', index);
      }

      if (!this.isOptionalFinite(decision.riskScore)) {
        return this.indexedFailure('riskScore must be finite when provided', index);
      }
    }

    return null;
  }

  private toFrame(
    spinIndex: number,
    presentation: OperatorDecisionPresentationReport,
  ): PerSpinOperatorCliFrame {
    const statusLine = `Status: ${presentation.status}`;
    const confidenceLine = `Confiança: ${presentation.confidencePercent}%`;
    const riskLine = `Risco: ${presentation.riskLevel}`;
    const actionLine = `Ação: ${presentation.actionLabel}`;
    const explanationLine = `Explicação: ${presentation.explanation}`;

    return Object.freeze({
      spinIndex,
      statusLine,
      confidenceLine,
      riskLine,
      actionLine,
      explanationLine,
      renderedText: [
        `Giro #${spinIndex}`,
        presentation.headline,
        statusLine,
        confidenceLine,
        riskLine,
        actionLine,
        explanationLine,
      ].join('\n'),
    });
  }

  private renderSession(
    strategyName: string,
    frames: readonly PerSpinOperatorCliFrame[],
    report: PerSpinRecommendationSessionReport,
  ): string {
    const lines: string[] = [
      'RL.SYS CORE — PER-SPIN OPERATOR CLI SESSION',
      '===========================================',
      `Sessão: ${report.sessionId}`,
      `Estratégia: ${strategyName}`,
      `Total de Recomendações: ${report.totalRecommendations}`,
      `Tendência da Sessão: ${report.trend}`,
      `Confiança Média: ${report.averageConfidencePercent}%`,
      '',
      'Resumo:',
      report.operatorSummary,
    ];

    if (frames.length > 0) {
      lines.push('', 'Giros:', '------');
      for (const frame of frames) {
        lines.push(frame.renderedText, '');
      }
    } else {
      lines.push('', 'Nenhum giro registrado nesta sessão.');
    }

    lines.push(
      'Governança:',
      'Decisão final do operador: true',
      'Recomendação supervisionada: true',
      'Modo de análise institucional: true',
    );

    return lines.join('\n').trim();
  }

  private isOptionalFinite(value: number | undefined): boolean {
    return typeof value === 'undefined' || Number.isFinite(value);
  }

  private indexedFailure(message: string, decisionIndex: number): PerSpinOperatorCliSessionFailure {
    return Object.freeze({
      code: 'INVALID_PER_SPIN_OPERATOR_CLI_SESSION_INPUT',
      stage: 'VALIDATION',
      message,
      decisionIndex,
    });
  }

  private failure(message: string): PerSpinOperatorCliSessionFailure {
    return Object.freeze({
      code: 'INVALID_PER_SPIN_OPERATOR_CLI_SESSION_INPUT',
      stage: 'VALIDATION',
      message,
      decisionIndex: null,
    });
  }
}
