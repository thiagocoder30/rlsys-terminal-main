====================================================================
ARCHITECTURE DECISION RECORD
====================================================================

ADR-013 — Intelligence Runtime

====================================================================

Status:

IMPLEMENTED

Validation Status:

VALIDATED

Date:

2026-07-26

Implementation Sprint:

013 — Intelligence Runtime Integration

Validation Sprint:

014 — Operational End-to-End Validation

Next Evolution:

015 — Runtime Adapters


Supersedes:

None


Related ADRs:

ADR-004 — Decision Intelligence Foundation

ADR-005 — Quantitative Engine Foundation

ADR-012 — Explainability Engine (XAI)

ADR-014 — Operational End-to-End Validation


====================================================================
CONTEXT
====================================================================

Até a Sprint 012.1 o RL.SYS CORE possuía todos os componentes
necessários para executar análises quantitativas completas:

• QuantitativeEnginePipeline

• Markov Probability Engine

• Shannon Entropy Engine

• Operational VIX Engine

• Z-Score Engine

• Strategy Ranking Engine

• DecisionIntelligenceEngine

• Explainability Engine

• Decision Audit Ledger


Entretanto, esses componentes existiam como módulos independentes,
sem uma camada institucional única responsável pela coordenação da
execução.


Isso criava riscos arquiteturais:

• múltiplos pontos de entrada no núcleo;

• possibilidade de consumidores externos chamarem engines diretamente;

• bypass de auditoria;

• bypass da Explainability;

• inconsistência de contexto operacional;

• dificuldade de padronização de telemetria.


Era necessário estabelecer um único ponto oficial de execução para
todo o Decision Intelligence Core.


====================================================================
DECISION
====================================================================

Foi criado o componente:

IntelligenceRuntime


O IntelligenceRuntime é definido como o:

Single Point of Execution

oficial do RL.SYS CORE.


A partir desta ADR, qualquer execução institucional deve obrigatoriamente
passar pelo IntelligenceRuntime.


Nenhum consumidor externo pode acessar diretamente componentes internos
do núcleo quantitativo.


Componentes protegidos pelo Runtime:

• QuantitativeEnginePipeline

• DecisionIntelligenceEngine

• ExplainabilityCoordinator

• DecisionAuditLedger

• Strategy Ranking Engine

• Probability Engines

• Statistical Engines


====================================================================
RESPONSABILIDADES DO INTELLIGENCE RUNTIME
====================================================================

O IntelligenceRuntime possui responsabilidade exclusiva por:


• receber QuantitativeInput;

• criar IntelligenceExecutionContext;

• iniciar o fluxo quantitativo;

• coordenar a execução das engines;

• encaminhar DecisionSummary para Explainability;

• registrar execução no DecisionAuditLedger;

• consolidar IntelligenceExecutionResult;

• devolver o resultado final aos consumidores.


O Runtime NÃO executa:


• cálculos estatísticos;

• cálculos probabilísticos;

• cálculo de entropia;

• cálculo de VIX;

• cálculo de Z-Score;

• ranking de estratégias;

• regras financeiras;

• Machine Learning;

• OCR;

• Paper Trading.


Sua responsabilidade é exclusivamente:

ORQUESTRAÇÃO.


====================================================================
FLUXO OFICIAL
====================================================================


QuantitativeInput

        |

        v

IntelligenceExecutionContext

        |

        v

QuantitativeEnginePipeline

        |

        +----------------+
        |                |
        v                v

 Decision Engines    Explainability

        |

        v

DecisionSummary (Immutable)

        |

        +----------------------+
        |                      |
        v                      v

DecisionExplanation     DecisionAuditLedger

        |

        v

IntelligenceExecutionResult



Qualquer fluxo diferente deste será considerado incompatível com a
governança institucional.


====================================================================
INTELLIGENCE EXECUTION CONTEXT
====================================================================

O IntelligenceExecutionContext representa a identidade única de uma
execução operacional.


Responsabilidade:

Transportar metadados imutáveis durante todo o ciclo.


Campos mínimos:


• executionId

• correlationId

• timestamp

• runtimeMetadata

• QuantitativeInput


Todos os campos devem permanecer readonly.


====================================================================
INTELLIGENCE EXECUTION RESULT
====================================================================

O IntelligenceExecutionResult representa o encerramento oficial de uma
execução.


O resultado deve consolidar:


• DecisionSummary

• DecisionExplanation

• executionMetadata

• diagnostics

• runtimeStatus

• processingTime


Nenhuma camada posterior deve alterar ou complementar esse objeto.


