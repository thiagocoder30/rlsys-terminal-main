# ADR-035 — Mobile First Operational HUD Architecture

Status: ACCEPTED

Data: 2026-07-28

Relacionada:

Sprint-043 — Mobile First Operational HUD & User Interaction Layer


==========================================================
1. CONTEXTO
==========================================================

O RL.SYS CORE evoluiu de uma plataforma puramente quantitativa para uma arquitetura institucional completa contendo:

- Intelligence Governance;
- Feedback Governance;
- Decision Replay;
- Knowledge Base;
- Learning Engine;
- Evolution Engine;
- Predictive Scenario Simulation;
- Multi Session Intelligence;
- Portfolio Intelligence;
- Strategy Evolution Governance;
- Institutional AI Decision Layer;
- Session Control & Bankroll Management Engine.


A arquitetura interna encontra-se estabilizada.

Entretanto, a experiência operacional do usuário ainda apresenta excesso de informação institucional, tornando o HUD inadequado para utilização durante uma sessão real em smartphones.


O usuário durante uma mesa precisa de informações rápidas:

- estado atual da banca;
- risco atual;
- sugestão operacional;
- valor da stake;
- confirmação manual;
- evolução da sessão;
- controle de parada.


O HUD não deve expor toda a complexidade institucional.


A arquitetura deve separar:

CAMADA INSTITUCIONAL:

Responsável pela inteligência profunda.


CAMADA OPERACIONAL:

Responsável pela interação rápida do operador.


==========================================================
2. OBJETIVO
==========================================================

Criar uma camada Mobile First Operational HUD responsável pela experiência operacional do usuário.


O objetivo é responder:

"Qual é a situação atual da minha sessão e qual ação operacional devo tomar agora?"


Sem expor:

- métricas internas complexas;
- pesos de estratégia;
- cálculos institucionais;
- detalhes de aprendizado;
- modelos preditivos.


==========================================================
3. PRINCÍPIOS ARQUITETURAIS
==========================================================

A implementação deve preservar:


IntelligenceRuntime:

Single Point of Execution.


QuantitativeEnginePipeline:

INTACTO.


Recommendation Engine:

INTACTO.


Institutional Intelligence:

Somente observacional.


Session Control Engine:

Fonte oficial do estado operacional.


DecisionLedger:

Append Only.


RuntimeEventBus:

Unidirecional.


Frontend:

Thin Client absoluto.



Configurações obrigatórias:


PaperOnly=true


ProductionMoneyAllowed=false


==========================================================
4. NOVA RESPONSABILIDADE DO HUD
==========================================================

O HUD deve apresentar somente informações críticas.


Tela principal:


------------------------------------------------

RL.SYS SESSION HUD


Banca Atual:

R$ XXXXX


Resultado:

+R$ XXX
ou
-R$ XXX


ROI:

XX%


Giro Atual:

XXX


------------------------------------------------


Sugestão Atual:


Estratégia:

XXXXXXXX


Entrada:

CONFIRMAR

PULAR


------------------------------------------------


Stake:


Valor:

R$ XX,XX


Mesa:

Pragmatic
ou
Evolution



Ficha mínima:

R$0,10

ou

R$0,50



------------------------------------------------


Caso Dúzia:


Dúzia selecionada:

1ª / 2ª / 3ª


Valor:

R$ XX,XX



Caso Coluna:


Coluna selecionada:

1 / 2 / 3


Valor:

R$ XX,XX


------------------------------------------------


Stop Loss:

██████░░░░

15%


Stop Win:

████░░░░░░

30%


------------------------------------------------


Nenhuma outra informação deve aparecer na tela principal.


==========================================================
5. CONFIRMAÇÃO MANUAL DE ENTRADA
==========================================================

Toda recomendação deve possuir:


CONFIRMAR


ou


PULAR



O sistema nunca deve considerar uma recomendação como executada automaticamente.


Registrar:


SuggestionConfirmed


SuggestionSkipped



Ambos devem alimentar:


- Session Audit;
- Decision Ledger;
- Performance Analysis.


==========================================================
6. CONTROLE DE STAKE
==========================================================

O HUD deve exibir a stake calculada pelo backend.


O cálculo deve considerar:


