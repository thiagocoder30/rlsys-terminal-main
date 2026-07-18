# Sprint 2.6 — Strategy Benchmarking & Random Baseline Validation

## Objetivo
Adicionar uma camada institucional de comparação entre estratégias candidatas e benchmarks simples/aleatórios antes de qualquer motor de decisão operacional.

## Decisão arquitetural
- `StrategyBenchmarkEngine` fica no domínio e não depende de Express, filesystem ou serviços externos.
- Estratégias usam Strategy Pattern para permitir crescimento para dezenas/centenas de estratégias sem alterar o núcleo do benchmark.
- `BenchmarkComparisonService` adapta datasets para o domínio, mantendo Clean Architecture.
- Simulações aleatórias são determinísticas por seed, garantindo idempotência e reprodutibilidade.

## Componentes
- `src/domain/benchmark/StrategyBenchmarkEngine.ts`
- `src/application/backtesting/BenchmarkComparisonService.ts`
- endpoint `/api/backtest/benchmark/evaluate`
- testes unitários para domínio e aplicação

## Complexidade
- Tempo: O(n * s + n * r), onde `n` é o tamanho do histórico, `s` estratégias determinísticas e `r` execuções aleatórias.
- Espaço: O(s + r + trades amostrados), mantendo baixo consumo de memória no Termux/A10s.

## Governança
O gate operacional permanece sempre `BLOCKED`. A Sprint 2.6 mede superioridade relativa contra baselines, mas não autoriza aposta.
