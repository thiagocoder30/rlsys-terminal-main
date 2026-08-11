# ADR-039 — Session Startup Wizard Architecture

**Status:** ACCEPTED

**Sprint:** 047

**Título:** Session Startup Wizard Architecture (SSWA)

---

# 1. Contexto

Após a consolidação das camadas institucionais do RL.SYS CORE (Intelligence Runtime, Session Control, Session Audit, Session Intelligence, Institutional AI, Portfolio Intelligence e Operational Terminal), observou-se que o início de uma sessão ainda depende de diversas ações manuais executadas pelo operador.

Embora essas ações já estejam disponíveis, elas permanecem distribuídas entre diferentes componentes:

- seleção da mesa;
- configuração da banca;
- sincronização dos últimos giros;
- execução do warmup;
- abertura da sessão;
- entrada no HUD operacional.

Essa fragmentação aumenta o tempo necessário para iniciar uma sessão e cria oportunidades para erros operacionais.

É necessário criar um fluxo único e guiado que organize essas etapas sem alterar a arquitetura já estabelecida.

---

# 2. Problema

Hoje o operador precisa executar manualmente diversas etapas antes da primeira recomendação.

Esse processo:

- aumenta a carga cognitiva;
- aumenta a probabilidade de erros;
- dificulta o uso em smartphones;
- prejudica a experiência do operador.

O sistema deve conduzir o operador por um único fluxo de inicialização.

---

# 3. Decisão

Será criada a **Session Startup Wizard Architecture (SSWA)**.

O Wizard será responsável apenas por orquestrar o início da sessão.

Toda a lógica continuará pertencendo aos serviços já existentes.

O Wizard não implementará nenhuma regra de negócio.

Ele apenas coordenará a sequência correta das operações.

---

# 4. Objetivos

O Wizard deverá:

- reduzir o número de ações necessárias;
- eliminar erros de configuração;
- padronizar todas as sessões;
- preparar automaticamente o ambiente operacional;
- funcionar perfeitamente em smartphones.

---

# 5. Escopo

O Wizard será composto pelas seguintes etapas obrigatórias:

## Etapa 1 — Seleção da Mesa

Permitir seleção de:

- Pragmatic
- Evolution

Exibir automaticamente:

- valor mínimo da ficha;
- múltiplos permitidos para stakes.

---

## Etapa 2 — Configuração da Banca

Solicitar:

Banca Inicial

Exemplo:

R$ 1.000,00

Encaminhar para:

SessionControlEngine

↓

BankrollManager

---

## Etapa 3 — Sincronização

Executar:

sync

Importar:

Últimos 200 giros

Atualizar:

- Runtime;
- Warmup;
- Histórico.

Nenhuma lógica será implementada no Wizard.

---

## Etapa 4 — Warmup

Executar o processo institucional de aquecimento.

Objetivo:

Preparar os motores quantitativos para a sessão.

O Wizard apenas solicitará a execução.

---

## Etapa 5 — Validação

Verificar:

✓ Runtime ativo

✓ Warmup concluído

✓ Histórico sincronizado

✓ Session Control iniciado

✓ Bankroll registrada

Caso alguma etapa falhe:

Interromper o fluxo.

Apresentar mensagem amigável.

---

## Etapa 6 — Entrada na Sessão

Abrir automaticamente:

Operational HUD

A sessão passa ao estado:

ACTIVE

---

# 6. Estrutura Esperada

Criar:

src/application/session-startup/

Arquivos previstos:

SessionStartupWizard.ts

StartupFlow.ts

StartupValidator.ts

StartupProgress.ts

StartupHistory.ts

SessionStartupReportService.ts

---

Criar testes:

tests/application/session-startup/

SessionStartupWizard.test.ts

StartupValidator.test.ts

StartupProgress.test.ts

SessionStartupReportService.test.ts

---

# 7. Fluxo Arquitetural

Operator

↓

