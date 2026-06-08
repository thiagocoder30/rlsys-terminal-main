import type {
  OperatorGuidedSessionPackageReport,
  OperatorGuidedSessionPackageStatus,
} from './OperatorGuidedSessionPackage.js';

import {
  OperatorLocalizationAdapter,
  type OperatorLocale,
  type OperatorLocalizedToken,
} from './OperatorLocalizationAdapter.js';

export type FirstPaperSessionFinalVerdict =
  | 'READY_FOR_FIRST_PAPER_SESSION'
  | 'WARMUP_REQUIRED'
  | 'BLOCKED'
  | 'SESSION_LIMIT_REACHED';

export interface FirstPaperSessionFinalReadinessVerdictInput {
  readonly verdictId: string;
  readonly generatedAtEpochMs: number;
  readonly guidedPackage: OperatorGuidedSessionPackageReport;
  readonly locale?: OperatorLocale;
}

export interface FirstPaperSessionFinalReadinessVerdictReport {
  readonly verdictId: string;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly finalVerdict: FirstPaperSessionFinalVerdict;
  readonly localizedVerdict: OperatorLocalizedToken;
  readonly canStartPaperSession: boolean;
  readonly packageStatus: OperatorGuidedSessionPackageStatus;
  readonly operatorSummary: string;
  readonly localizedOperatorSummary: string;
  readonly requiredOperatorAction:
    | 'INICIAR_SESSAO_PAPER_SUPERVISIONADA'
    | 'CONCLUIR_WARMUP_ANTES_DE_INICIAR'
    | 'RESOLVER_BLOQUEIOS_ANTES_DE_INICIAR'
    | 'ENCERRAR_E_EXPORTAR_RELATORIOS';
  readonly blockers: readonly string[];
  readonly localizedBlockers: readonly OperatorLocalizedToken[];
  readonly warnings: readonly string[];
  readonly localizedWarnings: readonly OperatorLocalizedToken[];
  readonly evidence: readonly string[];
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface FirstPaperSessionFinalReadinessVerdictFailure {
  readonly code: 'INVALID_FIRST_PAPER_SESSION_FINAL_VERDICT_INPUT' | 'LOCALIZATION_FAILED';
  readonly stage: 'VALIDATION' | 'LOCALIZATION';
  readonly message: string;
}

export type FirstPaperSessionFinalReadinessVerdictResult =
  | { readonly ok: true; readonly value: FirstPaperSessionFinalReadinessVerdictReport }
  | { readonly ok: false; readonly error: FirstPaperSessionFinalReadinessVerdictFailure };

/**
 * Produces the final institutional readiness verdict for the first PAPER session.
 *
 * This class does not evaluate strategy signals and does not create recommendations.
 * It consumes the guided package and emits one operator-facing verdict in pt-BR.
 *
 * Complexity:
 * - Time: O(n), where n is blockers + warnings + evidence length.
 * - Space: O(n), because localized explanations are materialized.
 */
export class FirstPaperSessionFinalReadinessVerdict {
  private readonly localization: OperatorLocalizationAdapter;

  public constructor(localization: OperatorLocalizationAdapter = new OperatorLocalizationAdapter()) {
    this.localization = localization;
  }

  public evaluate(
    input: FirstPaperSessionFinalReadinessVerdictInput,
  ): FirstPaperSessionFinalReadinessVerdictResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const locale = input.locale ?? 'pt-BR';
    const finalVerdict = this.verdict(input.guidedPackage.status);
    const localizedVerdict = this.localizeToken(finalVerdict, locale);
    if (!localizedVerdict.ok) {
      return localizedVerdict;
    }

    const localizedBlockers = this.localizeMany(input.guidedPackage.blockers, locale);
    if (!localizedBlockers.ok) {
      return localizedBlockers;
    }

    const localizedWarnings = this.localizeMany(input.guidedPackage.warnings, locale);
    if (!localizedWarnings.ok) {
      return localizedWarnings;
    }

