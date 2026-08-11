# ADR-034 — SESSION CONTROL & BANKROLL MANAGEMENT ENGINE ARCHITECTURE

STATUS: ACCEPTED

DATA: 2026-07-28

RELACIONADO:
SPRINT-042 — Session Control & Bankroll Management Engine (SCBME)

==========================================================
1. CONTEXTO
==========================================================

Após a conclusão das camadas institucionais do RL.SYS CORE:

- Shadow Paper Trading Simulation Engine;
- Intelligence Feedback Governance;
- Decision Replay & Explainability;
- Institutional Knowledge Base;
- Institutional Learning Engine;
- Institutional Intelligence Evolution Engine;
- Predictive Scenario Simulation;
- Multi-Session Intelligence;
- Portfolio Intelligence Layer;
- Strategy Evolution Governance;
- Institutional AI Decision Layer;

o sistema possui capacidade completa de análise, aprendizado, previsão e governança.

Porém, a experiência operacional do usuário final necessita de uma camada dedicada ao gerenciamento da sessão.

O usuário precisa de uma interface simples e segura para controlar:

- início e encerramento de sessão;
- banca operacional;
- limites de risco;
- stop loss;
- stop win;
- progresso da sessão;
- confirmação manual de apostas;
- auditoria histórica.

Esta ADR define a arquitetura da camada responsável por transformar a inteligência institucional existente em controle operacional seguro.

==========================================================
2. OBJETIVO
==========================================================

Criar a camada:

Session Control & Bankroll Management Engine

Responsável por responder:

"Qual é o estado atual da minha sessão e quais limites devo respeitar?"

A camada deve controlar:

- ciclo de vida da sessão;
- banca;
- risco;
- progresso;
- auditoria.

==========================================================
3. PRINCÍPIOS ARQUITETURAIS
==========================================================

A implementação deve preservar obrigatoriamente:

----------------------------------------------------------
IntelligenceRuntime
----------------------------------------------------------

Permanece:

Single Point of Execution.

A camada Session Control não assume controle do runtime principal.


----------------------------------------------------------
QuantitativeEnginePipeline
----------------------------------------------------------

Permanece:

INTACTO.

Nenhuma lógica probabilística existente deve ser alterada.


----------------------------------------------------------
Recommendation Engine
----------------------------------------------------------

Permanece:

INTACTO.

A recomendação continua sendo produzida pelos motores existentes.


----------------------------------------------------------
Paper Trading
----------------------------------------------------------

Obrigatório:

PaperOnly=true

ProductionMoneyAllowed=false


Nenhuma execução financeira real será criada.


----------------------------------------------------------
Frontend
----------------------------------------------------------

Thin Client absoluto.

O frontend:

- não calcula banca;
- não calcula ROI;
- não calcula stop;
- não calcula progressos.

Toda regra permanece no backend.

==========================================================
4. NOVA CAMADA ARQUITETURAL
==========================================================

Criar:

Session Control Layer


Responsabilidades:

- controlar sessão;
- controlar banca;
- controlar limites;
- gerar auditoria;
- fornecer estado operacional.

==========================================================
5. ESTRUTURA ESPERADA
==========================================================

Criar:

src/application/session-control/


Arquivos:

SessionControlEngine.ts

SessionState.ts

BankrollManager.ts

RiskLimitCalculator.ts

StopLossManager.ts

StopWinManager.ts

SessionProgressCalculator.ts

SessionAuditSnapshot.ts

SessionHistory.ts

SessionReportService.ts


Testes:

tests/application/session-control/


==========================================================
6. SESSION CONTROL ENGINE
==========================================================

Responsabilidade:

Orquestrar o ciclo de vida da sessão.


Estados:

CREATED

ACTIVE

PAUSED

STOP_LOSS_TRIGGERED

STOP_WIN_TRIGGERED

FINISHED


Entrada:

- sessionId;
- bankroll inicial;
- configuração da mesa;
- limites de risco.


Saída:

Estado atual da sessão.

==========================================================
7. BANKROLL MANAGER
==========================================================

Responsabilidade:

Gerenciar a banca operacional da sessão.


Campos mínimos:

initialBankroll

currentBankroll

profitLoss

roi

highestBalance

lowestBalance


Regras:

- atualização incremental;
- sem reprocessamento histórico;
- operação O(1).

==========================================================
8. CONFIGURAÇÃO DE MESA
==========================================================

O usuário poderá selecionar:

----------------------------------------------------------
Pragmatic
----------------------------------------------------------

Ficha mínima:

R$ 0,10


----------------------------------------------------------
Evolution
----------------------------------------------------------

Ficha mínima:

R$ 0,50


Configuração:

tableProvider

minimumChipValue


A stake sugerida deve respeitar múltiplos válidos da mesa selecionada.

==========================================================
9. RISK LIMIT CALCULATOR
==========================================================

Responsável por calcular:

----------------------------------------------------------
STOP LOSS
----------------------------------------------------------

Padrão:

15% da banca inicial


----------------------------------------------------------
STOP WIN
----------------------------------------------------------

Padrão:

30% da banca inicial


Exemplo:

Banca:

R$ 1.000


Stop Loss:

R$ 850


Stop Win:

R$ 1.300


Deve permitir evolução futura para configuração personalizada.

==========================================================
10. STOP LOSS MANAGER
==========================================================

Responsabilidade:

Monitorar perda máxima.


Quando:

currentBankroll <= stopLossLimit


Emitir:

STOP_LOSS_TRIGGERED


==========================================================
11. STOP WIN MANAGER
==========================================================

Responsabilidade:

Monitorar ganho máximo.


Quando:

currentBankroll >= stopWinLimit


Emitir:

STOP_WIN_TRIGGERED


