ADR-033
MOBILE OPERATOR EXPERIENCE ARCHITECTURE (MOEA)

STATUS:
ACCEPTED

DATA:
2026-07-28

PROJETO:
RL.SYS CORE v5.x

FASE:
UX Institutional Layer

SPRINT RELACIONADA:
SPRINT-041 — Mobile Operator HUD & Session Control Foundation


==========================================================
1. CONTEXTO
==========================================================

Após a conclusão da camada institucional de inteligência:

- Shadow Paper Trading;
- Feedback Governance;
- Decision Replay;
- Knowledge Base;
- Institutional Learning;
- Predictive Scenario Simulation;
- Multi-Session Intelligence;
- Portfolio Intelligence;
- Strategy Evolution Governance;
- Institutional AI Decision Layer;

o RL.SYS CORE possui uma arquitetura completa de inteligência institucional.

Entretanto, a interface atual não representa adequadamente a experiência operacional real do usuário em uma mesa de roleta.

O operador necessita de uma interface:

- simples;
- rápida;
- responsiva;
- otimizada para smartphone;
- focada no giro atual;
- sem excesso de informações técnicas;
- sem exposição desnecessária da complexidade interna.


==========================================================
2. PROBLEMA ARQUITETURAL
==========================================================

O HUD atual possui excesso de informações institucionais.

Embora adequado para auditoria e desenvolvimento, ele não é ideal para operação real.

O usuário durante uma sessão precisa responder rapidamente:

1.

Qual é o estado atual da mesa?

2.

O sistema recomenda entrada?

3.

Qual estratégia devo executar?

4.

Quanto devo apostar?

5.

Qual valor colocar em cada dúzia/coluna?

6.

Estou próximo do Stop Win ou Stop Loss?

7.

Quando devo encerrar a sessão?


==========================================================
3. OBJETIVO DA ADR
==========================================================

Criar uma nova camada de experiência operacional móvel.

A Mobile Operator Experience Architecture deve separar:

INSTITUTIONAL INTELLIGENCE

de

OPERATOR EXPERIENCE


A inteligência continua complexa internamente.

A apresentação para o usuário deve ser simples.


==========================================================
4. PRINCÍPIOS ARQUITETURAIS
==========================================================


4.1 Thin Client Absoluto

O frontend:

NÃO calcula:

- estratégias;
- probabilidades;
- stakes;
- risco;
- stop;
- performance.


O frontend somente:

- recebe DTOs;
- apresenta informações;
- envia comandos operacionais.


==========================================================


4.2 Mobile First

A interface deve priorizar:

Smartphones Android.

Características:

- layout vertical;
- botões grandes;
- leitura rápida;
- baixa quantidade de elementos;
- operação com uma mão.


==========================================================


4.3 Separação HUD Operacional x HUD Institucional


Criar dois níveis:


HUD OPERACIONAL

Para uso durante a mesa.


HUD INSTITUCIONAL

Para análise profunda.


O operador comum não deve precisar acessar todos os indicadores internos.


==========================================================
5. NOVO FLUXO OPERACIONAL
==========================================================


Inicialização:

Usuário abre aplicação.


↓

Configuração da mesa:

Seleciona:

PRAGMATIC

Ficha mínima:
R$ 0,10


ou


EVOLUTION

Ficha mínima:
R$ 0,50


↓

Configura banca:


Comando:

setbankroll


Exemplo:

setbankroll 1000


Sistema calcula:


Stop Loss:

15%


Stop Win:

30%


↓

Usuário sincroniza histórico:


Comando:

sync


Entrada:

Últimos 200 giros.


↓

Sistema processa:

- histórico;
- regime;
- estratégias;
- indicadores institucionais.


↓

Inicia sessão.


==========================================================
6. NOVO HUD OPERACIONAL
==========================================================


O HUD principal deve conter somente:


==========================================================

STATUS DA MESA

- Plataforma selecionada;
- banca atual;
- giro atual;
- últimos resultados.


==========================================================

RECOMENDAÇÃO ATUAL


Exibir:


Estratégia:

ZONE_TIERS


ou

GRID


ou

DOZEN


etc.


Confiança:


Alta
Média
Baixa


==========================================================

AÇÃO DO USUÁRIO


Botões:


CONFIRMAR ENTRADA


ou


PULAR GIRO


