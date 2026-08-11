# ADR-040 — Operational Configuration Architecture (OCA)

Status: ACCEPTED

Sprint: 048

Data: 2026-07-28

Autores:
RL.SYS CORE Architecture Board

---

# Contexto

Até a Sprint-047 o RL.SYS CORE consolidou sua arquitetura institucional, motores de inteligência, auditoria, Session Startup Wizard e fluxo operacional.

Entretanto, diversos parâmetros operacionais continuam distribuídos em diferentes componentes do sistema.

Exemplos:

- provedor da mesa;
- ficha mínima;
- banca padrão;
- idioma;
- tema;
- preferências do operador;
- warmup automático;
- sincronização automática;
- parâmetros do HUD;
- preferências do Terminal.

Essas configurações devem passar a existir em um único domínio institucional.

Nenhuma regra quantitativa poderá depender diretamente do Frontend.

Todo o estado deverá permanecer centralizado no Backend.

---

# Problema

Hoje as configurações operacionais tendem a ficar espalhadas entre:

- Session Startup Wizard
- Session Control
- Operator HUD
- Terminal
- PWA

Essa fragmentação dificulta:

- manutenção;
- auditoria;
- persistência;
- restauração da sessão;
- futura sincronização em nuvem.

---

# Decisão

Criar uma nova camada institucional denominada:

Operational Configuration Architecture (OCA)

Responsável exclusivamente pelo gerenciamento das preferências operacionais do RL.SYS CORE.

A camada OCA não poderá conter nenhuma lógica quantitativa.

Sua responsabilidade será apenas disponibilizar configurações institucionais para os demais módulos.

---

# Objetivos

Centralizar:

- provedor padrão;
- ficha mínima;
- banca padrão;
- idioma;
- tema;
- warmup automático;
- sincronização automática;
- parâmetros do HUD;
- preferências do Terminal;
- preferências do Startup Wizard.

---

# Nova Estrutura

Criar:

src/application/configuration/

Arquivos:

OperationalConfiguration.ts

ConfigurationEngine.ts

ConfigurationValidator.ts

ConfigurationSnapshot.ts

ConfigurationHistory.ts

ConfigurationReportService.ts

ProviderConfiguration.ts

ThemeConfiguration.ts

LanguageConfiguration.ts

HudConfiguration.ts

TerminalConfiguration.ts

StartupConfiguration.ts

---

# OperationalConfiguration

Entidade principal.

Campos mínimos:

provider

minimumChipValue

defaultBankroll

theme

language

autoWarmup

autoSyncHistory

defaultSyncRounds

hudCompactMode

terminalAutocomplete

terminalHistorySize

confirmSuggestions

showAdvancedMetrics

createdAt

updatedAt

version

hash

Todos os objetos deverão ser imutáveis.

Object.freeze()

SHA-256 obrigatório.

---

# ProviderConfiguration

Suporte inicial:

Pragmatic

minimumChipValue = R$ 0,10

Evolution

minimumChipValue = R$ 0,50

Arquitetura preparada para novos provedores.

---

# ThemeConfiguration

Suporte:

LIGHT

DARK

SYSTEM

O Frontend apenas renderiza.

Toda preferência permanece registrada no Backend.

---

# LanguageConfiguration

Suporte inicial:

pt-BR

Arquitetura preparada para:

en-US

es-ES

Sem alterar regras de negócio.

---

# HudConfiguration

Centralizar:

modo compacto

mostrar progresso

mostrar banca

mostrar estratégia

mostrar stake

mostrar indicadores institucionais

tamanho dos cartões

densidade visual

---

# TerminalConfiguration

Centralizar:

autocomplete

histórico máximo

atalhos

comandos favoritos

sync padrão

warmup automático

---

# StartupConfiguration

Centralizar:

mesa padrão

banca padrão

warmup automático

sync automático

quantidade padrão de giros

entrada automática no HUD

---

# ConfigurationEngine

Responsável por:

carregar configuração

alterar configuração

validar configuração

publicar eventos

registrar histórico

Nunca alterar motores quantitativos.

---

# ConfigurationValidator

Validar:

provedor válido

tema válido

idioma válido

banca maior que zero

ficha mínima válida

histórico permitido

sincronização permitida

warmup permitido

---

# ConfigurationSnapshot

Snapshot institucional.

Campos:

configuration

timestamp

version

hash

Object.freeze()

SHA-256

Append Only.

---

# ConfigurationHistory

Histórico FIFO.

MAX_HISTORY = 100

Complexidade O(1).

Nunca alterar snapshots anteriores.

---

# EventBus

Consumir:

SYSTEM_STARTED

SESSION_STARTED

STARTUP_FINISHED

Emitir:

CONFIGURATION_UPDATED

CONFIGURATION_LOADED

CONFIGURATION_RESTORED

---

# DecisionLedger

Registrar:

CONFIGURATION_UPDATED

CONFIGURATION_RESTORED

Formato:

Append Only.

---

# REST API

Criar:

GET /api/operator/configuration

GET /api/operator/configuration/history

PUT /api/operator/configuration

---

# Frontend

Modificar:

pwa-terminal/src/core/dto.ts

Adicionar:

OperationalConfigurationDTO

Modificar:

OperatorConsole.tsx

Criar tela:

CONFIGURAÇÕES

Categorias:

Mesa

Banca

HUD

Terminal

Idioma

Tema

Sistema

Todo cálculo permanece no Backend.

Frontend continua Thin Client.

---

# Testes

Criar:

tests/application/configuration/

ConfigurationEngine.test.ts

ConfigurationValidator.test.ts

ConfigurationSnapshot.test.ts

ConfigurationHistory.test.ts

ConfigurationReportService.test.ts

Cobrir:

persistência

imutabilidade

hash

validação

histórico

eventos

---

# Restrições Arquiteturais

Manter obrigatoriamente:

IntelligenceRuntime

Single Point of Execution

QuantitativeEnginePipeline

INTACTO

Recommendation Engine

INTACTO

Session Control

INTACTO

Startup Wizard

INTACTO

Operational Terminal

INTACTO

Institutional AI

INTACTA

PaperOnly=true

ProductionMoneyAllowed=false

DecisionLedger Append Only

RuntimeTelemetry desacoplado

RuntimeEventBus unidirecional

Frontend Thin Client

---

# Consequências

Positivas

Configuração centralizada.

Persistência institucional.

Preparação para sincronização futura.

Facilidade para backup.

Arquitetura preparada para múltiplos operadores.

Melhor manutenção.

Negativas

Novo domínio arquitetural.

Maior número de objetos de configuração.

Necessidade de testes adicionais.

---

# Critérios de Aceite

Build:

SUCCESS

Vitest:

100%

Madge:

Zero dependências circulares.

Nenhuma lógica quantitativa poderá ser movida para o Frontend.

Toda configuração operacional deverá passar exclusivamente pelo ConfigurationEngine.

---

# Conclusão

A Operational Configuration Architecture estabelece um domínio institucional único para gerenciamento de preferências operacionais do RL.SYS CORE, eliminando configurações dispersas, preservando os princípios de Clean Architecture, Domain Driven Design, Thin Client, Append Only e Single Point of Execution, além de preparar a plataforma para futuras funcionalidades como sincronização em nuvem e múltiplos perfis de operador.
