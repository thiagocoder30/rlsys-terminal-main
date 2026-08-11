ADR-036 — SESSION AUDIT & HISTORICAL PERFORMANCE INTELLIGENCE ARCHITECTURE

STATUS:
ACCEPTED

VERSÃO:
RL.SYS CORE v5.x

SPRINT RELACIONADA:
SPRINT-044 — SESSION AUDIT & HISTORICAL PERFORMANCE INTELLIGENCE

==========================================================

1. CONTEXTO
==========================================================

Após a implementação das camadas:

- Intelligence Feedback Governance;
- Decision Replay & Explainability;
- Institutional Knowledge Base;
- Predictive Scenario Simulation;
- Multi-Session Intelligence;
- Portfolio Intelligence Layer;
- Strategy Evolution Governance;
- Institutional AI Decision Layer;
- Session Control & Bankroll Management;
- Operator HUD Optimization;

o RL.SYS CORE possui capacidade de acompanhar uma sessão operacional completa em tempo real.

Entretanto, ainda existe uma lacuna:

O sistema controla a sessão, porém ainda não transforma cada sessão finalizada em uma fonte estruturada de aprendizado operacional para o usuário.

A ADR-036 tem como objetivo criar a camada de auditoria histórica das sessões, permitindo analisar:

- como a sessão evoluiu;
- como o operador tomou decisões;
- quais estratégias tiveram melhor desempenho;
- quais comportamentos precisam ser melhorados;
- quais padrões históricos aparecem entre sessões.


==========================================================

2. OBJETIVO ARQUITETURAL
==========================================================

Criar a camada:

SESSION AUDIT & HISTORICAL PERFORMANCE INTELLIGENCE (SAHPI)


Responsável por:


- consolidar dados de sessões finalizadas;
- gerar relatórios históricos;
- analisar performance operacional;
- criar indicadores de evolução do operador;
- alimentar futuras camadas de aprendizado institucional.


A camada deve ser exclusivamente:

- observacional;
- analítica;
- consultiva.


Não deve:

- alterar estratégias;
- modificar pesos quantitativos;
- interferir no IntelligenceRuntime;
- executar apostas;
- alterar decisões já tomadas.


==========================================================

3. PRINCÍPIOS OBRIGATÓRIOS
==========================================================


Preservar:


IntelligenceRuntime:

Single Point of Execution.


QuantitativeEnginePipeline:

INTACTO.


Recommendation Engine:

INTACTO.


EnsembleDecisionEngine:

INTACTO.


Shadow Paper Trading:

INTACTO.


DecisionLedger:

Append Only.


RuntimeEventBus:

Unidirecional.


RuntimeTelemetry:

Desacoplado.


Frontend:

Thin Client absoluto.


Configuração:


PaperOnly=true


ProductionMoneyAllowed=false



==========================================================

4. NOVO DOMÍNIO
==========================================================


Criar:


src/application/session-audit/


Estrutura:


SessionAuditEngine.ts

SessionPerformanceAnalyzer.ts

OperatorPerformanceCalculator.ts

StrategyPerformanceAnalyzer.ts

SessionSummaryBuilder.ts

SessionAuditSnapshot.ts

SessionAuditHistory.ts

SessionAuditReportService.ts



==========================================================

5. TESTES OBRIGATÓRIOS
==========================================================


Criar:


tests/application/session-audit/


SessionAuditEngine.test.ts

SessionPerformanceAnalyzer.test.ts

OperatorPerformanceCalculator.test.ts

StrategyPerformanceAnalyzer.test.ts

SessionAuditSnapshot.test.ts

SessionAuditReportService.test.ts



==========================================================

6. SESSION AUDIT ENGINE
==========================================================


Responsabilidade:


Orquestrar o fechamento e análise das sessões.


Entrada:


SessionFinishedEvent


Dados:


- SessionAuditSnapshot;
- SessionControl;
- Shadow Results;
- Recommendation History;
- Decision History.


Saída:


Historical Session Analysis.



Não deve alterar:

- SessionControlEngine;
- RecommendationEngine;
- Quantitative Pipeline.



==========================================================

7. SESSION PERFORMANCE ANALYZER
==========================================================


Responsabilidade:


Avaliar desempenho da sessão.


Calcular:


- resultado financeiro;
- ROI;
- quantidade de giros;
- quantidade de decisões;
- taxa de confirmação;
- taxa de acerto;
- eficiência operacional.


Exemplo:


Sessão:

Banca inicial:
R$ 1.000


Final:
R$ 1.250


Resultado:

+R$ 250


ROI:

25%



==========================================================

8. OPERATOR PERFORMANCE CALCULATOR
==========================================================


Criar:


Operator Performance Score



Avaliar:


Disciplina:

- respeitou stop;
- evitou excesso de entradas;
- confirmou apenas decisões desejadas.



Consistência:

- estabilidade entre sessões;
- controle emocional operacional;
- aderência ao plano.



Resultado:


Score:

0-100



Exemplo:


Operator Score:

