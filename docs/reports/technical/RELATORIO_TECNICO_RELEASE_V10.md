# RL.SYS Core v1.0.0 — Release de Estabilização Enterprise

## Objetivo
Consolidar a base v0.9.0 em uma release operacional com validação de configuração, prontidão de release, hardening HTTP básico e scripts de produção.

## Entregas
- Versão atualizada para `1.0.0`.
- `ConfigValidator` para bloquear configuração inválida antes do bootstrap.
- `ReleaseReadinessService` para consolidar gates de release.
- Headers HTTP de segurança mínimos via middleware dedicado.
- Endpoints operacionais:
  - `GET /api/system/config` retorna configuração sanitizada, sem segredos.
  - `GET /api/system/release-readiness` retorna status `ready`, `review` ou `blocked`.
- Scripts:
  - `npm run clean`
  - `npm run build:clean`
  - `npm run audit:deps`
  - `npm run release:check`
- Testes novos para configuração, release readiness e security headers.

## Critério de qualidade
A release continua bloqueando decisões sem evidência estatística suficiente. O sistema não deve sugerir exposição real quando os gates de risco, Bayes, regime ou Monte Carlo não sustentarem a decisão.

## Observação operacional
`GEMINI_API_KEY` ausente é tratado como warning, não erro, pois os endpoints estatísticos podem operar sem visão computacional. Endpoints de visão exigem a chave configurada.
