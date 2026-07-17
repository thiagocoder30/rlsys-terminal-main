#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.6"
echo "StrategyDecisionService Contract Mapping Layer"
echo "=================================================="

FILE="src/application/decision/StrategyDecisionService.ts"

if [ ! -f "$FILE" ]; then
  echo "[ERROR] Arquivo não encontrado: $FILE"
  exit 1
fi

python3 <<'PY'
from pathlib import Path

path = Path("src/application/decision/StrategyDecisionService.ts")

content = path.read_text()

content = content.replace(
"""return this.monteCarloService.evaluate(
        values
      );""",
"""const report =
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
      };"""
)

content = content.replace(
"""warmup.tableGate,
        warmup.riskLabel,
        warmup.completeness,
        warmup.normalizedEntropy,
        warmup.thirdLawDeviation,
        warmup.maxNumberConcentration""",
"""warmup.executiveSummary.tableGate,
        warmup.warmup?.riskLabel ?? 'CRITICAL',
        warmup.warmup?.completeness ?? 0,
        warmup.warmup?.normalizedEntropy ?? 1,
        warmup.warmup?.thirdLawDeviation ?? 1,
        warmup.warmup?.maxNumberConcentration ?? 1"""
)

path.write_text(content)

PY

echo "=================================================="
echo "StrategyDecisionService contract mapping applied"
echo "=================================================="

npx tsc --noEmit

echo "=================================================="
echo "R1-K.6 COMPLETE"
echo "=================================================="

