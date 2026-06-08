import {
  PerSpinOperatorCliSession,
  type PerSpinOperatorCliDecisionInput,
  type PerSpinOperatorCliSessionReport,
} from './PerSpinOperatorCliSession.js';

export type TriplicacaoPatternKind =
  | 'TC'
  | 'NTC'
  | 'TA'
  | 'NTA'
  | 'ZERO_DISCARDED'
  | 'INSUFFICIENT_DATA';

export interface TriplicacaoRuntimeSignal {
  readonly patternKind: TriplicacaoPatternKind;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly reasons?: readonly string[];
  readonly warnings?: readonly string[];
  readonly blockers?: readonly string[];
}

export interface TriplicacaoStrategyRuntimeBinderInput {
  readonly sessionId: string;
  readonly generatedAtEpochMs: number;
  readonly signals: readonly TriplicacaoRuntimeSignal[];
}

export interface TriplicacaoStrategyRuntimeBinderReport {
  readonly strategyName: 'Triplicação';
  readonly sessionId: string;
  readonly generatedAtEpochMs: number;
  readonly decisions: readonly PerSpinOperatorCliDecisionInput[];
  readonly cliSession: PerSpinOperatorCliSessionReport;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface TriplicacaoStrategyRuntimeBinderFailure {
  readonly code: 'INVALID_TRIPLICACAO_RUNTIME_BINDER_INPUT' | 'TRIPLICACAO_CLI_SESSION_FAILED';
  readonly stage: 'VALIDATION' | 'COMPOSITION';
  readonly message: string;
  readonly signalIndex: number | null;
}

export type TriplicacaoStrategyRuntimeBinderResult =
  | { readonly ok: true; readonly value: TriplicacaoStrategyRuntimeBinderReport }
  | { readonly ok: false; readonly error: TriplicacaoStrategyRuntimeBinderFailure };

/**
 * Binds Triplicação strategy runtime signals to the existing per-spin operator CLI session.
 *
 * This binder does not replace the institutional pipeline. It gives Triplicação
 * a typed runtime boundary so the strategy is no longer passed only as free text.
 *
 * Complexity:
 * - Time: O(n), where n is the number of strategy signals.
 * - Space: O(n), because per-spin decisions are preserved for session reporting.
 */
export class TriplicacaoStrategyRuntimeBinder {
  private readonly cliSession: PerSpinOperatorCliSession;

  public constructor(cliSession: PerSpinOperatorCliSession = new PerSpinOperatorCliSession()) {
    this.cliSession = cliSession;
  }

  public bind(input: TriplicacaoStrategyRuntimeBinderInput): TriplicacaoStrategyRuntimeBinderResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const decisions: PerSpinOperatorCliDecisionInput[] = [];

    for (let index = 0; index < input.signals.length; index += 1) {
      decisions.push(this.toDecision(input.signals[index]));
    }

    const cliResult = this.cliSession.compose({
      sessionId: input.sessionId,
      strategyName: 'Triplicação',
      generatedAtEpochMs: input.generatedAtEpochMs,
      decisions,
    });

