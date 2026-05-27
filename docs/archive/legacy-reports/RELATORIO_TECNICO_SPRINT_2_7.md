# RELATORIO TECNICO - SPRINT 2.7

## Objetivo
Conectar o core quantitativo ao fluxo real de operador por meio de warm-up das últimas 100 rodadas, normalização de OCR e gate inicial de mesa.

## Entregas
- `WarmupSessionAnalyzer`
- `VisionWarmupNormalizer`
- `WarmupSessionService`
- Endpoint `/api/session/warmup/evaluate`
- Endpoint `/api/vision/warmup/analyze`
- Gate GO_RESEARCH / OBSERVE / NO_GO
- Gate operacional permanentemente bloqueado nesta fase
- Métricas de entropia, Lei do Terço, concentração, repetição e exposição setorial

## Governança
A Sprint classifica o terreno da mesa, mas não autoriza apostas. O resultado serve como insumo para o futuro Strategy Decision Engine.
