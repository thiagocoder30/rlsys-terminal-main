# RL.SYS CORE v0.9.0 — Observabilidade Enterprise

## Objetivo
Adicionar uma camada operacional institucional para health checks, métricas, logging estruturado e diagnóstico em runtime, mantendo compatibilidade com Termux/Arch/Android.

## Entregas
- `StructuredLogger` com logs JSON e sanitização de campos sensíveis.
- `MetricsRegistry` em memória com counters, timers, uptime e memória do processo.
- `HealthCheckService` com readiness check de runtime e filesystem.
- Middleware de observabilidade para contar requests, latência e erros HTTP.
- Endpoint `/api/strategy/metrics`.
- Endpoint `/api/strategy/readiness`.
- Health endpoint atualizado para v0.9.0.
- Auditoria usando caminho configurável.
- Testes automatizados para logger, métricas e readiness.

## Política Enterprise
A v0.9.0 não altera a filosofia de segurança: sinais continuam bloqueados quando não existe evidência estatística suficiente. Esta versão melhora a operação, monitoramento e rastreabilidade do sistema.

## Validação
Executar:

```bash
npm run check
```

Critério de aceite: build TypeScript OK e suíte de testes completa aprovada.
