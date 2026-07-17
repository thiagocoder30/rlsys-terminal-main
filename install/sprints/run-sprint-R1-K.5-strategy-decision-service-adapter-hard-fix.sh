#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.5"
echo "StrategyDecisionService Adapter Hard Fix PART A"
echo "=================================================="

FILE="src/application/decision/StrategyDecisionService.ts"

python3 <<'PY'
from pathlib import Path

file = Path("src/application/decision/StrategyDecisionService.ts")

text = file.read_text()

text = text.replace(
"""    this.rankingService.evaluate([
      rankingCandidate
    ]);
""",
"""    this.rankingService.evaluate({
      strategies: [
        rankingCandidate
      ]
    });
"""
)

file.write_text(text)

print("[OK] Ranking adapter corrigido")
PY

echo "=================================================="
echo "PART A COMPLETE"
echo "=================================================="

cat >> install/sprints/run-sprint-R1-K.5-strategy-decision-service-adapter-hard-fix.sh <<'SH'

python3 <<'PY'
from pathlib import Path
import re

file = Path("src/application/decision/StrategyDecisionService.ts")

text = file.read_text()


def replace_method(source, name, body):
    pattern = (
        r"  private "
        + re.escape(name)
        + r"\([\s\S]*?\n  }\n"
    )

    result, count = re.subn(
        pattern,
        body + "\n",
        source,
        count=1
    )

    if count == 0:
        raise Exception(
            f"Método não encontrado: {name}"
        )

    return result


text = replace_method(
    text,
    "safeBenchmark",
"""  private safeBenchmark(
    values: readonly number[]
  ): BenchmarkDecisionSnapshot {

    try {

      const report =
        this.benchmarkService.evaluate(
          [...values]
        );

      return {
        verdict:
          report.status,

        benchmarkScore:
          report.executiveSummary.benchmarkScore ?? 0,

        relativeEdge:
          report.executiveSummary.relativeEdge ?? 0,

        baselineDominanceRisk:
          report.executiveSummary.baselineDominanceRisk ?? 1,

        beatRateByCandidate:
          report.benchmark?.randomBaseline?.beatRateByCandidate ?? 0
      };

    } catch {

      return {
        verdict: 'UNAVAILABLE',
        benchmarkScore: 0,
        relativeEdge: 0,
        baselineDominanceRisk: 1,
        beatRateByCandidate: 0
      };

    }
  }"""
)


text = replace_method(
    text,
    "safeCapital",
"""  private safeCapital(
    values: readonly number[]
  ): CapitalDecisionSnapshot {

    try {

      const report =
        this.capitalService.evaluate(
          [...values]
        );

      const summary =
        report.analysis?.summary;

      return {
        reviewStatus:
          report.status,

        ruinProbability:
          summary?.advancedRiskOfRuin?.probability ?? 1,

        worstDrawdown:
          summary?.worstDrawdown ?? 1,

        exposureSaturation:
          summary?.maxExposureSaturation ?? 1,

        circuitBreakerCount:
          summary?.governance?.circuitBreakers?.length ?? 0
      };

    } catch {

      return {
        reviewStatus: 'UNAVAILABLE',
        ruinProbability: 1,
        worstDrawdown: 1,
        exposureSaturation: 1,
        circuitBreakerCount: 0
      };

    }
  }"""
)


file.write_text(text)

print("[OK] Adapter PART B aplicado")
PY


echo "=================================================="
echo "PART B COMPLETE"
echo "=================================================="

SH

python3 <<'PY'
from pathlib import Path
import re

file = Path("src/application/decision/StrategyDecisionService.ts")

text = file.read_text()


def replace_method(source, name, body):
    pattern = (
        r"  private "
        + re.escape(name)
        + r"\([\s\S]*?\n  }\n"
    )

    result, count = re.subn(
        pattern,
        body + "\n",
        source,
        count=1
    )

    if count == 0:
        raise Exception(
            f"Método não encontrado: {name}"
        )

    return result


text = replace_method(
    text,
    "safeBenchmark",
"""  private safeBenchmark(
    values: readonly number[]
  ): BenchmarkDecisionSnapshot {

    try {

      const report =
        this.benchmarkService.evaluate(
          [...values]
        );

      return {
        verdict:
          report.status,

        benchmarkScore:
          report.executiveSummary.benchmarkScore ?? 0,

        relativeEdge:
          report.executiveSummary.relativeEdge ?? 0,

        baselineDominanceRisk:
          report.executiveSummary.baselineDominanceRisk ?? 1,

        beatRateByCandidate:
          report.benchmark?.randomBaseline?.beatRateByCandidate ?? 0
      };

    } catch {

      return {
        verdict: 'UNAVAILABLE',
        benchmarkScore: 0,
        relativeEdge: 0,
        baselineDominanceRisk: 1,
        beatRateByCandidate: 0
      };

    }
  }"""
)


text = replace_method(
    text,
    "safeCapital",
"""  private safeCapital(
    values: readonly number[]
  ): CapitalDecisionSnapshot {

    try {

      const report =
        this.capitalService.evaluate(
          [...values]
        );

      const summary =
        report.analysis?.summary;

      return {
        reviewStatus:
          report.status,

        ruinProbability:
          summary?.advancedRiskOfRuin?.probability ?? 1,

        worstDrawdown:
          summary?.worstDrawdown ?? 1,

        exposureSaturation:
          summary?.maxExposureSaturation ?? 1,

        circuitBreakerCount:
          summary?.governance?.circuitBreakers?.length ?? 0
      };

    } catch {

      return {
        reviewStatus: 'UNAVAILABLE',
        ruinProbability: 1,
        worstDrawdown: 1,
        exposureSaturation: 1,
        circuitBreakerCount: 0
      };

    }
  }"""
)


file.write_text(text)

print("[OK] Adapter PART B aplicado")
PY


echo "=================================================="
echo "PART B COMPLETE"
echo "=================================================="

