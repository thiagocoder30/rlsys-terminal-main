#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.6.2"
echo "Warmup Contract Final Mapping"
echo "=================================================="


python3 <<'PY'
from pathlib import Path

path = Path("src/application/decision/StrategyDecisionService.ts")

text = path.read_text()

text = text.replace(
"""      completeness:
        warmup.warmup?.completeness ?? 0,

      normalizedEntropy:
        warmup.warmup?.normalizedEntropy ?? 1,

      thirdLawDeviation:
        warmup.warmup?.thirdLawDeviation ?? 1,

      maxNumberConcentration:
        warmup.warmup?.maxNumberConcentration ?? 1""",
"""      completeness:
        warmup.warmup?.sample.completeness ?? 0,

      normalizedEntropy:
        warmup.warmup?.metrics.normalizedEntropy ?? 1,

      thirdLawDeviation:
        warmup.warmup?.metrics.thirdLawDeviation ?? 1,

      maxNumberConcentration:
        warmup.warmup?.metrics.maxNumberConcentration ?? 1"""
)

path.write_text(text)

PY


echo "=================================================="
echo "Warmup mapping corrected"
echo "=================================================="


npx tsc --noEmit


echo "=================================================="
echo "R1-K.6.2 COMPLETE"
echo "=================================================="

