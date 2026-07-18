#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.3"
echo "StrategyDecisionService Adapter Contract Fix"
echo "=================================================="


FILE="src/application/decision/StrategyDecisionService.ts"


python3 <<'PY'

from pathlib import Path

path = Path("src/application/decision/StrategyDecisionService.ts")

content = path.read_text()


content = content.replace(
"""this.rankingService.evaluate([
      rankingCandidate
    ]);""",
"""this.rankingService.evaluate({
      strategies: [
        rankingCandidate
      ]
    });"""
)


content = content.replace(
"""private safeBenchmark(
    values: readonly number[]
  ): BenchmarkDecisionSnapshot {

    try {

      return this.benchmarkService.evaluate(
        values
      );

    } catch {

      return {
        verdict: 'UNAVAILABLE',
        benchmarkScore: 0,
        relativeEdge: 0,
        baselineDominanceRisk: 1,
        beatRateByCandidate: 0
      };

    }
  }""",
"""private safeBenchmark(
    values: readonly number[]
  ): BenchmarkDecisionSnapshot {

    try {

      const report =
        this.benchmarkService.evaluate(
          [...values]
        );

      return {
        verdict: report.verdict,
        benchmarkScore: report.score ?? 0,
        relativeEdge: report.relativeEdge ?? 0,
        baselineDominanceRisk:
          report.baselineDominanceRisk ?? 1,
        beatRateByCandidate:
          report.beatRateByCandidate ?? 0
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


content = content.replace(
"""return this.capitalService.evaluate(
        values
      );""",
"""const report =
        this.capitalService.evaluate(
          [...values]
        );

      return {
        reviewStatus:
          report.reviewStatus ?? 'UNAVAILABLE',
        ruinProbability:
          report.ruinProbability ?? 1,
        worstDrawdown:
          report.worstDrawdown ?? 1,
        exposureSaturation:
          report.exposureSaturation ?? 1,
        circuitBreakerCount:
          report.circuitBreakerCount ?? 0
      };"""
)


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
          report.reviewStatus ?? 'UNAVAILABLE',
        robustnessScore:
          report.robustnessScore ?? 0,
        ruinProbability:
          report.ruinProbability ?? 1,
        p95MaxDrawdown:
          report.p95MaxDrawdown ?? 1,
        sequenceDependencyRisk:
          report.sequenceDependencyRisk ?? 1,
        tailRisk:
          report.tailRisk ?? 'UNAVAILABLE'
      };"""
)


old = """return {
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
    };"""


new = """return {
      tableGate:
        warmup.status === 'READY'
          ? 'GO_RESEARCH'
          : 'OBSERVE',

      riskLabel:
        warmup.riskLabel ?? 'CRITICAL',

      completeness:
        warmup.completeness ?? 0,

      normalizedEntropy:
        warmup.normalizedEntropy ?? 1,

      thirdLawDeviation:
        warmup.thirdLawDeviation ?? 1,

      maxNumberConcentration:
        warmup.maxNumberConcentration ?? 1
    };"""


content = content.replace(old,new)


path.write_text(content)

PY


echo "=================================================="
echo "StrategyDecisionService adapter patch applied"
echo "=================================================="


npx tsc --noEmit || true


echo "Sprint R1-K.3 created."