87/100



==========================================================

9. STRATEGY PERFORMANCE ANALYZER
==========================================================


Responsabilidade:


Avaliar estratégias utilizadas durante a sessão.


Calcular:


- quantidade de entradas;
- confirmações;
- resultados;
- ROI por estratégia;
- eficiência.


Exemplo:


Dúzia 1:


Entradas:

15


Acertos:

11


ROI:

+18%



==========================================================

10. SESSION AUDIT SNAPSHOT
==========================================================


Criar entidade imutável.


Campos:


sessionId

startTime

endTime

initialBankroll

finalBankroll

profitLoss

roi

totalRounds

totalRecommendations

confirmedRecommendations

skippedRecommendations

wins

losses

stopReason

strategyPerformance

operatorScore



Obrigatório:


SHA-256 hash


Object.freeze()



==========================================================

11. SESSION AUDIT HISTORY
==========================================================


Responsabilidade:


Armazenar sessões concluídas.


Características:


- Append Only;
- sem sobrescrita;
- histórico consultável;
- capacidade limitada inicial.


Modelo:


FIFO O(1)


==========================================================

12. EVENT BUS
==========================================================


Consumir:


SESSION_FINISHED

SESSION_UPDATED

SHADOW_TRADE_SIMULATED

RECOMMENDATION_CONFIRMED

RECOMMENDATION_SKIPPED



Criar:


SESSION_ANALYZED

SESSION_AUDIT_CREATED

OPERATOR_PATTERN_UPDATED



==========================================================

13. DECISION LEDGER
==========================================================


Registrar:


SESSION_AUDIT_CREATED

SESSION_ANALYZED

OPERATOR_PATTERN_UPDATED



Nunca modificar:


eventos antigos.


==========================================================

14. API
==========================================================


Criar:


GET

/api/operator/session/history



Retornar:


- sessões encerradas;
- métricas;
- auditorias.



Criar:


GET

/api/operator/session/{id}/audit



Retornar:


- relatório completo;
- estratégias;
- evolução operacional.



==========================================================

15. PWA / UX MOBILE FIRST
==========================================================


Modificar:


pwa-terminal/src/core/dto.ts


Adicionar:


SessionAuditDTO

OperatorPerformanceDTO

StrategyPerformanceDTO



Modificar:


OperatorConsole.tsx



Adicionar:


Tela:


HISTÓRICO DE SESSÕES



Mostrar:


Sessão

Resultado

ROI

Giros

Score Operador

Melhor Estratégia

Stop atingido



Interface:

Somente visualização.


Nenhuma regra no frontend.



==========================================================

16. RELATÓRIO PÓS SESSÃO
==========================================================


Criar modal:


SESSÃO FINALIZADA


Exibir:


Motivo:

STOP WIN

ou

STOP LOSS



Dados:


Banca inicial

Banca final

Resultado %

Quantidade de giros

Estratégias utilizadas

Decisões confirmadas

Decisões puladas

Performance por estratégia

Operator Score



==========================================================

17. RISCOS ARQUITETURAIS
==========================================================


Risco:


Reprocessamento completo de sessões antigas causando degradação.



Risco:


Acoplamento entre auditoria e motores quantitativos.



Risco:


Frontend começar a calcular métricas.



==========================================================

18. MITIGAÇÕES
==========================================================


Aplicar:


Snapshots imutáveis.


Processamento incremental.


Eventos assíncronos.


Calculadores isolados.


Frontend exclusivamente consumidor de DTOs.



==========================================================

19. VALIDAÇÃO OBRIGATÓRIA
==========================================================


Executar:


npm run build


npx vitest run


npx madge src --extensions ts --circular



Critérios:


BUILD:

SUCCESS



VITEST:

100% aprovado



MADGE:

Zero dependências circulares.



==========================================================

20. RELATÓRIO FINAL DA SPRINT
==========================================================


Apresentar:


1.

Árvore final de arquivos.


2.

Arquivos criados.


3.

Arquivos modificados.


4.

Arquivos removidos.


5.

Justificativa arquitetural.


6.

Fluxo completo de auditoria.


7.

Riscos encontrados.


8.

Mitigações aplicadas.


9.

Resultado do build.


10.

Resultado completo dos testes.


11.

Resultado Madge.


12.

Confirmações institucionais:


IntelligenceRuntime permanece Single Point of Execution.


QuantitativeEnginePipeline permanece intacto.


Recommendation Engine permanece intacto.


Nenhuma lógica quantitativa foi movida para frontend.


Paper Trading Only permanece ativo.


ProductionMoneyAllowed permanece false.


DecisionLedger continua Append Only.


Snapshots permanecem imutáveis.


Frontend continua Thin Client.



==========================================================

DECLARAÇÃO FINAL ESPERADA

SPRINT-044 — SESSION AUDIT & HISTORICAL PERFORMANCE INTELLIGENCE


STATUS:

HOMOLOGADA


Somente quando todos os critérios forem atendidos com evidências objetivas.

==========================================================