    if (!cliResult.ok) {
      return {
        ok: false,
        error: Object.freeze({
          code: 'TRIPLICACAO_CLI_SESSION_FAILED',
          stage: 'COMPOSITION',
          message: cliResult.error.message,
          signalIndex: cliResult.error.decisionIndex,
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        strategyName: 'Triplicação',
        sessionId: input.sessionId.trim(),
        generatedAtEpochMs: input.generatedAtEpochMs,
        decisions: Object.freeze(decisions),
        cliSession: cliResult.value,
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(
    input: TriplicacaoStrategyRuntimeBinderInput,
  ): TriplicacaoStrategyRuntimeBinderFailure | null {
    if (typeof input.sessionId !== 'string' || input.sessionId.trim().length === 0) {
      return this.failure('sessionId is required', null);
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number', null);
    }

    if (!Array.isArray(input.signals)) {
      return this.failure('signals must be an array', null);
    }

    for (let index = 0; index < input.signals.length; index += 1) {
      const signal = input.signals[index];

      if (!this.isPatternKind(signal.patternKind)) {
        return this.failure(`signal at index ${index} has invalid patternKind`, index);
      }

      if (!Number.isFinite(signal.confidenceScore)) {
        return this.failure(`signal at index ${index} has invalid confidenceScore`, index);
      }

      if (!Number.isFinite(signal.riskScore)) {
        return this.failure(`signal at index ${index} has invalid riskScore`, index);
      }
    }

    return null;
  }

  private toDecision(signal: TriplicacaoRuntimeSignal): PerSpinOperatorCliDecisionInput {
    const blockers = this.normalizeMessages(signal.blockers);
    const warnings = this.normalizeMessages(signal.warnings);
    const reasons = [
      `TRIPLICACAO_PATTERN:${signal.patternKind}`,
      ...this.normalizeMessages(signal.reasons),
    ];

    if (signal.patternKind === 'ZERO_DISCARDED') {
      return Object.freeze({
        finalDecision: 'OBSERVAR',
        confidenceScore: 0,
        riskScore: 0.6,
        operatorSummary: 'Triplicação: giro com zero descartado pela regra da estratégia. Aguardar nova formação válida.',
        reasons: Object.freeze([...reasons, 'ZERO_RULE_DISCARD']),
        warnings: Object.freeze([...warnings, 'ZERO_DESCARTADO_REAVALIAR_PROXIMO_GIRO']),
        blockers,
      });
    }

    if (signal.patternKind === 'INSUFFICIENT_DATA') {
      return Object.freeze({
        finalDecision: 'OBSERVAR',
        confidenceScore: signal.confidenceScore,
        riskScore: signal.riskScore,
        operatorSummary: 'Triplicação: dados insuficientes para qualificar entrada. Aguardar novo giro.',
        reasons: Object.freeze([...reasons, 'TRIPLICACAO_DADOS_INSUFICIENTES']),
        warnings: Object.freeze([...warnings, 'CONFIRMACAO_CONTEXTUAL_INSUFICIENTE']),
        blockers,
      });
    }

    if (blockers.length > 0 || signal.riskScore >= 0.67) {
      return Object.freeze({
        finalDecision: 'NAO_UTILIZAR',
        confidenceScore: signal.confidenceScore,
        riskScore: signal.riskScore,
        operatorSummary: 'Triplicação: contexto bloqueado para uso da estratégia neste momento.',
        reasons,
        warnings,
        blockers: Object.freeze(blockers.length > 0 ? blockers : ['RISCO_ELEVADO_TRIPLICACAO']),
      });
    }

    if (signal.confidenceScore >= 0.7 && signal.riskScore <= 0.33) {
      return Object.freeze({
        finalDecision: 'PAPER_FAVORAVEL',
        confidenceScore: signal.confidenceScore,
        riskScore: signal.riskScore,
        operatorSummary: 'Triplicação: contexto favorável para considerar entrada manual supervisionada.',
        reasons: Object.freeze([...reasons, 'TRIPLICACAO_CONTEXTO_FAVORAVEL']),
        warnings,
        blockers,
      });
    }

    return Object.freeze({
      finalDecision: 'OBSERVAR',
      confidenceScore: signal.confidenceScore,
      riskScore: signal.riskScore,
      operatorSummary: 'Triplicação: contexto ainda não confirmou qualidade suficiente. Aguardar novo giro.',
      reasons: Object.freeze([...reasons, 'TRIPLICACAO_AGUARDAR_CONFIRMACAO']),
      warnings: Object.freeze([...warnings, 'AGUARDAR_NOVA_CONFIRMACAO']),
      blockers,
    });
  }

  private isPatternKind(value: string): value is TriplicacaoPatternKind {
    return (
      value === 'TC' ||
      value === 'NTC' ||
      value === 'TA' ||
      value === 'NTA' ||
      value === 'ZERO_DISCARDED' ||
      value === 'INSUFFICIENT_DATA'
    );
  }

  private normalizeMessages(messages: readonly string[] | undefined): readonly string[] {
    if (!Array.isArray(messages)) {
      return Object.freeze([]);
    }

    const normalized: string[] = [];
    for (const message of messages) {
      if (typeof message === 'string') {
        const trimmed = message.trim();
        if (trimmed.length > 0) {
          normalized.push(trimmed);
        }
      }
    }

    return Object.freeze(normalized);
  }

  private failure(message: string, signalIndex: number | null): TriplicacaoStrategyRuntimeBinderFailure {
    return Object.freeze({
      code: 'INVALID_TRIPLICACAO_RUNTIME_BINDER_INPUT',
      stage: 'VALIDATION',
      message,
      signalIndex,
    });
  }
}
