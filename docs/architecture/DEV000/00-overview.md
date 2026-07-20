# DEV000 — Decision Intelligence Core
## Documento 00 — Visão Geral

**Status:** Em elaboração

**Versão:** 1.0

**Autor da Arquitetura:** ChatGPT (System Architect)

---

# 1. Objetivo

A DEV000 representa a evolução arquitetural mais importante do RL.SYS CORE desde a criação do projeto.

O objetivo desta iniciativa é desacoplar completamente a inteligência de decisão do restante da aplicação, transformando o atual motor decisório em um subsistema independente, modular, extensível e testável.

Ao final da DEV000, o hook `useTacticalEngine` deixará de ser responsável pela tomada de decisão. Sua responsabilidade será apenas coordenar estados da interface, persistência local e fluxo operacional.

Toda a lógica de análise passará a ser executada pelo novo **Decision Intelligence Core**.

---

# 2. Motivação

O motor atual foi desenvolvido de forma incremental.

Com a evolução do projeto, ele passou a concentrar responsabilidades distintas:

- leitura do histórico;
- cálculo de Markov;
- análise de entropia;
- avaliação de estratégias;
- gerenciamento de risco;
- seleção da estratégia ativa;
- cálculo de stake;
- geração da justificativa.

Embora funcional, esse acoplamento dificulta:

- manutenção;
- testes unitários;
- evolução dos algoritmos;
- inclusão de novos modelos;
- comparação entre motores decisórios.

A DEV000 elimina esse problema.

---

# 3. Objetivos Arquiteturais

A nova arquitetura deverá:

- separar análise de decisão da interface;
- eliminar regras espalhadas pelo hook React;
- permitir múltiplos motores de decisão;
- permitir testes independentes;
- reduzir acoplamento;
- aumentar a capacidade de evolução futura.

---

# 4. O que NÃO muda

Esta arquitetura não altera:

- HUD institucional;
- gerenciamento da banca;
- Stop Loss;
- Take Profit;
- Burn-In;
- Cooldown;
- Shadow Learning;
- LocalStorage;
- ingestão dos giros;
- definição das estratégias;
- layouts;
- componentes React.

Toda alteração ocorrerá exclusivamente na camada de decisão.

---

# 5. O novo conceito

A arquitetura passa a funcionar como um pipeline.

```
Entrada de Dados

↓

Feature Extraction

↓

Decision Context

↓

Strategy Evaluation

↓

Risk Validation

↓

Decision Engine

↓

Recomendação Final

↓

HUD
```

Cada etapa possui responsabilidade única.

Nenhuma etapa conhece detalhes internos das demais.

---

# 6. Benefícios

A DEV000 permitirá futuramente:

- Decision Engines alternativos;
- Ensemble de modelos;
- IA supervisionada;
- comparação entre motores;
- simulações offline;
- replay completo das sessões;
- aprendizado incremental;
- otimização automática.

---

# 7. Resultado esperado

Após a conclusão da DEV000, o RL.SYS CORE possuirá uma arquitetura de decisão semelhante à utilizada em plataformas institucionais de análise quantitativa, onde cada componente é independente, reutilizável e validado isoladamente.

Essa separação prepara o sistema para futuras evoluções sem necessidade de reescrever o restante da aplicação.

---

# Próximo Documento

Documento 01 — Princípios Arquiteturais.
