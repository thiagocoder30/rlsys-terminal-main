#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "[SPRINT 401] STRATEGY REGISTRY ENTERPRISE START"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

mkdir -p "$ROOT_DIR/src/domain/strategy"

REGISTRY_FILE="$ROOT_DIR/src/domain/strategy/StrategyRegistry.ts"

cat > "$REGISTRY_FILE" <<'EOF'
export type StrategyName =
  | 'TRIPLICACAO'
  | 'FUSION_REDUZIDA';

export interface StrategyResult {
  score: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface IStrategy {
  name: StrategyName;
  analyze(input: unknown): StrategyResult;
  explain(input: unknown): string;
  confidence(input: unknown): number;
}

export class StrategyRegistry {
  private static strategies: Map<StrategyName, IStrategy> = new Map();

  static register(strategy: IStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  static get(name: StrategyName): IStrategy | undefined {
    return this.strategies.get(name);
  }

  static list(): StrategyName[] {
    return Array.from(this.strategies.keys());
  }

  static execute(name: StrategyName, input: unknown): StrategyResult {
    const strategy = this.strategies.get(name);

    if (!strategy) {
      throw new Error(`[StrategyRegistry] Strategy not found: ${name}`);
    }

    return strategy.analyze(input);
  }

  static explain(name: StrategyName, input: unknown): string {
    const strategy = this.strategies.get(name);

    if (!strategy) {
      throw new Error(`[StrategyRegistry] Strategy not found: ${name}`);
    }

    return strategy.explain(input);
  }
}
EOF

echo "[SPRINT 401] Strategy Registry created at $REGISTRY_FILE"

echo "[SPRINT 401] VALIDATION: checking file existence"

if [ -f "$REGISTRY_FILE" ]; then
  echo "[SPRINT 401] PASS - Registry successfully created"
else
  echo "[SPRINT 401] FAIL - Registry missing"
  exit 1
fi

echo "[SPRINT 401] COMPLETE"
