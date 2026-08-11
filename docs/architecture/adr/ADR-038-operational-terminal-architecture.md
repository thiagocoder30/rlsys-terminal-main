DR-038 — Operational Terminal Architecture (OTA)

Status: ACCEPTED

Sprint: 046

Data: 2026-07-28

Autores: RL.SYS Architecture Board

---

# Contexto

Durante a evolução arquitetural do RL.SYS CORE, os motores institucionais foram completamente consolidados.

Atualmente o sistema possui:

- Intelligence Runtime
- Quantitative Pipeline
- Dynamic Strategy Weight Calibration
- Strategy Evolution Governance
- Institutional AI Decision Layer
- Session Control
- Session Audit
- Session Intelligence
- Portfolio Intelligence

Toda a inteligência institucional está operacional.

Entretanto, durante a utilização prática do sistema foi identificado um problema de experiência do operador.

Nas versões anteriores do RL.SYS existia um Terminal Operacional extremamente eficiente, utilizado para alimentar rapidamente o Runtime.

Entre seus comandos estavam:

- sync
- status
- history
- audit
- setbankroll
- help
- warmup

Com a migração para a arquitetura Mobile First e Thin Client, o Terminal deixou de existir.

Isso gerou aumento da quantidade de interações necessárias para executar tarefas simples.

O objetivo desta ADR é restaurar o Terminal Operacional como uma camada institucional oficial, preservando toda a arquitetura já consolidada.

---

# Problema

O operador precisa executar rapidamente diversas operações durante uma sessão.

Exemplos:

- sincronizar histórico;
- atualizar banca;
- consultar estado do Runtime;
- consultar auditorias;
- visualizar estatísticas;
- iniciar warmup.

Realizar essas operações exclusivamente através da interface gráfica aumenta o tempo operacional.

Além disso, usuários avançados preferem comandos rápidos.

---

# Decisão

Será criada uma nova camada denominada:

Operational Terminal

Ela funcionará como uma interface institucional para interação com o Runtime.

O Terminal não conterá regras de negócio.

Ele será apenas um despachante de comandos.

Toda a lógica continuará localizada nos Engines já existentes.

---

# Objetivos

Criar uma interface rápida para:

- iniciar sessões;
- sincronizar histórico;
- consultar estado operacional;
- atualizar banca;
- executar consultas institucionais;
- acessar auditorias.

Sem alterar qualquer motor quantitativo.

---

# Princípios Arquiteturais

O Terminal deverá respeitar obrigatoriamente:

- Clean Architecture;
- Domain Driven Design;
- Single Point of Execution;
- Thin Client;
- Paper Trading Only;
- Decision Ledger Append Only;
- Runtime desacoplado.

---

# Estrutura Esperada

Criar:

src/application/terminal/

Componentes:

OperationalTerminal.ts

CommandParser.ts

CommandDispatcher.ts

TerminalCommand.ts

TerminalHistory.ts

TerminalReportService.ts

Testes:

tests/application/terminal/

OperationalTerminal.test.ts

CommandParser.test.ts

CommandDispatcher.test.ts

TerminalHistory.test.ts

TerminalReportService.test.ts

---

# Responsabilidades

## OperationalTerminal

Responsável por receber comandos.

Nunca executa regras de negócio.

Somente encaminha comandos.

---

## CommandParser

Converte texto digitado em comandos estruturados.

Exemplo:

sync

↓

TerminalCommand

---

## CommandDispatcher

Encaminha o comando para o serviço correto.

Nunca implementa lógica operacional.

---

## TerminalHistory

Mantém histórico dos comandos.

Modelo:

FIFO

MAX_HISTORY = 500

Complexidade:

O(1)

---

## TerminalReportService

Fornece:

- histórico;
- comandos disponíveis;
- estado do terminal.

---

# Comandos Institucionais

Os seguintes comandos passam a fazer parte da arquitetura oficial.

## sync

Recebe os últimos 200 giros.

Atualiza:

- Runtime;
- Warmup;
- Histórico.

---

## setbankroll

Atualiza a banca da sessão.

Exemplo:

setbankroll 1000

---

## status

Consulta:

- Runtime;
- Session Control;
- Session Intelligence;
- Session Audit.

---

## history

Mostra histórico do Terminal.

---

## audit

Abre auditoria da sessão atual.

---

## warmup

Executa aquecimento institucional.

Nunca modifica motores quantitativos.

---

## help

Lista todos os comandos disponíveis.

---

## clear

Limpa apenas a visualização do Terminal.

Nunca remove histórico institucional.

---

# Fluxo Operacional

Operador

↓

Operational Terminal

↓

Command Parser

↓

Command Dispatcher

↓

Application Services

↓

Intelligence Runtime

↓

Decision Ledger

↓

HUD Mobile

---

# Event Bus

Consumir:

- SESSION_STARTED
- SESSION_FINISHED
- BANKROLL_UPDATED
- SESSION_INTELLIGENCE_UPDATED

Emitir:

- TERMINAL_COMMAND_EXECUTED
- TERMINAL_SYNC_COMPLETED
- TERMINAL_STATUS_REQUESTED

---

# Decision Ledger

Registrar:

- TERMINAL_COMMAND_EXECUTED

Formato:

Append Only.

Nunca modificar registros existentes.

---

# Frontend

Adicionar um Terminal retrátil no HUD Mobile.

Características:

- ocupa pouco espaço;
- teclado otimizado;
- histórico de comandos;
- auto complete;
- execução rápida.

Nenhuma lógica de negócio será implementada no Frontend.

Todo processamento permanece no Backend.

---

# Restrições

É proibido:

- executar apostas;
- alterar motores quantitativos;
- modificar recomendações;
- alterar pesos das estratégias;
- alterar o Intelligence Runtime;
- alterar o Ensemble Engine;
- alterar o Market Regime Engine.

---

# Benefícios

- Maior velocidade operacional.
- Redução do número de cliques.
- Melhor experiência para operadores avançados.
- Compatibilidade com versões anteriores do RL.SYS.
- Preservação integral da arquitetura institucional.

---

# Consequências

Positivas:

- Operação mais rápida.
- Interface híbrida (HUD + Terminal).
- Melhor produtivde.
- Maior controle da sessão.

Negativas:

- Necessidade de manutenção do parser de comandos.
- Inclusão de uma nova camada de interface.

---

# Critérios de Aceitação

A Sprint será considerada concluída quando:

- Terminal operacional implementado.
- Parser funcional.
- Dispatcher desacoplado.
- Histórico FIFO implementado.
- Comandos oficiais disponíveis.
- Integração com Runtime concluída.
- Build sem erros.
- Vitest 100%.
- Madge sem dependências circulares.
- IntelligenceRuntime permanece Single Point of Execution.
- Frontend permanece Thin Client.
- DecisionLedger permanece Append Only.
- PaperOnly=true.
- ProductionMoneyAllowed=false.

---


