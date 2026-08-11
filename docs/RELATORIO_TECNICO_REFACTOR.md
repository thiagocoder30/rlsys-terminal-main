# Relatório Técnico — Refatoração RL.SYS Core

## Status entregue

A refatoração transformou o projeto em uma base mais estável, modular e auditável. O build TypeScript foi validado com sucesso via `npm run build` no ambiente de análise após instalação das dependências com scripts nativos desativados.

> Observação: a dependência `sqlite3` exige binário nativo. Em ambientes sem internet ou sem headers do Node, `npm install` pode falhar durante o build nativo. Em ambiente normal, use `npm install`. Se estiver em ambiente restrito, use `npm install --ignore-scripts` apenas para validação de TypeScript.

## Alterações principais

### 1. Servidor HTTP institucional

Arquivo refeito: `src/infrastructure/http/Server.ts`

- Criada classe `Server` real com `start()` e `stop()`.
- Endpoints padronizados:
  - `GET /health`
  - `POST /api/strategy/analyze`
  - `POST /api/vision/analyze`
  - `POST /upload-history` mantido para compatibilidade.
- Aceita payloads com `history`, `values` ou `sequencia`.
- Suporte a upload de imagem com `multer`.
- Respostas padronizadas com `status`, `reason`, `metrics`, `signals`, `risk` e `capital`.

### 2. Motor estatístico separado

Arquivo novo: `src/domain/services/RouletteStats.ts`

Inclui:

- Validação de números de roleta europeia: somente inteiros de 0 a 36.
- Entropia de Shannon.
- Entropia normalizada.
- Chi-square descritivo.
- Hot/cold numbers por z-score.
- Estatísticas por setores clássicos:
  - voisins
  - tiers
  - orphelins
- Transição simples por setor para análise tipo Markov.

### 3. Estratégia conservadora e auditável

Arquivo refeito: `src/domain/services/StrategyEngine.ts`

Mudanças:

- Mínimo institucional de 120 giros válidos.
- Não libera aposta quando não há sinal estatístico mínimo.
- Remove a confiança falsa baseada em `edge` hardcoded.
- Calcula sizing conservador com proxy de confiança e teto de 1% da banca.
- Expõe `suggestedFraction` e `bankroll` para compatibilidade.
- Inclui warnings explícitos contra amostra pequena, entropia alta e ausência de sinal.

### 4. Correções de integração

- `src/main.ts` agora instancia corretamente `Server`, `GeminiAdapter` e repositório.
- Corrigido erro anterior de `analysis.bankroll` inexistente.
- Removidos imports com aliases `@domain/*` que quebrariam em runtime Node comum.
- `ProcessSignalsUseCase` agora usa `crypto.randomUUID()` em vez de `uuid`, evitando risco de incompatibilidade CJS/ESM.
- Frontend `index.html` atualizado para consumir a resposta nova da API.

## Como rodar

```bash
npm install
npm run build
npm start
```

Teste rápido:

```bash
curl http://localhost:3000/health
```

Análise manual:

```bash
curl -X POST http://localhost:3000/api/strategy/analyze \
  -H 'Content-Type: application/json' \
  -d '{"bankroll":1000,"history":[0,1,2,3]}'
```

Com menos de 120 giros, a resposta correta é `DENIED` por amostra insuficiente.

## Limite estatístico importante

Mesmo com a refatoração, o sistema não deve ser tratado como prova de vantagem contra a roleta. A próxima etapa institucional deve incluir:

1. Backtest com histórico real grande.
2. Walk-forward validation.
3. Monte Carlo para drawdown e risco de ruína.
4. Comparação contra baseline aleatório.
5. Relatório de ROI líquido considerando regras reais de pagamento.
6. Separação entre detecção de padrão e decisão operacional.

## Próximos módulos recomendados

- `BacktestEngine`
- `MonteCarloRiskEngine`
- `BankrollPolicy`
- `AuditLogRepository`
- `StrategyConfigRepository`
- Testes automatizados com Vitest/Jest
- Dockerfile institucional
- CI com lint, build e testes
