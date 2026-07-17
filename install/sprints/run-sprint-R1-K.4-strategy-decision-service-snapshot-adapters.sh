#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.4"
echo "StrategyDecisionService Snapshot Adapter Layer"
echo "=================================================="


FILE="src/application/decision/StrategyDecisionService.ts"

if [ ! -f "$FILE" ]; then
  echo "[ERROR] Arquivo não encontrado: $FILE"
  exit 1
fi


python3 - <<'PY'
from pathlib import Path

path = Path("src/application/decision/StrategyDecisionService.ts")

content = path.read_text()


content = content.replace(
"""    this.rankingService.evaluate([
      rankingCandidate
    ]);""",
"""    this.rankingService.evaluate({
      strategies: [
        rankingCandidate
      ]
    });"""
)


old = """  private safeBenchmark(
    values: readonly number[]
  ): BenchmarkDecisionSnapshot {

    return this.benchmarkService.evaluate(
      values
    );
  }"""


new = """  private safeBenchmark(
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
          report.executiveSummary.benchmarkScore,

        relativeEdge:
          report.executiveSummary.relativeEdge,

        baselineDominanceRisk:
          report.executiveSummary.baselineDominanceRisk,

        beatRateByCandidate:
          report.benchmark?.randomBaseline?.beatRateByCandidate
          ?? 0
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


if old in content:
    content = content.replace(old, new)


old = """  private safeCapital(
    values: readonly number[]
  ): CapitalDecisionSnapshot {

    return this.capitalService.evaluate(
      values
    );
  }"""


new = """  private safeCapital(
    values: readonly number[]
  ): CapitalDecisionSnapshot {

    try {

      const report =
        this.capitalService.evaluate(
          [...values]
        );

      const analysis =
        report.analysis;

      return {

        reviewStatus:
          report.status,

        ruinProbability:
          analysis?.summary?.advancedRiskOfRuin?.probability
          ?? 1,

        worstDrawdown:
          analysis?.summary?.worstDrawdown
          ?? 1,

        exposureSaturation:
          analysis?.summary?.maxExposureSaturation
          ?? 1,

        circuitBreakerCount:
          analysis?.summary?.governance?.circuitBreakers?.length
          ?? 0

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


if old in content:
    content = content.replace(old, new)


path.write_text(content)

print("StrategyDecisionService adapter layer PART A aplicado.")
PY


echo "=================================================="
echo "PART A COMPLETE"
echo "=================================================="

cat >> install/sprints/run-sprint-R1-K.4-strategy-decision-service-snapshot-adapters.sh <<'SH'

python3 - <<'PY'
from pathlib import Path

path = Path("src/application/decision/StrategyDecisionService.ts")

content = path.read_text()


old = """  private safeMonteCarlo(
    values: readonly number[]
  ): MonteCarloDecisionSnapshot {

    return this.monteCarloService.evaluate(
      values
    );
  }"""


new = """  private safeMonteCarlo(
    values: readonly number[]
  ): MonteCarloDecisionSnapshot {

    try {

      const report =
        this.monteCarloService.evaluate(
          [...values]
        );

      const analysis =
        report.analysis;

      return {

        reviewStatus:
          report.status,

        robustnessScore:
          analysis?.summary?.robustnessScore
          ?? 0,

        ruinProbability:
          analysis?.summary?.ruinProbability
          ?? 1,

        p95MaxDrawdown:
          analysis?.summary?.p95MaxDrawdown
          ?? 1,

        sequenceDependencyRisk:
          analysis?.summary?.sequenceDependencyRisk
          ?? 1,

        tailRisk:
          analysis?.summary?.tailRisk
          ?? 'UNAVAILABLE'

      };

    } catch {

      return {

        reviewStatus: 'UNAVAILABLE',

        robustnessScore: 0,

        ruinProbability: 1,

        p95MaxDrawdown: 1,

        sequenceDependencyRisk: 1,

        tailRisk: 'UNAVAILABLE'

      };

    }
  }"""


if old in content:
    content = content.replace(old, new)


old = """  private mapWarmup(
    warmup: WarmupSessionServiceReport
  ): WarmupDecisionSnapshot {

    return {

      tableGate:
        warmup.tableGate,

      riskLabel:
        warmup.riskLabel,

      completeness:
        warmup.completeness,

      normalizedEntropy:
        warmup.normalizedEntropy,

      thirdLawDeviation:
        warmup.thirdLawDeviation,

      maxNumberConcentration:
        warmup.maxNumberConcentration

    };

  }"""


new = """  private mapWarmup(
    warmup: WarmupSessionServiceReport
  ): WarmupDecisionSnapshot {

    const source =
      warmup as any;

    return {

      tableGate:
        source.tableGate
        ?? source.operationalGate
        ?? 'NO_GO',

      riskLabel:
        source.riskLabel
        ?? source.risk?.level
        ?? 'CRITICAL',

      completeness:
        source.completeness
        ?? source.metrics?.completeness
        ?? 0,

      normalizedEntropy:
        source.normalizedEntropy
        ?? source.metrics?.normalizedEntropy
        ?? 1,

      thirdLawDeviation:
        source.thirdLawDeviation
        ?? source.metrics?.thirdLawDeviation
        ?? 1,

      maxNumberConcentration:
        source.maxNumberConcentration
        ?? source.metrics?.maxNumberConcentration
        ?? 1

    };

  }"""


if old in content:
    content = content.replace(old, new)


path.write_text(content)

print("StrategyDecisionService adapter layer PART B aplicado.")
PY


echo "=================================================="
echo "R1-K.4 SNAPSHOT ADAPTERS COMPLETE"
echo "=================================================="

SH

python3 - <<'PY'
from pathlib import Path

path = Path("src/application/decision/StrategyDecisionService.ts")

content = path.read_text()


old = """  private safeMonteCarlo(
    values: readonly number[]
  ): MonteCarloDecisionSnapshot {

    return this.monteCarloService.evaluate(
      values
    );
  }"""


new = """  private safeMonteCarlo(
    values: readonly number[]
  ): MonteCarloDecisionSnapshot {

    try {

      const report =
        this.monteCarloService.evaluate(
          [...values]
        );

      const analysis =
        report.analysis;

      return {

        reviewStatus:
          report.status,

        robustnessScore:
          analysis?.summary?.robustnessScore
          ?? 0,

        ruinProbability:
          analysis?.summary?.ruinProbability
          ?? 1,

        p95MaxDrawdown:
          analysis?.summary?.p95MaxDrawdown
          ?? 1,

        sequenceDependencyRisk:
          analysis?.summary?.sequenceDependencyRisk
          ?? 1,

        tailRisk:
          analysis?.summary?.tailRisk
          ?? 'UNAVAILABLE'

      };

    } catch {

      return {

        reviewStatus: 'UNAVAILABLE',

        robustnessScore: 0,

        ruinProbability: 1,

        p95MaxDrawdown: 1,

        sequenceDependencyRisk: 1,

        tailRisk: 'UNAVAILABLE'

      };

    }
  }"""


if old in content:
    content = content.replace(old, new)


old = """  private mapWarmup(
    warmup: WarmupSessionServiceReport
  ): WarmupDecisionSnapshot {

    return {

      tableGate:
        warmup.tableGate,

      riskLabel:
        warmup.riskLabel,

      completeness:
        warmup.completeness,

      normalizedEntropy:
        warmup.normalizedEntropy,

      thirdLawDeviation:
        warmup.thirdLawDeviation,

      maxNumberConcentration:
        warmup.maxNumberConcentration

    };

  }"""


new = """  private mapWarmup(
    warmup: WarmupSessionServiceReport
  ): WarmupDecisionSnapshot {

    const source =
      warmup as any;

    return {

      tableGate:
        source.tableGate
        ?? source.operationalGate
        ?? 'NO_GO',

      riskLabel:
        source.riskLabel
        ?? source.risk?.level
        ?? 'CRITICAL',

      completeness:
        source.completeness
        ?? source.metrics?.completeness
        ?? 0,

      normalizedEntropy:
        source.normalizedEntropy
        ?? source.metrics?.normalizedEntropy
        ?? 1,

      thirdLawDeviation:
        source.thirdLawDeviation
        ?? source.metrics?.thirdLawDeviation
        ?? 1,

      maxNumberConcentration:
        source.maxNumberConcentration
        ?? source.metrics?.maxNumberConcentration
        ?? 1

    };

  }"""


if old in content:
    content = content.replace(old, new)


path.write_text(content)

print("StrategyDecisionService adapter layer PART B aplicado.")
PY


echo "=================================================="
echo "R1-K.4 SNAPSHOT ADAPTERS COMPLETE"
echo "=================================================="

