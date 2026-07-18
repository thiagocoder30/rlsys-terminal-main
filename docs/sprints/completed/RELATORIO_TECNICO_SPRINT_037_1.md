# Sprint 037.1 — Replay Persistence & Runtime Recorder

## Objetivo

Converter o Replay Studio em uma caixa-preta persistente e segura para sessões longas, sem crescimento linear de memória.

## Entregas

- SessionReplayStudio com memória O(1)
- JsonLinesReplayRepository append-only
- RuntimeReplayRecorder para wiring futuro com o LiveSessionCoordinator
- Testes de persistência JSONL
- Atualização do teste legado que esperava array em RAM

## Governança

O Replay Studio não autoriza decisões. Ele registra causalidade operacional para auditoria, Paper Trading e pós-morte de eventos NO_GO, REVIEW, FREEZE, LOCKED e BLOCKED.

## Complexidade

- Append de evento: O(1)
- Memória do Studio: O(1), limitada a último verdict e contadores por enum
- Histórico completo: persistido em disco via JSONL
