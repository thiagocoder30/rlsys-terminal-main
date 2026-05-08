# RL.SYS Core — Refatoração Institucional

## O que foi corrigido

- API estabilizada com classe `Server` real e lifecycle `start/stop`.
- Endpoints padronizados:
  - `GET /health`
  - `POST /api/strategy/analyze`
  - `POST /api/vision/analyze`
  - `POST /upload-history` mantido como compatibilidade.
- Contrato de análise unificado: `history`, `values` ou `sequencia`.
- Validação rígida de roleta europeia: apenas inteiros de `0` a `36`.
- `analysis.bankroll` corrigido para `analysis.suggestedFraction` e também exposto como `bankroll` por compatibilidade.
- Motor estatístico separado em `RouletteStats`.
- Estratégia agora é conservadora por padrão: bloqueia quando não há evidência mínima.
- Registro SQLite preservado para auditoria das análises.

## Filosofia institucional

O sistema não deve afirmar vantagem real sem backtest fora da amostra, simulação Monte Carlo e controle de overfitting. A API agora retorna `LOCKED` quando a evidência estatística é fraca.

## Exemplo

```bash
curl -X POST http://localhost:3000/api/strategy/analyze \
  -H 'Content-Type: application/json' \
  -d '{"bankroll":1000,"history":[0,1,2,3]}'
```

Para decisão real, envie pelo menos 120 giros válidos.
