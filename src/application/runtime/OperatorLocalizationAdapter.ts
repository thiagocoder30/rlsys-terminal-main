export type OperatorLocale = 'pt-BR';

export interface OperatorLocalizationInput {
  readonly locale: OperatorLocale;
  readonly tokens: readonly string[];
}

export interface OperatorLocalizedToken {
  readonly token: string;
  readonly label: string;
  readonly description: string;
}

export interface OperatorLocalizationReport {
  readonly locale: OperatorLocale;
  readonly tokens: readonly OperatorLocalizedToken[];
  readonly unknownTokens: readonly string[];
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface OperatorLocalizationFailure {
  readonly code: 'INVALID_OPERATOR_LOCALIZATION_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type OperatorLocalizationResult =
  | { readonly ok: true; readonly value: OperatorLocalizationReport }
  | { readonly ok: false; readonly error: OperatorLocalizationFailure };

/**
 * Localizes institutional runtime tokens into operator-friendly Portuguese.
 *
 * Domain enums remain stable in English. This adapter only translates labels
 * and explanations for the human operator.
 *
 * Complexity:
 * - Time: O(n), where n is the number of tokens.
 * - Space: O(n), because localized tokens are materialized.
 */
export class OperatorLocalizationAdapter {
  private readonly ptBrDictionary: ReadonlyMap<string, OperatorLocalizedToken> = new Map([
    this.entry('PAPER_FAVORAVEL', 'Favorável', 'O contexto está favorável para considerar uma entrada manual supervisionada.'),
    this.entry('OBSERVAR', 'Aguardar', 'O contexto ainda não confirmou qualidade suficiente. Aguarde novo giro.'),
    this.entry('NAO_UTILIZAR', 'Não utilizar', 'O contexto atual não recomenda o uso da estratégia.'),
    this.entry('FAVORAVEL', 'Favorável', 'O sistema identificou uma condição positiva para a estratégia.'),
    this.entry('AGUARDAR', 'Aguardar', 'A melhor decisão operacional é esperar nova confirmação.'),
    this.entry('NAO_UTILIZAR', 'Não utilizar', 'A estratégia não está qualificada neste momento.'),

    this.entry('READY_FOR_FIRST_PAPER_SESSION', 'Pronto para primeira sessão PAPER', 'O protocolo permite iniciar a primeira sessão PAPER supervisionada.'),
    this.entry('WARMUP_REQUIRED', 'Warmup obrigatório', 'Ainda é necessário observar mais giros antes de iniciar a sessão.'),
    this.entry('SESSION_LIMIT_REACHED', 'Limite da sessão atingido', 'A sessão chegou ao limite operacional e deve ser encerrada.'),
    this.entry('SESSION_BLOCKED', 'Sessão bloqueada', 'Existem bloqueios que impedem iniciar ou continuar a sessão.'),

    this.entry('BUNDLE_READY', 'Pacote operacional pronto', 'O pacote operacional está pronto para uso supervisionado.'),
    this.entry('BUNDLE_WARMUP_REQUIRED', 'Pacote aguardando warmup', 'O pacote foi gerado, mas o warmup ainda precisa ser concluído.'),
    this.entry('BUNDLE_BLOCKED', 'Pacote bloqueado', 'O pacote possui bloqueios operacionais.'),
    this.entry('BUNDLE_SESSION_LIMIT_REACHED', 'Pacote em encerramento', 'O pacote indica que a sessão deve ser encerrada.'),

    this.entry('GUIDED_PACKAGE_READY', 'Pacote guiado pronto', 'O operador pode seguir o pacote guiado para a sessão PAPER.'),
    this.entry('GUIDED_PACKAGE_WARMUP_REQUIRED', 'Pacote guiado aguardando warmup', 'O operador deve concluir o warmup antes de iniciar.'),
    this.entry('GUIDED_PACKAGE_BLOCKED', 'Pacote guiado bloqueado', 'O operador deve resolver bloqueios antes de iniciar.'),
    this.entry('GUIDED_PACKAGE_SESSION_LIMIT_REACHED', 'Pacote guiado em encerramento', 'O operador deve encerrar e revisar a sessão.'),

    this.entry('WARMUP_MINIMO_NAO_CONCLUIDO', 'Warmup mínimo não concluído', 'A quantidade mínima de giros observados ainda não foi atingida.'),
    this.entry('RISCO_ELEVADO_EXCESSIVO_NA_SESSAO', 'Risco elevado excessivo', 'A sessão teve quantidade excessiva de recomendações com risco elevado.'),
    this.entry('OPERADOR_NAO_CONFIRMOU_MODO_MANUAL', 'Modo manual não confirmado', 'O operador precisa confirmar que a operação será manual.'),
    this.entry('OPERADOR_NAO_CONFIRMOU_AUSENCIA_DE_INTEGRACAO_EXTERNA', 'Ausência de integração externa não confirmada', 'O operador precisa confirmar que não há integração externa com plataforma.'),
    this.entry('OPERADOR_NAO_CONFIRMOU_REGISTRO_PAPER', 'Registro PAPER não confirmado', 'O operador precisa confirmar que registrará a sessão em modo PAPER.'),
    this.entry('CONFIANCA_MEDIA_ABAIXO_DO_MINIMO_RECOMENDADO', 'Confiança média abaixo do recomendado', 'A confiança média da sessão está abaixo do mínimo recomendado.'),
    this.entry('LIMITE_DE_RECOMENDACOES_FAVORAVEIS_PROXIMO_DO_EXCESSO_OPERACIONAL', 'Muitas recomendações favoráveis', 'Há risco de excesso operacional; o operador deve manter disciplina.'),

    this.entry('TC', 'Triplicação Contínua', 'Trio com três cores iguais.'),
    this.entry('NTC', 'Não Triplicação Contínua', 'Início e confirmação iguais, com finalização diferente.'),
    this.entry('TA', 'Triplicação Alternada', 'Trio alternado entre cores.'),
    this.entry('NTA', 'Não Triplicação Alternada', 'Início diferente, com confirmação e finalização iguais.'),
    this.entry('ZERO_DISCARDED', 'Zero descartado', 'O giro com zero foi descartado pela regra da estratégia.'),
    this.entry('INSUFFICIENT_DATA', 'Dados insuficientes', 'Ainda não há dados suficientes para qualificar a estratégia.'),
  ]);

  public localize(input: OperatorLocalizationInput): OperatorLocalizationResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const tokens: OperatorLocalizedToken[] = [];
    const unknownTokens: string[] = [];

    for (const rawToken of input.tokens) {
      const token = rawToken.trim();
      const localized = this.ptBrDictionary.get(token);

      if (typeof localized === 'undefined') {
        unknownTokens.push(token);
        tokens.push(Object.freeze({
          token,
          label: this.humanize(token),
          description: 'Token ainda não possui tradução institucional cadastrada.',
        }));
      } else {
        tokens.push(localized);
      }
    }

    return {
      ok: true,
      value: Object.freeze({
        locale: input.locale,
        tokens: Object.freeze(tokens),
        unknownTokens: Object.freeze(unknownTokens),
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  public localizeOne(token: string, locale: OperatorLocale = 'pt-BR'): OperatorLocalizationResult {
    return this.localize({
      locale,
      tokens: [token],
    });
  }

  private validate(input: OperatorLocalizationInput): OperatorLocalizationFailure | null {
    if (input.locale !== 'pt-BR') {
      return this.failure('locale must be pt-BR');
    }

    if (!Array.isArray(input.tokens)) {
      return this.failure('tokens must be an array');
    }

    for (let index = 0; index < input.tokens.length; index += 1) {
      const token = input.tokens[index];
      if (typeof token !== 'string' || token.trim().length === 0) {
        return this.failure(`token at index ${index} must be a non-empty string`);
      }
    }

    return null;
  }

  private entry(token: string, label: string, description: string): readonly [string, OperatorLocalizedToken] {
    return [
      token,
      Object.freeze({
        token,
        label,
        description,
      }),
    ] as const;
  }

  private humanize(token: string): string {
    const lower = token.toLowerCase().replace(/_/g, ' ');
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  private failure(message: string): OperatorLocalizationFailure {
    return Object.freeze({
      code: 'INVALID_OPERATOR_LOCALIZATION_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