Session Startup Wizard

↓

Table Selection

↓

Bankroll Configuration

↓

Sync

↓

Warmup

↓

Validation

↓

Session Control

↓

Operational HUD

↓

Intelligence Runtime

O Intelligence Runtime permanece como Single Point of Execution.

---

# 8. Integrações

O Wizard deverá integrar-se exclusivamente através dos serviços existentes.

Consumirá:

SessionControlEngine

BankrollManager

OperationalTerminal

SessionAuditReportService

RuntimeController

Warmup Service

IntelligenceRuntime

Nenhum acoplamento direto com motores quantitativos será permitido.

---

# 9. Event Bus

Consumir:

RUNTIME_READY

SYNC_COMPLETED

WARMUP_COMPLETED

SESSION_STARTED

Emitir:

STARTUP_STARTED

STARTUP_STEP_COMPLETED

STARTUP_VALIDATED

STARTUP_FINISHED

Todos os eventos deverão seguir o fluxo unidirecional do RuntimeEventBus.

---

# 10. Decision Ledger

Registrar:

STARTUP_STARTED

STARTUP_COMPLETED

Formato:

Append Only

Nenhum evento poderá ser alterado posteriormente.

---

# 11. Interface (PWA)

Adicionar um Wizard Mobile First composto por seis etapas.

Cada etapa deverá apresentar:

- título;
- descrição;
- progresso;
- botão "Próximo";
- botão "Voltar" (quando aplicável).

Ao final:

Entrar automaticamente no Operational HUD.

Nenhuma lógica de negócio será executada no frontend.

O Frontend continuará atuando exclusivamente como Thin Client.

---

# 12. Princípios Arquiteturais

A Sprint deverá preservar obrigatoriamente:

✓ IntelligenceRuntime como Single Point of Execution.

✓ QuantitativeEnginePipeline intacto.

✓ Recommendation Engine intacto.

✓ Dynamic Strategy Weight Calibration intacto.

✓ Session Control intacto.

✓ Session Audit intacto.

✓ Session Intelligence intacta.

✓ Institutional AI intacta.

✓ Portfolio Intelligence intacta.

✓ Operational Terminal intacto.

✓ RuntimeTelemetry desacoplado.

✓ RuntimeEventBus unidirecional.

✓ DecisionLedger Append Only.

✓ Paper Trading Only.

✓ ProductionMoneyAllowed = false.

---

# 13. Benefícios Esperados

Após a implementação desta ADR:

- o operador iniciará uma sessão em poucos passos;
- todas as configurações serão padronizadas;
- o ambiente estará sempre preparado antes da primeira recomendação;
- a experiência em smartphones será significativamente simplificada;
- o RL.SYS dará mais um passo em direção a uma operação quase totalmente assistida, preservando integralmente a decisão humana.

---

# 14. Consequências

Positivas:

- menor tempo de preparação;
- menor chance de erro operacional;
- fluxo padronizado;
- melhor experiência do usuário;
- maior produtividade.

Negativas:

- pequena complexidade adicional na camada Application;
- necessidade de manutenção do fluxo do Wizard conforme novas etapas forem incorporadas.

Essas desvantagens são aceitáveis diante do ganho de usabilidade e não comprometem os princípios arquiteturais do RL.SYS CORE.

---

# 15. Conclusão

A Session Startup Wizard Architecture estabelece um fluxo institucional único para inicialização de sessões, integrando componentes já existentes sem introduzir novas regras de negócio.

O Wizard atua exclusivamente como orquestrador operacional, preservando todos os princípios da arquitetura do RL.SYS CORE:

- Clean Architecture;
- Domain Driven Design;
- Thin Client;
- Single Point of Execution;
- Paper Trading Only;
- DecisionLedger Append Only;
- RuntimeEventBus Unidirecional.

Esta ADR inaugura oficialmente a Fase 6 — Eficiência Operacional do roadmap institucional.