    return {
      ok: true,
      value: Object.freeze({
        verdictId: input.verdictId.trim(),
        generatedAtEpochMs: input.generatedAtEpochMs,
        sessionId: input.guidedPackage.sessionId,
        strategyName: input.guidedPackage.strategyName,
        finalVerdict,
        localizedVerdict: localizedVerdict.value,
        canStartPaperSession: finalVerdict === 'READY_FOR_FIRST_PAPER_SESSION' && input.guidedPackage.canStartPaperSession,
        packageStatus: input.guidedPackage.status,
        operatorSummary: input.guidedPackage.operatorSummary,
        localizedOperatorSummary: this.localizedSummary(finalVerdict, input.guidedPackage.strategyName),
        requiredOperatorAction: this.requiredAction(finalVerdict),
        blockers: Object.freeze([...input.guidedPackage.blockers]),
        localizedBlockers: Object.freeze(localizedBlockers.value),
        warnings: Object.freeze([...input.guidedPackage.warnings]),
        localizedWarnings: Object.freeze(localizedWarnings.value),
        evidence: Object.freeze(this.evidence(input.guidedPackage)),
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(
    input: FirstPaperSessionFinalReadinessVerdictInput,
  ): FirstPaperSessionFinalReadinessVerdictFailure | null {
    if (typeof input.verdictId !== 'string' || input.verdictId.trim().length === 0) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_FINAL_VERDICT_INPUT', 'VALIDATION', 'verdictId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_FINAL_VERDICT_INPUT', 'VALIDATION', 'generatedAtEpochMs must be a positive finite number');
    }

    if (typeof input.locale !== 'undefined' && input.locale !== 'pt-BR') {
      return this.failure('INVALID_FIRST_PAPER_SESSION_FINAL_VERDICT_INPUT', 'VALIDATION', 'locale must be pt-BR when provided');
    }

    if (!this.isValidGuidedPackage(input.guidedPackage)) {
      return this.failure('INVALID_FIRST_PAPER_SESSION_FINAL_VERDICT_INPUT', 'VALIDATION', 'guidedPackage is invalid or violates supervised recommendation semantics');
    }

    return null;
  }

  private isValidGuidedPackage(pkg: OperatorGuidedSessionPackageReport): boolean {
    return (
      typeof pkg === 'object' &&
      pkg !== null &&
      typeof pkg.packageId === 'string' &&
      pkg.packageId.trim().length > 0 &&
      typeof pkg.sessionId === 'string' &&
      pkg.sessionId.trim().length > 0 &&
      typeof pkg.strategyName === 'string' &&
      pkg.strategyName.trim().length > 0 &&
      (
        pkg.status === 'GUIDED_PACKAGE_READY' ||
        pkg.status === 'GUIDED_PACKAGE_WARMUP_REQUIRED' ||
        pkg.status === 'GUIDED_PACKAGE_BLOCKED' ||
        pkg.status === 'GUIDED_PACKAGE_SESSION_LIMIT_REACHED'
      ) &&
      typeof pkg.canStartPaperSession === 'boolean' &&
      Array.isArray(pkg.instructions) &&
      Array.isArray(pkg.blockers) &&
      Array.isArray(pkg.warnings) &&
      typeof pkg.operatorSummary === 'string' &&
      pkg.operatorDecisionRequired === true &&
      pkg.supervisedRecommendationOnly === true &&
      pkg.institutionalAnalysisMode === true
    );
  }

  private verdict(status: OperatorGuidedSessionPackageStatus): FirstPaperSessionFinalVerdict {
    if (status === 'GUIDED_PACKAGE_READY') {
      return 'READY_FOR_FIRST_PAPER_SESSION';
    }

    if (status === 'GUIDED_PACKAGE_WARMUP_REQUIRED') {
      return 'WARMUP_REQUIRED';
    }

    if (status === 'GUIDED_PACKAGE_SESSION_LIMIT_REACHED') {
      return 'SESSION_LIMIT_REACHED';
    }

    return 'BLOCKED';
  }

  private requiredAction(
    verdict: FirstPaperSessionFinalVerdict,
  ): FirstPaperSessionFinalReadinessVerdictReport['requiredOperatorAction'] {
    if (verdict === 'READY_FOR_FIRST_PAPER_SESSION') {
      return 'INICIAR_SESSAO_PAPER_SUPERVISIONADA';
    }

    if (verdict === 'WARMUP_REQUIRED') {
      return 'CONCLUIR_WARMUP_ANTES_DE_INICIAR';
    }

    if (verdict === 'SESSION_LIMIT_REACHED') {
      return 'ENCERRAR_E_EXPORTAR_RELATORIOS';
    }

    return 'RESOLVER_BLOQUEIOS_ANTES_DE_INICIAR';
  }

  private localizedSummary(verdict: FirstPaperSessionFinalVerdict, strategyName: string): string {
    if (verdict === 'READY_FOR_FIRST_PAPER_SESSION') {
      return `${strategyName}: o RL.SYS CORE considera a primeira sessão PAPER pronta para início supervisionado.`;
    }

    if (verdict === 'WARMUP_REQUIRED') {
      return `${strategyName}: ainda é necessário concluir o warmup antes de iniciar a primeira sessão PAPER.`;
    }

    if (verdict === 'SESSION_LIMIT_REACHED') {
      return `${strategyName}: o limite operacional foi atingido; encerre e exporte os relatórios.`;
    }

    return `${strategyName}: a sessão está bloqueada; resolva os bloqueios antes de iniciar.`;
  }

  private evidence(pkg: OperatorGuidedSessionPackageReport): readonly string[] {
    return [
      `PACKAGE_STATUS:${pkg.status}`,
      `CAN_START:${pkg.canStartPaperSession}`,
      `BLOCKERS:${pkg.blockers.length}`,
      `WARNINGS:${pkg.warnings.length}`,
      `INSTRUCTIONS:${pkg.instructions.length}`,
    ];
  }

  private localizeToken(
    token: string,
    locale: OperatorLocale,
  ):
    | { readonly ok: true; readonly value: OperatorLocalizedToken }
    | { readonly ok: false; readonly error: FirstPaperSessionFinalReadinessVerdictFailure } {
    const result = this.localization.localizeOne(token, locale);
    if (!result.ok) {
      return {
        ok: false,
        error: this.failure('LOCALIZATION_FAILED', 'LOCALIZATION', result.error.message),
      };
    }

    return { ok: true, value: result.value.tokens[0] };
  }

  private localizeMany(
    tokens: readonly string[],
    locale: OperatorLocale,
  ):
    | { readonly ok: true; readonly value: readonly OperatorLocalizedToken[] }
    | { readonly ok: false; readonly error: FirstPaperSessionFinalReadinessVerdictFailure } {
    if (tokens.length === 0) {
      return { ok: true, value: Object.freeze([]) };
    }

    const result = this.localization.localize({
      locale,
      tokens,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: this.failure('LOCALIZATION_FAILED', 'LOCALIZATION', result.error.message),
      };
    }

    return { ok: true, value: result.value.tokens };
  }

  private failure(
    code: FirstPaperSessionFinalReadinessVerdictFailure['code'],
    stage: FirstPaperSessionFinalReadinessVerdictFailure['stage'],
    message: string,
  ): FirstPaperSessionFinalReadinessVerdictFailure {
    return Object.freeze({ code, stage, message });
  }
}
