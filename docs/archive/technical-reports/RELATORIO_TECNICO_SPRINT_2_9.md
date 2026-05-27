# RELATÓRIO TÉCNICO — SPRINT 2.9

## Objetivo
Adicionar o Live Session Runtime Engine para processar rodadas uma a uma com estado incremental, idempotência e baixa pressão de memória.

## Decisão arquitetural
O núcleo `LiveSessionRuntime` foi implementado no domínio, sem dependência de Express, serviços HTTP ou APIs externas. A camada `LiveSessionRuntimeService` adapta eventos de sessão ao domínio e invoca o `StrategyDecisionService` apenas quando o warm-up mínimo está completo.

## Entregas
- Ingestão incremental de rodada ao vivo.
- Cache de idempotência por `eventId`.
- Janela de histórico limitada para Helio P22 / 2GB RAM.
- Snapshot operacional da sessão.
- Métricas rolling de entropia, concentração e repetição.
- Endpoint `POST /api/session/live/round`.
- Endpoint `GET /api/session/live/:sessionId`.
- Integração com Strategy Decision Engine após 100 rodadas.

## Governança
A execução real continua bloqueada. Mesmo quando a decisão é calculada, `operationalGate` permanece `BLOCKED`.
