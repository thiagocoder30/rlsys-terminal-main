====================================================================
ARCHITECTURE DECISION RECORD
====================================================================

ADR-016 — Tactical Engine Boundary Definition

====================================================================

Status:
IMPLEMENTED

Date:
2026-07-26

Related ADRs:

ADR-012 — Explainability Engine
ADR-013 — Intelligence Runtime
ADR-014 — Operational End-to-End Validation
ADR-015 — Runtime Adapters Layer

====================================================================
CONTEXT
====================================================================

Após a implementação das Sprints 013, 014 e 015, o RL.SYS CORE
passou a possuir um ponto único e governado de execução através do
IntelligenceRuntime.

Entretanto, a camada de apresentação PWA ainda possuía componentes
históricos contendo responsabilidades quantitativas diretamente no
frontend.

O componente:

pwa-terminal/src/core/useTacticalEngine.ts

originalmente concentrava responsabilidades como:

• análise Markov;
• cálculo de entropia;
• avaliação de Z-Score;
• seleção de estratégias;
• cálculo de exposição;
• regras de decisão.

Essa arquitetura violava os princípios definidos anteriormente:

• Single Responsibility;
• Dependency Inversion;
• Clean Architecture;
• separação entre Application Layer e Presentation Layer.

Era necessário estabelecer uma fronteira arquitetural definitiva
entre o Tactical UI Layer e o Intelligence Runtime.

====================================================================
DECISION
====================================================================

Foi criada uma nova fronteira arquitetural denominada:

Tactical Engine Boundary.

A partir desta ADR, o PWA Terminal deixa de possuir lógica
quantitativa ou inteligência decisória.

Toda execução tática deverá obrigatoriamente seguir o fluxo:

PWA Terminal

        |

        v

TacticalEnginePort

        |

        v

TacticalRuntimeAdapter

        |

        v

IntelligenceRuntime

        |

        v

QuantitativeEnginePipeline

        |

        v

DecisionIntelligenceEngine

        |

        v

DecisionSummary

        |

        +----------------+
        |                |
        v                v

Explainability     DecisionAuditLedger


====================================================================
TACTICAL ENGINE PORT
====================================================================

Foi criado o contrato público:

src/runtime/contracts/TacticalEnginePort.ts


Responsabilidade:

Definir a interface oficial consumida pelo PWA.

O frontend depende exclusivamente deste contrato.

O frontend NÃO conhece:

• IntelligenceRuntime;
• QuantitativeEnginePipeline;
• Markov Engine;
• Shannon Engine;
• VIX Engine;
• Z-Score Engine;
• Strategy Ranking Engine.

====================================================================
TACTICAL EXECUTION REQUEST
====================================================================

Foi criado o contrato:

src/runtime/contracts/TacticalExecutionRequest.ts


Este objeto representa a intenção operacional enviada pelo
frontend.

Características obrigatórias:

• readonly;
• imutável;
• sem lógica de negócio;
• sem cálculo quantitativo.

O TacticalExecutionRequest representa somente entrada operacional.

Exemplos:

• comando solicitado;
• contexto de sessão;
• parâmetros de execução;
• metadados necessários.

====================================================================
PWA RESPONSIBILITIES
====================================================================

Após esta decisão, o PWA Terminal possui somente responsabilidades
de apresentação:

Permitido:

• coletar entrada do usuário;
• apresentar resultados;
• controlar estado visual;
• enviar TacticalExecutionRequest;
• consumir TacticalEnginePort.

Proibido:

• calcular probabilidades;
• calcular indicadores estatísticos;
• selecionar estratégia vencedora;
• executar Kelly;
• alterar DecisionSummary;
• acessar engines internas;
• acessar Ledger diretamente.

====================================================================
TACTICAL RUNTIME ADAPTER
====================================================================

O componente:

src/adapters/pwa/TacticalRuntimeAdapter.ts

atua como fronteira entre o mundo externo e o núcleo institucional.

Responsabilidades:

• receber TacticalExecutionRequest;
• validar entrada;
• transformar em QuantitativeInput;
• encaminhar ao IntelligenceRuntime;
• retornar IntelligenceExecutionResult.

O Adapter não executa inteligência.

O Adapter não calcula estatística.

O Adapter apenas traduz contratos.

====================================================================
ARQUITETURA FINAL
====================================================================


                 PWA TERMINAL

                      |

                      |

             TacticalEnginePort

                      |

                      |

          TacticalRuntimeAdapter

                      |

                      |

           IntelligenceRuntime

                      |

                      |

       QuantitativeEnginePipeline

                      |

          +-----------+-----------+

          |           |           |

       Markov      Shannon      VIX

          |

       ZScore

          |

       Strategy Ranking

                      |

                      |

       DecisionIntelligenceEngine

                      |

                      |

          DecisionSummary Immutable

                      |

          +-----------+

          |

          +--------------------+

          |                    |

          v                    v

 Explainability        DecisionAuditLedger


====================================================================
ARCHITECTURAL GUARANTEES
====================================================================

Esta ADR estabelece as seguintes garantias:

1. O frontend nunca executa inteligência quantitativa.

2. O IntelligenceRuntime permanece como único ponto de execução.

3. Estratégias futuras não serão implementadas no PWA.

4. Novos consumidores deverão utilizar contratos públicos.

5. O domínio quantitativo permanece isolado.

6. A camada de apresentação permanece substituível.

====================================================================
TEST GOVERNANCE
====================================================================

A fronteira é protegida pelos testes:

tests/runtime/tactical-runtime-adapter.test.ts

tests/runtime/tactical-boundary.test.ts


Os testes garantem:

• implementação correta do TacticalEnginePort;
• ausência de imports proibidos;
• inexistência de bypass arquitetural;
• preservação da Dependency Inversion.

Resultado da validação:

Vitest:

35 arquivos aprovados

118 testes aprovados


Madge:

0 dependências circulares encontradas.

====================================================================
PROIBIÇÕES
====================================================================

O PWA Terminal jamais poderá:

• importar engines quantitativas;
• acessar DecisionIntelligenceEngine;
• acessar Markov Engine;
• acessar VIX Engine;
• acessar Strategy Ranking;
• criar decisões próprias;
• modificar resultados do Runtime.

Qualquer violação deverá gerar falha de boundary test.

====================================================================
CONSEQUENCES
====================================================================

Benefícios:

• isolamento completo do frontend;
• redução de acoplamento;
• maior testabilidade;
• evolução segura das estratégias;
• possibilidade futura de múltiplos clientes;
• compatibilidade com API, CLI e integrações externas.

Custos:

• aumento inicial de abstrações;
• necessidade de manutenção dos contratos;
• necessidade de composição adequada do Runtime no frontend.

Os custos são aceitos devido ao ganho de governança arquitetural.

====================================================================
FUTURE EXTENSIONS
====================================================================

Próxima evolução arquitetural:

Sprint 017 — Runtime Composition Layer

Objetivo:

Criar mecanismo institucional de composição do Runtime no frontend,
garantindo:

• instância única do IntelligenceRuntime;
• gerenciamento de lifecycle;
• compartilhamento seguro entre componentes React;
• preparação para futuras arquiteturas SSR.

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

Frontend Boundary:
APPROVED

Intelligence Runtime Governance:
APPROVED

====================================================================
END OF ADR-016
====================================================================
