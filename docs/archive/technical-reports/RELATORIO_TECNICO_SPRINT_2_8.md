# RELATÓRIO TÉCNICO — SPRINT 2.8

## Strategy Decision Engine

Esta sprint adiciona a camada de decisão operacional do RL.SYS sem abrir execução real. O motor consolida warm-up, sinais, benchmark, exposição de capital e Monte Carlo v2 em uma decisão auditável.

## Decisão arquitetural

- Domínio puro em `src/domain/decision`.
- Strategy Pattern aplicado por regras plugáveis de decisão.
- Serviço de aplicação adapta datasets, warm-up e relatórios ao contexto de decisão.
- Execução real permanece bloqueada: `operationalGate: BLOCKED` e `liveStakeFraction: 0`.
- O plano gerado é `RESEARCH_ONLY`, preparando o futuro modo paper/session manager.

## Complexidade

- Decision Engine: O(r), onde `r` é o número de regras.
- Serviço: O(n) para parse/normalização e execução dos módulos já existentes.
- Sem recursão, sem dependências pesadas e seguro para Termux/Helio P22.

## Novos componentes

- `StrategyDecisionEngine`
- `StrategyDecisionRuleFactory`
- `StrategyDecisionService`
- Endpoint `/api/strategy/decision/evaluate`
- Testes de domínio e aplicação

## Resultado

O RL.SYS passa a converter evidência quantitativa em ações padronizadas: `BLOCKED`, `NO_BET`, `OBSERVE`, `CONSERVATIVE_ENTRY` e `MODERATE_ENTRY`, sempre com execução real bloqueada por governança.