- banca atual;
- estratégia;
- risco;
- mesa selecionada;
- ficha mínima.


Regras:


Pragmatic:


Múltiplos de:

R$0,10



Evolution:


Múltiplos de:

R$0,50



Nunca permitir valores inválidos.


==========================================================
7. MODAL DE FINALIZAÇÃO DE SESSÃO
==========================================================

Ao atingir:


STOP LOSS


ou


STOP WIN



Abrir:


SESSION FINISHED



Exibir:


Motivo:

STOP LOSS
ou
STOP WIN


Dados:


Banca inicial;

Banca final;

Resultado financeiro;

ROI;

Quantidade de giros;

Estratégias utilizadas;

Taxa de acerto;

Entradas confirmadas;

Entradas puladas.


Permitir:

Salvar auditoria.

Consultar histórico.


==========================================================
8. HISTÓRICO DE SESSÕES
==========================================================

Criar visão:


SESSION HISTORY



Mostrar:


Data;

Banca inicial;

Banca final;

Resultado;

ROI;

Stop atingido;

Quantidade de giros.



Nenhuma alteração em sessões antigas.


Modelo:

Append Only.


==========================================================
9. TERMINAL OPERACIONAL SYNC
==========================================================

Restaurar terminal interativo.


Comando:


sync



Responsabilidades:


Receber últimos 200 giros.


Atualizar:


- histórico;
- pipeline;
- auditoria;
- sessão atual.



Não modificar:

- motores quantitativos;
- estratégias;
- recomendações.


==========================================================
10. RESPONSABILIDADE BACKEND
==========================================================

Backend continua responsável por:


- cálculos;
- progressos;
- risco;
- stake;
- stop;
- auditoria.



Frontend somente:


Renderizar DTOs.


==========================================================
11. NOVA ESTRUTURA ESPERADA
==========================================================


Criar:


src/application/mobile-hud/


Arquivos:


OperationalHudSnapshot.ts

OperationalHudService.ts

SuggestionInteractionService.ts

SessionVisualizationMapper.ts


Testes:


tests/application/mobile-hud/


OperationalHudSnapshot.test.ts

OperationalHudService.test.ts

SuggestionInteractionService.test.ts


==========================================================
12. INTEGRAÇÃO PWA
==========================================================


Modificar:


pwa-terminal/src/core/dto.ts


Adicionar:


OperationalHudDTO

SuggestionActionDTO

SessionProgressDTO



Modificar:


pwa-terminal/src/components/OperatorConsole.tsx



Criar:


MobileFirstHUD



Características:


- responsivo;
- baixo consumo;
- sem estado calculado local;
- sem regras de negócio.


==========================================================
13. EVENTOS
==========================================================


Consumir:


SESSION_UPDATED

RECOMMENDATION_GENERATED

SUGGESTION_CONFIRMED

SUGGESTION_SKIPPED

STOP_LOSS_TRIGGERED

STOP_WIN_TRIGGERED


Publicar:


HUD_UPDATED

SUGGESTION_INTERACTION_REGISTERED


==========================================================
14. TESTES OBRIGATÓRIOS
==========================================================


Validar:


HUD Snapshot:


- criação;
- imutabilidade.


Suggestion Interaction:


- confirmar;
- pular.


Session Visualization:


- dados corretos.


Frontend:


- somente DTO.


==========================================================
15. VALIDAÇÃO FINAL
==========================================================


Executar:


npm run build


npx vitest run


npx madge src --extensions ts --circular



Critérios:


BUILD:

SUCCESS


TESTES:

100% aprovado


MADGE:

Zero dependências circulares.


==========================================================
16. RESULTADO ESPERADO
==========================================================


Ao final da Sprint-043:


O usuário terá um HUD operacional simples, rápido e adequado para smartphone.


O RL.SYS CORE continuará mantendo toda sua inteligência institucional internamente.


Arquitetura final:


Institutional Intelligence Layer

↓

Session Control Engine

↓

Mobile Operational HUD

↓

Operator


==========================================================
DECLARAÇÃO FINAL
==========================================================


SPRINT-043 — MOBILE FIRST OPERATIONAL HUD & USER INTERACTION LAYER


STATUS ESPERADO:

HOMOLOGADA


Somente após todas as validações obrigatórias.
