# ADR-015 — Tactical Engine Boundary Definition

====================================================================
ARCHITECTURE DECISION RECORD
====================================================================

Status:
PROPOSED

Date:
2026-07-26

Related ADRs:

ADR-012 — Explainability Engine

ADR-013 — Intelligence Runtime

ADR-014 — Operational End-to-End Validation


====================================================================
CONTEXT
====================================================================

Após a implementação da Sprint 015 — Runtime Adapters Layer, o
RL.SYS CORE possui um ponto único institucional de execução através
do IntelligenceRuntime.

Entretanto, o Tactical Engine existente no PWA Terminal ainda
representa uma camada histórica contendo responsabilidades misturadas:

• gerenciamento de estado da interface;

• controle de sessão;

• apresentação operacional;

• seleção tática;

• cálculo de exposição;

• persistência local;

• comunicação externa.

A ausência de uma fronteira arquitetural explícita cria risco de:

• bypass do IntelligenceRuntime;

• duplicação de lógica quantitativa;

• acoplamento entre frontend e domínio;

• violação do princípio de Dependency Inversion;

• dificuldade de evolução futura.


====================================================================
DECISION
====================================================================

Foi definida a separação formal entre Tactical Engine e o núcleo
institucional de inteligência.

O Tactical Engine passa a ser considerado um ADAPTER DE BORDA.

Ele não é um motor quantitativo.

Ele não é responsável por decisões institucionais.

Ele não substitui o IntelligenceRuntime.


====================================================================
TACTICAL ENGINE RESPONSIBILITIES
====================================================================

O Tactical Engine possui responsabilidade exclusiva por:

• receber eventos da interface;

• manter estado temporário de sessão;

• controlar apresentação operacional;

• solicitar execuções ao Runtime;

• interpretar IntelligenceExecutionResult;

• atualizar componentes visuais.


O Tactical Engine NÃO poderá:

• executar Markov;

• executar Shannon Entropy;

• executar VIX;

• executar Z-Score;

• calcular Strategy Ranking;

• criar DecisionSummary;

• modificar DecisionExplanation;

• acessar DecisionAuditLedger diretamente.


====================================================================
ARCHITECTURAL POSITION
====================================================================


                 PWA TERMINAL

                       │

                       ▼

             Tactical Engine

                       │

                       ▼

          TacticalRuntimeAdapter

                       │

                       ▼

          IntelligenceRuntime

                       │

                       ▼

     QuantitativeEnginePipeline

                       │

                       ▼

       DecisionIntelligenceEngine

                       │

          ┌────────────┴────────────┐

          ▼                         ▼

 Explainability              Audit Ledger


====================================================================
BOUNDARY RULES
====================================================================

A fronteira arquitetural estabelece:

Regra 1:

Toda decisão estratégica deve passar pelo IntelligenceRuntime.


Regra 2:

Nenhum componente de frontend pode importar engines internas.


Regra 3:

Nenhum adapter pode instanciar motores quantitativos diretamente.


Regra 4:

O Tactical Engine trabalha somente com contratos públicos.


Regra 5:

DecisionSummary e IntelligenceExecutionResult são somente leitura.


====================================================================
DEPENDENCY FLOW
====================================================================

Fluxo permitido:

Tactical Engine

↓

TacticalRuntimeAdapter

↓

IntelligenceRuntimePort

↓

IntelligenceRuntime


Fluxos proibidos:

Tactical Engine

↓

MarkovProbabilityEngine


Tactical Engine

↓

StrategyRankingEngine


Tactical Engine

↓

DecisionIntelligenceEngine


====================================================================
INTEGRATION CONTRACT
====================================================================

O TacticalRuntimeAdapter é responsável por:

• transformar eventos do PWA em comandos institucionais;

• criar o contexto de execução;

• enviar requisições ao Runtime;

• retornar resultados sem alteração.


Nenhum dado quantitativo poderá ser criado pelo Adapter.


====================================================================
SECURITY AND GOVERNANCE
====================================================================

A fronteira Tactical Engine garante:

• isolamento do núcleo;

• prevenção de bypass arquitetural;

• rastreabilidade das execuções;

• compatibilidade com futuras interfaces;

• manutenção do modelo Clean Architecture.


====================================================================
TEST REQUIREMENTS
====================================================================

Devem existir testes garantindo:

• Tactical Engine não importa engines internas;

• TacticalRuntimeAdapter utiliza somente contratos;

• Runtime permanece único ponto de execução;

• DecisionSummary permanece imutável;

• nenhuma regressão ocorre nas Sprints 013, 014 e 015.


====================================================================
CONSEQUENCES
====================================================================

Benefícios:

• frontend desacoplado do domínio;

• evolução independente do PWA;

• possibilidade de novos clientes;

• preservação da governança institucional.


Custos:

• necessidade de adapters para novas interfaces;

• maior disciplina arquitetural.


====================================================================
ARCHITECTURAL GUARANTEES
====================================================================

O Tactical Engine permanece uma camada de apresentação e controle.

O IntelligenceRuntime permanece o único ponto oficial de execução.

Nenhum componente externo possui autorização para executar lógica
quantitativa diretamente.

====================================================================
