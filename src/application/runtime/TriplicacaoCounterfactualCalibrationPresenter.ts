import type {
  TriplicacaoCalibrationDistribution,
  TriplicacaoCalibrationScenarioReport,
  TriplicacaoCounterfactualCalibrationReport,
} from './TriplicacaoCounterfactualCalibrationMatrix.js';

import type {
  TriplicacaoJointCalibrationReport,
} from './TriplicacaoJointCounterfactualCalibrationMatrix.js';


export class TriplicacaoCounterfactualCalibrationPresenter {
  public present(
    report:
      TriplicacaoCounterfactualCalibrationReport,

    jointReport?:
      TriplicacaoJointCalibrationReport,
  ): string {
    return [
      '========================================',
      ' RL.SYS — CALIBRAÇÃO CONTRAFACTUAL',
      '========================================',
      '',
      ' ESCOPO',
      '----------------------------------------',
      ` LIVE observados ........ ${report.totalLiveEvents}`,
      ` Eventos avaliáveis ..... ${report.decisionApplicableEvents}`,
      '',
      ' CALIBRAÇÃO ISOLADA',
      '----------------------------------------',
      ...report.scenarios.flatMap(
        (scenario) =>
          this.scenarioLines(
            scenario,
          ),
      ),
      ...(
        jointReport ===
          undefined
          ? []
          : [
              '',
              ' CALIBRAÇÃO CONJUNTA',
              '----------------------------------------',
              ...jointReport.scenarios.flatMap(
                (scenario) =>
                  this.jointScenarioLines(
                    scenario,
                  ),
              ),
            ]
      ),
      '',
      ' DISTRIBUIÇÃO DAS MÉTRICAS',
      '----------------------------------------',
      ...this.distributionLines(
        'Dominância base',
        report.distributions.baseDominance,
        'PERCENT',
      ),
      ...this.distributionLines(
        'Confiança base',
        report.distributions.baseConfidence,
        'RATIO',
      ),
      ...this.distributionLines(
        'Risco base',
        report.distributions.baseRisk,
        'RATIO',
      ),
      ...this.distributionLines(
        'Evidência avançada',
        report.distributions.advancedEvidence,
        'PERCENT',
      ),
      ...this.distributionLines(
        'Confiança avançada',
        report.distributions.advancedConfidence,
        'RATIO',
      ),
      ...this.distributionLines(
        'Risco avançado',
        report.distributions.advancedRisk,
        'RATIO',
      ),
      '',
      ' INTERPRETAÇÃO',
      '----------------------------------------',
      ...this.interpretation(
        report,
        jointReport,
      ),
      '',
      ' Política oficial ...... PRESERVADA',
      ' Natureza .............. SOMENTE CONTRAFACTUAL',
      ' Banca ................. NÃO ALTERADA',
      ' Execução automática ... NÃO',
      '',
      ' Nenhum threshold oficial foi modificado.',
      '========================================',
    ].join(
      '\n',
    );
  }


  private scenarioLines(
    scenario:
      TriplicacaoCalibrationScenarioReport,
  ): string[] {
    return [
      `${scenario.policy.id}${scenario.policy.official ? ' [OFICIAL]' : ''}`,
      ` Política .............. ${scenario.policy.label}`,
      ` Dominância mínima ..... ${this.percentRaw(scenario.policy.baseDominanceMinimum)}`,
      ` Elegíveis ............. ${scenario.counterfactualPaperOnlyEvents}/${scenario.decisionApplicableEvents} (${this.fraction(scenario.counterfactualPaperOnlyFraction)})`,
      ` Falha dominância ...... ${scenario.gateFailures.baseDominance}`,
      ` Falha confiança base .. ${scenario.gateFailures.baseConfidence}`,
      ` Falha risco base ...... ${scenario.gateFailures.baseRisk}`,
      ` Falha evidência adv. .. ${scenario.gateFailures.advancedEvidence}`,
      ` Falha confiança adv. .. ${scenario.gateFailures.advancedConfidence}`,
      ` Falha risco adv. ...... ${scenario.gateFailures.advancedRisk}`,
      '',
    ];
  }


