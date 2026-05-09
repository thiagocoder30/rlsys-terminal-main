# RELATÓRIO TÉCNICO — OTIMIZAÇÃO v0.7.0

## Objetivo
Elevar a camada quantitativa e de governança do RL.SYS CORE adicionando validação probabilística, score de confiança e rastreabilidade institucional de decisões.

## Implementações

### 1. MonteCarloEngine
Adicionado `src/domain/services/MonteCarloEngine.ts`.

Funções principais:
- simulação de cenários a partir do resultado walk-forward;
- estimativa de probabilidade de ruína;
- distribuição de equity final;
- drawdown esperado;
- P95 de drawdown.

### 2. ConfidenceScorer
Adicionado `src/domain/services/ConfidenceScorer.ts`.

O score combina:
- entropia normalizada;
- força dos sinais;
- tamanho de amostra;
- robustez do backtest walk-forward.

Resultado:
- `finalScore` de 0 a 1;
- grade institucional A/B/C/D/F;
- motivos de penalização.

### 3. RiskPolicy v0.7
A política de risco agora bloqueia sinais com:
- confidence score abaixo de 0.55;
- risco de ruína Monte Carlo acima de 5%;
- P95 de drawdown acima de 35%;
- backtest insuficiente;
- ROI/expectativa não positivos.

### 4. Auditoria de decisões
Adicionado `src/infrastructure/audit/DecisionAuditLogger.ts`.

Cada análise gera registro JSONL em:

```txt
./data/decision-audit.jsonl
```

Campos auditados:
- timestamp;
- status;
- motivo;
- sample size;
- confidence score;
- risk level;
- stake fraction;
- risk of ruin.

### 5. API enriquecida
A resposta da API agora inclui:
- `confidence`;
- `monteCarlo`;
- `institutionalRisk` enriquecido;
- auditoria persistida.

## Nota institucional
A v0.7.0 não tenta “garantir lucro”. Ela aumenta o rigor de bloqueio e reduz chance de recomendações frágeis. O sistema continua experimental até que haja histórico amplo, limpo, auditável e testado fora da amostra.
