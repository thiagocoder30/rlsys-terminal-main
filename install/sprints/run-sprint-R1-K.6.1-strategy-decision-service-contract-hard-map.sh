#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.6.1"
echo "StrategyDecisionService Contract Hard Mapping"
echo "=================================================="


python3 <<'PY'
from pathlib import Path

path = Path("src/application/decision/StrategyDecisionService.ts")

text = path.read_text()


start = text.index("  private safeMonteCarlo(")
end = text.index("\n\n\n  private mapWarmup(", start)


new_method = r'''  private safeMonteCarlo(
    values: readonly number[]
  ): MonteCarloDecisionSnapshot {

    try {

      const report =
        this.monteCarloService.evaluate(
          [...values]
        );

      return {
        reviewStatus:
          report.status,

        robustnessScore:
          report.executiveSummary.robustnessScore,

        ruinProbability:
          report.executiveSummary.ruinProbability,

        p95MaxDrawdown:
          report.simulation?.summary.p95MaxDrawdown ?? 1,

        sequenceDependencyRisk:
          report.simulation?.summary.sequenceDependencyRisk ?? 1,

        tailRisk:
          report.executiveSummary.tailRisk === 'LOW'
          || report.executiveSummary.tailRisk === 'MODERATE'
          || report.executiveSummary.tailRisk === 'HIGH'
          || report.executiveSummary.tailRisk === 'CRITICAL'
            ? report.executiveSummary.tailRisk
            : 'UNAVAILABLE'
      };

    } catch {

      return {
        reviewStatus:
          'UNAVAILABLE',

        robustnessScore:
          0,

        ruinProbability:
          1,

        p95MaxDrawdown:
          1,

        sequenceDependencyRisk:
          1,

        tailRisk:
          'UNAVAILABLE'
      };
    }
  }
'''

text = text[:start] + new_method + text[end:]


start = text.index("  private mapWarmup(")
end = text.index("\n\n}", start)


new_warmup = r'''  private mapWarmup(
    warmup: WarmupSessionServiceReport
  ): WarmupDecisionSnapshot {

    return {

      tableGate:
        warmup.executiveSummary.tableGate,

      riskLabel:
        warmup.warmup?.riskLabel ?? 'CRITICAL',

      completeness:
        warmup.warmup?.completeness ?? 0,

      normalizedEntropy:
        warmup.warmup?.normalizedEntropy ?? 1,

      thirdLawDeviation:
        warmup.warmup?.thirdLawDeviation ?? 1,

      maxNumberConcentration:
        warmup.warmup?.maxNumberConcentration ?? 1
    };
  }
'''

text = text[:start] + new_warmup + text[end:]

path.write_text(text)

PY


echo "=================================================="
echo "Contract hard mapping applied"
echo "=================================================="


npx tsc --noEmit


echo "=================================================="
echo "R1-K.6.1 COMPLETE"
echo "=================================================="

