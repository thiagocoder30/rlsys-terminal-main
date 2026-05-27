# RL.sys Core v0.8.0 — Enterprise Quantitative Governance

## Objetivo

A v0.8.0 adiciona uma camada institucional de governança quantitativa sobre a v0.7.0. O sistema passa a validar sinais com inferência Bayesiana, detectar regime estatístico e expor um endpoint operacional de saúde da engine.

## Entregas

- `BayesianEdgeValidator`: estima posterior de taxa de acerto, probabilidade de edge positivo, intervalo credível e verdict institucional.
- `RegimeDetector`: segmenta o histórico em janelas móveis e classifica o regime como `RANDOM_LIKE`, `SECTOR_DRIFT`, `TRANSITIONAL` ou `UNSTABLE`.
- `RiskPolicy` v0.8: bloqueia sinais com validação Bayesiana inconclusiva/rejeitada e regimes instáveis.
- `/api/strategy/health`: endpoint de capacidade operacional e limites de risco.
- Auditoria ampliada: registra verdict Bayesiano, probabilidade posterior e regime detectado.
- Testes adicionais para Bayesian Edge e Regime Detection.

## Nota de engenharia

Esta versão não promete vantagem matemática contra a roleta. Ela reduz risco operacional ao impedir que a aplicação trate ruído como sinal sem evidência fora da amostra, validação probabilística e regime estável.

## Comando de validação

```bash
npm run check
```

Critério de aceite: build TypeScript sem erros e suíte `node --test` completa aprovada.