====================================================================
ARQUITETURA
====================================================================


                         IntelligenceRuntime

                                |

                                v

                 QuantitativeEnginePipeline

                                |

          +-----------+---------+----------+-----------+

          v           v         v          v           v

       Markov     Shannon     VIX      ZScore    Ranking


                                |

                                v


                 DecisionIntelligenceEngine


                                |

                                v


                  DecisionSummary (Immutable)


                         |              |

                         v              v


          ExplainabilityCoordinator   DecisionAuditLedger


                         |

                         v


                 DecisionExplanation


                         |

                         v


             IntelligenceExecutionResult



====================================================================
ARQUITETURAL PRINCIPLES
====================================================================


Single Responsibility

Toda coordenação institucional pertence exclusivamente ao Runtime.


Open/Closed Principle

Novos engines podem ser adicionados sem modificar consumidores.


Dependency Inversion

O Runtime depende exclusivamente de contratos públicos.


Interface Segregation

Consumidores não precisam conhecer implementações internas.


Imutabilidade

DecisionSummary permanece congelado.


====================================================================
PROIBIÇÕES
====================================================================


O IntelligenceRuntime jamais poderá:


• recalcular Markov;

• recalcular Shannon;

• recalcular VIX;

• recalcular Z-Score;

• recalcular Strategy Ranking;

• alterar DecisionSummary;

• modificar DecisionExplanation;

• executar OCR;

• executar Machine Learning;

• executar Paper Trading;

• executar Backtesting;

• acessar integrações externas diretamente.


====================================================================
INTEGRAÇÃO COM XAI
====================================================================


A Explainability permanece como bounded context downstream.


Fluxo:


DecisionSummary

        |

        v

ExplainabilityCoordinator

        |

        v

DecisionExplanation


A Explainability:

• não recalcula métricas;

• não altera decisões;

• não retroalimenta engines quantitativas.


====================================================================
INTEGRAÇÃO COM AUDITORIA
====================================================================


Toda execução institucional deve gerar registro oficial através do:


DecisionAuditLedger


O Runtime garante:


• nenhuma execução sem auditoria;

• rastreabilidade completa;

• correlação entre entrada, decisão e explicação.


====================================================================
PUBLIC API FROZEN
====================================================================


Esta ADR não altera contratos públicos existentes.


Contratos congelados:


• QuantitativeInput

• QuantitativeOutput

• DecisionSummary

• IQuantitativeEngine

• IDecisionIntelligenceEngine

• IExplainabilityEngine

• IDecisionAuditLedger

• IStrategyRankingEngine

• IProbabilityEngine

• IEntropyEngine

• IVixEngine

• IZScoreEngine


====================================================================
COMPLEXIDADE COMPUTACIONAL
====================================================================


Complexidade própria do Runtime:


O(1)


Toda complexidade de processamento permanece delegada às engines.


Complexidade total:


O(n)


onde n representa exclusivamente o custo acumulado dos motores
quantitativos.


Nenhuma complexidade adicional foi introduzida pelo Runtime.


====================================================================
VALIDATION
====================================================================


A arquitetura foi validada através das seguintes etapas:


Sprint 013

Implementação do IntelligenceRuntime.


Resultado:

• Single Point of Execution criado;

• contratos preservados;

• engines isoladas.


Sprint 014

Operational End-to-End Validation.


Resultado:

• fluxo completo validado;

• auditoria integrada;

• Explainability integrada;

• ausência de regressões.


Status final:


IMPLEMENTED + VALIDATED


====================================================================
SPRINT 015 — RUNTIME ADAPTERS
====================================================================


Objetivo:


Criar adaptadores externos capazes de consumir o
IntelligenceRuntime sem expor engines internas.


Princípio arquitetural:


Nenhum adapter externo pode acessar diretamente componentes
quantitativos internos.


Adapters planejados:


• PWA Tactical Adapter

• CLI Adapter

• API Adapter

• Historical Replay Adapter


Arquitetura:


External Adapter

        |

        v

IntelligenceRuntime

        |

        v

Decision Intelligence Core



====================================================================
CONSEQUENCES
====================================================================


Benefícios:


• ponto único de execução;

• redução de acoplamento;

• auditoria padronizada;

• telemetria consistente;

• proteção contra bypass;

• integração futura simplificada.


Custos:


• todos os consumidores externos devem utilizar o Runtime;

• adapters devem respeitar contratos institucionais.


Este custo é considerado aceitável diante dos ganhos de governança.


====================================================================
FINAL REVIEW
====================================================================


Clean Architecture:

APPROVED


DDD:

APPROVED


SOLID:

APPROVED


Dependency Inversion:

APPROVED


Governance Model:

APPROVED


====================================================================

STATUS:

IMPLEMENTED

VALIDATED

READY FOR SPRINT 015 — RUNTIME ADAPTERS

====================================================================