  private jointScenarioLines(
    scenario:
      TriplicacaoCalibrationScenarioReport,
  ): string[] {
    return [
      `${scenario.policy.id}${scenario.policy.official ? ' [OFICIAL]' : ''}`,
      ` Política .............. ${scenario.policy.label}`,
      ` Elegíveis ............. ${scenario.counterfactualPaperOnlyEvents}/${scenario.decisionApplicableEvents} (${this.fraction(scenario.counterfactualPaperOnlyFraction)})`,
      ` Base D >= ............. ${this.percentRaw(scenario.policy.baseDominanceMinimum)}`,
      ` Base C >= ............. ${this.percentRatio(scenario.policy.baseConfidenceMinimum)}`,
      ` Base R <= ............. ${this.percentRatio(scenario.policy.baseRiskMaximum)}`,
      ` Adv. E >= ............. ${this.percentRaw(scenario.policy.advancedEvidenceMinimum)}`,
      ` Adv. C >= ............. ${this.percentRatio(scenario.policy.advancedConfidenceMinimum)}`,
      ` Adv. R <= ............. ${this.percentRatio(scenario.policy.advancedRiskMaximum)}`,
      ` Falha dominância ...... ${scenario.gateFailures.baseDominance}`,
      ` Falha confiança base .. ${scenario.gateFailures.baseConfidence}`,
      ` Falha risco base ...... ${scenario.gateFailures.baseRisk}`,
      ` Falha evidência adv. .. ${scenario.gateFailures.advancedEvidence}`,
      ` Falha confiança adv. .. ${scenario.gateFailures.advancedConfidence}`,
      ` Falha risco adv. ...... ${scenario.gateFailures.advancedRisk}`,
      '',
    ];
  }


  private distributionLines(
    label:
      string,

    distribution:
      TriplicacaoCalibrationDistribution,

    mode:
      'PERCENT' |
      'RATIO',
  ): string[] {
    return [
      label,
      `  n .................... ${distribution.count}`,
      `  mínimo ............... ${this.metric(distribution.minimum, mode)}`,
      `  p25 .................. ${this.metric(distribution.p25, mode)}`,
      `  mediana .............. ${this.metric(distribution.median, mode)}`,
      `  p75 .................. ${this.metric(distribution.p75, mode)}`,
      `  máximo ............... ${this.metric(distribution.maximum, mode)}`,
      `  média ................ ${this.metric(distribution.mean, mode)}`,
      '',
    ];
  }


  private interpretation(
    report:
      TriplicacaoCounterfactualCalibrationReport,

    jointReport:
      TriplicacaoJointCalibrationReport |
      undefined,
  ): string[] {
    const official =
      report.scenarios.find(
        (scenario) =>
          scenario.policy.official,
      );

    const d42 =
      report.scenarios.find(
        (scenario) =>
          scenario.policy.id ===
          'D42_ONLY',
      );

    if (
      jointReport !==
      undefined
    ) {
      const permissive =
        jointReport.scenarios.find(
          (scenario) =>
            scenario.policy.id ===
            'P25_PERMISSIVE',
        );

      const balanced =
        jointReport.scenarios.find(
          (scenario) =>
            scenario.policy.id ===
            'P50_BALANCED',
        );

      const empirical =
        jointReport.scenarios.find(
          (scenario) =>
            scenario.policy.id ===
            'EMPIRICAL_STEP',
        );

      const selective =
        jointReport.scenarios.find(
          (scenario) =>
            scenario.policy.id ===
            'P75_SELECTIVE',
        );

      const jointEligible =
        [
          permissive,
          balanced,
          empirical,
          selective,
        ].filter(
          (
            scenario,
          ) =>
            scenario !==
              undefined &&
            scenario
              .counterfactualPaperOnlyEvents >
              0,
        );

      if (
        jointEligible.length >
        0
      ) {
        return [
          ' A calibração conjunta encontrou regiões alcançáveis pelas métricas observadas.',
          ' Esses eventos ainda NÃO representam recomendações oficiais.',
          ' O próximo passo é medir seus resultados prospectivos por settlement contrafactual.',
        ];
      }

      return [
        ' Nenhum cenário conjunto atual liberou eventos.',
        ' Os thresholds marginais ainda não formam uma interseção observável.',
        ' A próxima análise deve considerar a correlação entre as métricas.',
      ];
    }

    if (
      official !==
        undefined &&
      d42 !==
        undefined &&
      official
        .counterfactualPaperOnlyEvents ===
        0 &&
      d42
        .counterfactualPaperOnlyEvents ===
        0
    ) {
      return [
        ' A redução isolada da dominância até 42% não liberou eventos.',
        ' Outros gates continuam impedindo PAPER_ONLY.',
        ' A próxima calibração deve avaliar os thresholds em conjunto.',
      ];
    }

    return [
      ' Utilize as distribuições observadas para orientar a próxima análise.',
    ];
  }


  private metric(
    value:
      number,

    mode:
      'PERCENT' |
      'RATIO',
  ): string {
    return mode ===
      'RATIO'
      ? this.percentRatio(
          value,
        )
      : this.percentRaw(
          value,
        );
  }


  private percentRaw(
    value:
      number,
  ): string {
    return `${value
      .toFixed(1)
      .replace('.', ',')}%`;
  }


  private percentRatio(
    value:
      number,
  ): string {
    return `${(
      value *
      100
    )
      .toFixed(1)
      .replace('.', ',')}%`;
  }


  private fraction(
    value:
      number,
  ): string {
    return this.percentRatio(
      value,
    );
  }
}
