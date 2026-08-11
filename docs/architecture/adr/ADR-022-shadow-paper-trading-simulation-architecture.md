# ADR-022 — Shadow Paper Trading Simulation Architecture

## Status

ACCEPTED

## Data

2026-07-27

## Contexto

O RL.SYS CORE v5.x evoluiu para uma arquitetura institucional composta por múltiplas camadas independentes de inteligência:

- Live Session Workflow (Sprint-024)
- Strategy Recommendation Engine (Sprint-025)
- Live Session Performance Engine (Sprint-027)
- Market Regime Detection Engine (Sprint-028)
- Dynamic Strategy Weight Calibration Engine (Sprint-029)

Atualmente o sistema consegue:

- receber uma fita histórica de giros;
- validar a mesa através do PreFlight Governance Engine;
- processar giros em tempo real;
- avaliar regimes operacionais;
- medir performance das estratégias;
- calibrar pesos dinamicamente;
- gerar recomendações operacionais auditáveis.

Entretanto, ainda existe uma lacuna institucional:

O sistema consegue recomendar uma decisão, porém não possui uma camada isolada capaz de responder:

"Qual teria sido o resultado caso esta decisão tivesse sido executada?"

Para preencher essa lacuna será criada uma camada exclusiva de Shadow Paper Trading Simulation.

Esta camada deverá permitir validação contínua das recomendações sem qualquer conexão financeira real e sem interferência no fluxo operacional principal.

O objetivo é criar uma simulação controlada de performance hipotética mantendo separação absoluta entre:

- decisão recomendada;
- simulação hipotética;
- performance observada;
- calibração futura.

## Problema Arquitetural

Existe risco de acoplamento caso a simulação seja implementada diretamente dentro de:

- StrategyRecommendationEngine;
- QuantitativeEnginePipeline;
- SessionPerformanceEngine;
- Dynamic Strategy Weight Calibration Engine.

A recomendação deve permanecer independente do resultado simulado.

O simulador deve observar decisões já produzidas e calcular somente consequências hipotéticas.

## Decisão

Será criada uma nova camada institucional:

Shadow Paper Trading Simulation Layer.

Localização:

src/application/shadow/

Responsabilidade:

Consumir eventos operacionais já existentes e produzir métricas simuladas sem alterar nenhum motor existente.

A nova arquitetura será composta por:

src/application/shadow/

├── ShadowDecisionEngine.ts
├── ShadowTradeSimulator.ts
├── ShadowPosition.ts
├── ShadowPortfolio.ts
├── ShadowPerformanceSnapshot.ts
└── ShadowReportService.ts


## Responsabilidades dos Componentes

### ShadowDecisionEngine

Responsável por avaliar uma decisão operacional já emitida.

Entrada:

- OperationalDecisionDTO;
- resultado real do giro;
- contexto da sessão.

Saída:

- WIN;
- LOSS;
- NO_TRADE;
- BLOCKED.

Não gera decisões.
Não modifica recomendações.


### ShadowTradeSimulator

Responsável pela simulação matemática da operação hipotética.

Deve considerar:

- banca shadow inicial;
- stake sugerida;
- resultado do evento;
- retorno hipotético.

Não possui acesso a:

- dinheiro real;
- carteira real;
- APIs financeiras;
- execução automática.


### ShadowPortfolio

Responsável pelo estado virtual da carteira simulada.

Deve armazenar:

- saldo inicial;
- saldo atual;
- lucro/prejuízo acumulado;
- ROI;
- drawdown;
- sequência máxima de perdas;
- quantidade de operações simuladas.


### ShadowPerformanceSnapshot

Deve criar snapshots imutáveis contendo:

- timestamp;
- quantidade de decisões simuladas;
- vitórias;
- perdas;
- ROI;
- drawdown;
- performance por estratégia;
- performance por regime.


### ShadowReportService

Responsável pela exposição institucional via API.

Endpoints:

GET /api/operator/shadow

GET /api/operator/shadow/history


## Fluxo Operacional

O fluxo oficial será:

Operador

↓

Live Session Loop

↓

QuantitativeEnginePipeline

↓

StrategyRecommendationEngine

↓

OperationalDecisionDTO

↓

DecisionLedger

↓

ShadowDecisionEngine

↓

ShadowTradeSimulator

↓

ShadowPortfolio

↓

ShadowPerformanceSnapshot

↓

Operator Console HUD


## Regras de Governança

A implementação deve obedecer:

### Single Point of Execution

O IntelligenceRuntime continua sendo o único ponto de execução quantitativa.

Nenhuma lógica quantitativa será duplicada.


### Paper Trading Only

Obrigatório:

PaperOnly=true

ProductionMoneyAllowed=false


A camada Shadow nunca poderá:

- enviar ordens;
- conectar em plataformas externas;
- executar apostas;
- movimentar valores reais.


### Thin Client

O frontend React permanece exclusivamente como visualizador.

Nenhuma lógica de:

- simulação;
- cálculo;
- estatística;
- performance;

pode existir no PWA.


### Decision Ledger

Toda simulação relevante deve gerar eventos auditáveis:

SHADOW_DECISION_CREATED

SHADOW_TRADE_SIMULATED

SHADOW_PERFORMANCE_UPDATED


Todos os registros devem possuir:

- timestamp;
- sessionId;
- hash SHA-256.


### Imutabilidade

Devem permanecer imutáveis:

- ShadowPerformanceSnapshot;
- registros históricos;
- DecisionLedger.


## Restrições

A Sprint-030 não poderá:

Modificar:

- IntelligenceRuntime;
- QuantitativeEnginePipeline;
- Adaptive Intelligence;
- EnsembleDecisionEngine;
- MarketRegimeEngine;
- StrategyRecommendationEngine;
- Dynamic Strategy Weight Calibration Engine.


A Sprint-030 somente poderá consumir eventos e DTOs existentes.


## Benefícios Esperados

Após implementação:

O RL.SYS CORE será capaz de medir:

- assertividade das recomendações;
- ROI hipotético;
- eficiência por estratégia;
- eficiência por regime;
- drawdown simulado;
- estabilidade operacional.


Isso permitirá evolução futura para:

- Strategy Intelligence Feedback Loop;
- melhoria de calibração;
- análise comparativa de estratégias.


## Critérios de Aceitação

A ADR será considerada implementada quando:

- Shadow Simulation Layer criada;
- nenhum motor existente alterado;
- testes unitários adicionados;
- build aprovado;
- Vitest aprovado;
- Madge sem dependências circulares;
- HUD exibindo dados Shadow;
- Decision Ledger registrando eventos;
- Paper Trading Only preservado.


## Consequência Arquitetural

O RL.SYS CORE passa a possuir separação institucional completa entre:

1. Inteligência de decisão.

2. Simulação hipotética.

3. Observabilidade de performance.

4. Calibração futura.


Essa separação permite evolução contínua sem comprometer governança, segurança ou integridade quantitativa.

---

## Status Final

ADR-022 ACCEPTED

Autorizada a implementação da Sprint-030 — Shadow Paper Trading Simulation Engine.