Motivo:

Usuário pode estar apenas sincronizando histórico.


==========================================================

STAKE


Exibir:

Valor total:


R$ X


Quantidade de fichas:


X fichas


==========================================================

Caso seja DÚZIA:


Exemplo:


Dúzia 1:

R$ 5,00


Dúzia 2:

R$ 0,00


Dúzia 3:

R$ 0,00


Stake total:

R$ 5,00


==========================================================

Caso seja COLUNA:


Exemplo:


Coluna 1:

R$ 5,00


Coluna 2:

R$ 0,00


Coluna 3:

R$ 0,00


Stake total:

R$ 5,00


==========================================================


7. SISTEMA DE STAKE
==========================================================


A stake deve considerar:


Mesa:


Pragmatic:

Ficha mínima:
0,10


Evolution:

Ficha mínima:
0,50


Nunca gerar valor incompatível.


Exemplo:


Stake calculada:

R$ 3,70


Sistema deve converter:


Pragmatic:

37 fichas


Evolution:

7 fichas + ajuste permitido


Sempre respeitando unidade mínima.


==========================================================
8. CONTROLE DE BANCA
==========================================================


Criar:


Bankroll Session Manager


Responsável:


initialBankroll

currentBankroll

profitLoss

roi

stopLossLimit

stopWinLimit


==========================================================


9. STOP MANAGEMENT
==========================================================


Políticas:


STOP LOSS:

15%


STOP WIN:

30%


Exemplo:


Banca:

R$ 1000


Stop Loss:

R$ 850


Stop Win:

R$ 1300


==========================================================


Criar barra visual:


SESSION PROGRESS


Representação:


Loss ←──────────────→ Win


Atualizada a cada giro.


==========================================================
10. ENCERRAMENTO AUTOMÁTICO DE SESSÃO
==========================================================


Quando atingir:


STOP LOSS

ou


STOP WIN


Sistema deve:


1.

Bloquear novas recomendações.


2.

Exibir modal.


3.

Gerar Session Report.


4.

Salvar auditoria.


==========================================================
11. SESSION REPORT
==========================================================


Ao finalizar:


Exibir:


Resumo da sessão:


Data:

Hora inicial:

Hora final:


Banca inicial:

Banca final:


Resultado:


ROI:


Quantidade de giros:


Quantidade entradas:


Wins:

Losses:


Estratégias utilizadas:


Melhor estratégia:


Pior estratégia:


Motivo encerramento:

STOP WIN

ou

STOP LOSS


==========================================================
12. AUDITORIA DE SESSÃO
==========================================================


Criar:


Session Audit Layer


Responsável:


Guardar:


- histórico completo;
- decisões;
- entradas confirmadas;
- entradas puladas;
- resultados;
- evolução da banca.


Formato:

Append Only.


==========================================================
13. TERMINAL INTERATIVO
==========================================================


Restaurar terminal operacional.


Comandos:


sync

Importa últimos 200 giros.


setbankroll

Atualiza banca.


session

Mostra estado atual.


report

Exibe relatório.


audit

Consulta sessões anteriores.


==========================================================
14. INTEGRAÇÃO COM ARQUITETURA EXISTENTE
==========================================================


Não modificar:


IntelligenceRuntime

QuantitativePipeline

RecommendationEngine

Shadow Engine

Learning Engine

Predictive Engine

Portfolio Intelligence

Institutional AI Decision Layer


A nova camada somente consome:


ObservabilityEventBus


e

Runtime APIs.


==========================================================
15. RESULTADO ESPERADO
==========================================================


Ao final desta arquitetura:


O usuário consegue:


- iniciar uma sessão;
- sincronizar histórico;
- configurar banca;
- escolher mesa;
- receber recomendação;
- confirmar ou pular;
- visualizar stake;
- acompanhar stop;
- finalizar sessão automaticamente;
- consultar auditoria.


Mantendo:


Single Point of Execution.

Thin Client.

Paper Trading Only.

DecisionLedger Append Only.

Arquitetura institucional intacta.


==========================================================
16. DECISÃO
==========================================================


APROVADO


A ADR-033 estabelece a fundação para a fase UX operacional do RL.SYS CORE.

A próxima implementação autorizada é:


SPRINT-041

MOBILE OPERATOR HUD & SESSION CONTROL FOUNDATION
