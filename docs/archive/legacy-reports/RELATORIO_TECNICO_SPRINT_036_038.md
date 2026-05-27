# RL.SYS CORE — Sprint 036 + 038

## Runtime Telemetry Layer + Paper Trading Ledger

### Objetivo

Implementar a caixa-preta institucional do RL.SYS para a fase de Paper Trading.

A Sprint registra decisões teóricas, PnL simulado, saldo teórico, drawdown e métricas de latência sem expor capital real.

### Arquitetura

Camadas criadas:

```txt
Domain Ledger
Infrastructure JSONL Repository
Paper Trading Telemetry
```

### Decisão técnica

O ledger utiliza padrão append-only JSONL. Cada decisão vira uma linha independente, evitando manter histórico inteiro em memória.

O domínio depende de uma interface `IPaperLedgerRepository`, preservando Clean Architecture.

### Governança

A Sprint não autoriza apostas reais.

Ela serve para:

- auditar decisões paper
- medir frequência de NO_GO
- medir PnL teórico
- medir drawdown paper
- preservar rastreabilidade de snapshot
- alimentar replay futuro

### Complexidade

Registro de evento: O(1)

Estado em memória: O(1)

Cold start: leitura do último estado persistido
