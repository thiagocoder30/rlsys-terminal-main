# Relatório Técnico — Otimização Institucional v0.6.0

## Objetivo
Elevar o projeto de uma base funcional para uma arquitetura mais robusta, testável e segura para tomada de decisão quantitativa.

## Alterações implementadas

### 1. Remoção de dependência nativa problemática no Termux
- Removidos `sqlite` e `sqlite3` do `package.json`.
- Criada persistência `JsonlSignalRepository` em `src/infrastructure/database/JsonlSignalRepository.ts`.
- Motivo: `sqlite3` exige compilação nativa e costuma falhar em Android/Termux/Arch sem headers e toolchain completos.
- Novo padrão: append-only JSONL em `data/signals.jsonl`.

### 2. Backtest walk-forward
- Criado `src/domain/services/BacktestEngine.ts`.
- O motor simula decisões fora da amostra usando janelas progressivas.
- Métricas geradas:
  - trades
  - wins/losses
  - hit rate
  - ROI
  - max drawdown
  - expectancy por trade
  - equity final

### 3. Política institucional de risco
- Criado `src/domain/services/RiskPolicy.ts`.
- Agora uma sugestão estatística não vira stake automaticamente.
- A política bloqueia sinais quando:
  - não há backtest suficiente;
  - há menos de 30 trades walk-forward;
  - ROI ou expectancy não são positivos;
  - drawdown passa de 20%.

### 4. Integração do backtest na API
- `Server.ts` agora executa backtest quando há amostra suficiente.
- A resposta passa a incluir:
  - `backtest`
  - `institutionalRisk`
  - `capital.effectiveFraction`
- Se a política reprovar, `unitStake` vira zero mesmo que o motor encontre um sinal inicial.

### 5. Testes automatizados
- Criada pasta `tests/`.
- Adicionado script:
  - `npm test`
  - `npm run check`
- Cobertura inicial:
  - validação de números da roleta;
  - bloqueio por amostra insuficiente;
  - formato de análise institucional;
  - estabilidade do backtest walk-forward;
  - bloqueio de risco sem evidência suficiente.

## Validação executada

Comando executado:

```bash
npm run check
```

Resultado:

```text
build: OK
tests: 5 passed, 0 failed
```

## Mudança de filosofia operacional
Antes, o sistema podia sugerir stake com base em indícios estatísticos frágeis. Agora, a API separa:

1. sinal estatístico bruto;
2. validação por backtest;
3. decisão institucional de risco;
4. stake efetivamente autorizada.

Isso reduz overfitting, falso positivo e entrada operacional sem evidência mínima.

## Próximas otimizações recomendadas
1. Adicionar simulação Monte Carlo.
2. Adicionar teste de significância para qui-quadrado.
3. Criar regime detection por janela móvel.
4. Criar painel de métricas com histórico de decisões.
5. Adicionar Dockerfile opcional.
6. Adicionar GitHub Actions para `npm run check`.
7. Separar payloads de API com DTOs tipados.
8. Persistir backtests e decisões em logs estruturados.

## Observação crítica
Este projeto continua sendo um sistema de análise estatística experimental. Roleta possui vantagem matemática da casa. O sistema agora está mais seguro porque bloqueia decisões quando não há evidência walk-forward suficiente, mas isso não significa garantia de lucro.