==========================================================
12. SESSION PROGRESS CALCULATOR
==========================================================

Responsabilidade:

Calcular progresso visual.


Exibir:

- distância até Stop Win;
- distância até Stop Loss.


Exemplo:

Stop Win:

██████░░░░

60%


Stop Loss:

██░░░░░░░░

20%

==========================================================
13. SESSION AUDIT SNAPSHOT
==========================================================

Criar entidade imutável.


Campos mínimos:

sessionId

startTime

endTime

initialBankroll

finalBankroll

totalRounds

totalSuggestions

confirmedSuggestions

skippedSuggestions

wins

losses

roi

stopReason

strategyPerformance


Adicionar:

SHA-256 hash.


==========================================================
14. SESSION HISTORY
==========================================================

Responsabilidade:

Armazenar sessões finalizadas.


Modelo:

Append Only.


Nenhuma sessão deve ser sobrescrita.

==========================================================
15. SESSION REPORT SERVICE
==========================================================

Criar endpoints:

GET /api/operator/session/current


Retornar:

- banca atual;
- lucro/prejuízo;
- stop loss;
- stop win;
- progresso.


GET /api/operator/session/history


Retornar:

- sessões encerradas;
- auditorias;
- evolução histórica.

==========================================================
16. FLUXO DE RECOMENDAÇÃO
==========================================================

Novo fluxo:


Recommendation Engine

↓

Strategy Recommendation

↓

Usuário recebe sugestão

↓

Usuário decide:

CONFIRMAR

ou

PULAR

↓

Session Control Engine

↓

Shadow Paper Trading

↓

Performance Layers


==========================================================
17. CONFIRMAÇÃO MANUAL DE APOSTA
==========================================================

Toda sugestão deve permitir:


Exemplo:


Estratégia:

GRID 1-3


Stake:

R$ 5,00


Confirmar aposta?


[CONFIRMAR]

[PULAR]


O sistema nunca deve assumir execução automática.

==========================================================
18. CONTROLE DE STAKE
==========================================================

A stake deve considerar:

- banca atual;
- estratégia;
- mesa selecionada;
- ficha mínima.


Arredondamento obrigatório conforme:

Pragmatic:

múltiplos de R$ 0,10


Evolution:

múltiplos de R$ 0,50


==========================================================
19. DÚZIA E COLUNA
==========================================================

Quando a recomendação for:

Dúzia:

Exibir:

Dúzia selecionada

Valor total

Distribuição da stake


Exemplo:


Dúzia 1

R$ 6,00


Quando for:

Coluna:


Coluna 2

R$ 10,00


==========================================================
20. RESTAURAÇÃO DO TERMINAL SYNC
==========================================================

Restaurar comando:

sync


Responsabilidade:

Receber últimos 200 giros.


Funções:

- atualizar histórico;
- alimentar motores existentes;
- manter auditoria.

==========================================================
21. EVENTOS
==========================================================

Consumir:


ROUND_PROCESSED

RECOMMENDATION_GENERATED

SHADOW_TRADE_SIMULATED

SESSION_UPDATED


Criar:


SESSION_STARTED

BANKROLL_UPDATED

STOP_LOSS_TRIGGERED

STOP_WIN_TRIGGERED

SESSION_FINISHED


==========================================================
22. DECISION LEDGER
==========================================================

Registrar:


SESSION_STARTED

BANKROLL_UPDATED

STOP_LOSS_TRIGGERED

STOP_WIN_TRIGGERED

SESSION_FINISHED


Modelo:

Append Only.


Nunca modificar eventos existentes.

==========================================================
23. UX MOBILE FIRST
==========================================================

Criar HUD simplificado.


Informações principais:


- banca atual;
- lucro/prejuízo;
- giro atual;
- estratégia sugerida;
- stake;
- confirmar;
- pular;
- progresso stop loss;
- progresso stop win.


O HUD não deve exibir informações institucionais complexas.

==========================================================
24. MODAL FINAL DE SESSÃO
==========================================================

Ao atingir limite:


Exibir:


Sessão Finalizada


Motivo:

STOP WIN ou STOP LOSS


Dados:


Banca inicial

Banca final

Resultado %

Quantidade de giros

Estratégias utilizadas

Performance da sessão


==========================================================
25. TESTES OBRIGATÓRIOS
==========================================================

Criar testes:


SessionControlEngine:

- criação;
- atualização;
- encerramento.


BankrollManager:

- lucro;
- perda;
- ROI.


StopLossManager:

- acionamento.


StopWinManager:

- acionamento.


SessionAuditSnapshot:

- hash;
- imutabilidade.


==========================================================
26. VALIDAÇÃO FINAL
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
27. CRITÉRIOS DE HOMOLOGAÇÃO
==========================================================

Sprint considerada concluída somente quando:


[ ] Session Control Engine implementado.

[ ] Controle de banca funcionando.

[ ] Stop Loss 15% funcionando.

[ ] Stop Win 30% funcionando.

[ ] Confirmação manual funcionando.

[ ] Stake adaptada à mesa.

[ ] Sync dos últimos 200 giros restaurado.

[ ] Auditoria de sessão funcionando.

[ ] HUD Mobile First implementado.

[ ] IntelligenceRuntime preservado.

[ ] Quantitative Pipeline preservado.

[ ] Frontend Thin Client preservado.

[ ] Paper Trading Only preservado.


==========================================================
DECLARAÇÃO FINAL
==========================================================

ADR-034 — Session Control & Bankroll Management Engine Architecture


Define a camada operacional responsável por conectar a inteligência institucional do RL.SYS CORE com a experiência prática do usuário final.


A Sprint-042 deverá implementar controle seguro de sessão, gerenciamento de banca, proteção de risco e auditoria sem alterar qualquer motor quantitativo existente.
