# RELATORIO TECNICO - SPRINT 031

## Objetivo

Implementar o Session Circuit Breaker como camada de enforcement operacional do RL.SYS CORE.

A Sprint transforma sinais de risco em bloqueios formais de sessão. O módulo não autoriza apostas e não executa estratégia. Ele apenas decide se a sessão permanece aberta, entra em revisão ou deve ser bloqueada por preservação de capital.

## Entregas

- SessionCircuitBreaker
- Política de stop loss
- Política de stop win
- Bloqueio por quebra de sanidade runtime
- Revisão por drawdown velocity
- Bloqueio por falha de integridade de dados
- Testes unitários determinísticos

## Estados

- SESSION_OPEN
- SESSION_REVIEW
- SESSION_LOCKED
- SESSION_PROFIT_LOCKED
- BLOCKED

## Governança

O módulo impõe a filosofia capital preservation first.

Quando o stop loss é atingido, a sessão deve ser bloqueada. Quando o stop win é atingido, a sessão deve ser encerrada com lucro protegido. Quando há falha de sanidade, OCR ou integridade, o sistema deve bloquear ou revisar antes de qualquer nova decisão.

## Complexidade

Tempo: O(1)

Espaço: O(1)

## Decisão arquitetural

O Circuit Breaker permanece no domínio e não depende de UI, API, banco de dados, filesystem ou runtime Android.

Persistência de lock pode ser adicionada posteriormente via porta de infraestrutura. Nesta Sprint, o objetivo é formalizar a decisão determinística de bloqueio.

## Papel no RL.SYS

Fluxo esperado:

```txt
Runtime Sanity
→ Session Circuit Breaker
→ Decision Orchestrator
→ NO_GO / REVIEW / LOCKED
```

## Resultado esperado

O sistema passa a possuir uma camada explícita de imposição de risco em sessão.
