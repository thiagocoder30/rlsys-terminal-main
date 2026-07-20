# DEV000 — Decision Intelligence Core
## Documento 01 — Princípios Arquiteturais

**Status:** Aprovado

**Versão:** 1.0

**Autor da Arquitetura:** ChatGPT (System Architect)

---

# 1. Objetivo

Este documento estabelece os princípios arquiteturais obrigatórios da DEV000.

Todos os componentes implementados nesta iniciativa deverão obedecer integralmente às regras aqui descritas.

Estas regras possuem prioridade sobre decisões locais de implementação.

---

# 2. Responsabilidade Única

Cada módulo deverá possuir apenas uma responsabilidade.

Exemplos:

- EntropyAnalyzer calcula apenas entropia.
- MarkovAnalyzer calcula apenas probabilidades de transição.
- StrategyScoreEngine apenas pontua estratégias.
- ExposureController apenas controla exposição.
- DecisionEngine apenas orquestra a decisão.

Nenhum componente poderá assumir responsabilidades pertencentes a outro módulo.

---

# 3. Arquitetura Orientada a Pipeline

A tomada de decisão deverá ocorrer em estágios sequenciais.

```
Histórico

↓

Extração de Features

↓

Contexto Decisório

↓

Avaliação das Estratégias

↓

Validação de Risco

↓

Decisão Final
```

Cada estágio recebe dados do estágio anterior e produz novos dados para o próximo.

Não serão permitidos atalhos entre etapas.

---

# 4. Desacoplamento

Nenhum módulo poderá acessar diretamente:

- React
- Hooks
- LocalStorage
- Componentes da interface
- HUD
- Estado visual

O núcleo decisório deverá ser totalmente independente da camada de apresentação.

---

# 5. Inversão de Dependências

O Decision Engine dependerá apenas de contratos.

Nunca dependerá de implementações específicas.

Exemplo:

Correto:

```
DecisionEngine
        ↓
IStrategy
```

Incorreto:

```
DecisionEngine
        ↓
FusionStrategy
```

Novas estratégias deverão ser adicionadas sem alterar o Decision Engine.

---

# 6. Determinismo

Dado exatamente o mesmo contexto de entrada, o motor deverá produzir exatamente a mesma decisão.

Não será permitido:

- números aleatórios;
- fatores ocultos;
- estados implícitos;
- dependências externas.

Isso garante:

- reprodutibilidade;
- auditoria;
- replay;
- testes confiáveis.

---

# 7. Imutabilidade

Os objetos de entrada não poderão ser modificados.

Todo processamento produzirá novos objetos.

Exemplo:

Correto:

```
input → processamento → output
```

Incorreto:

```
input → alteração direta
```

Essa regra evita efeitos colaterais e facilita testes.

---

# 8. Transparência

Toda decisão deverá possuir justificativa explícita.

Não existirão decisões "caixa-preta".

Cada recomendação deverá informar:

- motivo da aprovação;
- motivo da rejeição;
- confiança;
- fatores utilizados;
- riscos identificados.

O sistema deverá ser totalmente auditável.

---

# 9. Testabilidade

Todo componente deverá possuir testes unitários independentes.

Nenhum teste poderá depender:

- da interface;
- do navegador;
- do React;
- do LocalStorage.

Cada módulo deverá ser validado isoladamente.

---

# 10. Escalabilidade

A arquitetura deverá permitir adicionar novos analisadores sem modificar os existentes.

Exemplo futuro:

```
DecisionEngine

├── EntropyAnalyzer
├── MarkovAnalyzer
├── FrequencyAnalyzer
├── SectorAnalyzer
├── BayesianAnalyzer
├── PatternAnalyzer
├── MonteCarloAnalyzer
└── NeuralAnalyzer
```

O crescimento deverá ocorrer por extensão, nunca por reescrita.

---

# 11. Compatibilidade Retroativa

Durante a implementação da DEV000 deverão permanecer inalterados:

- HUD institucional;
- fluxo operacional;
- gerenciamento da banca;
- Stop Loss;
- Take Profit;
- Burn-In;
- Cooldown;
- ingestão dos giros;
- LocalStorage;
- definição das estratégias.

A migração deverá ocorrer apenas na camada de decisão.

---

# 12. Institucionalização

O Decision Intelligence Core deverá comportar-se como um subsistema independente.

No futuro ele poderá ser utilizado por:

- RL.SYS CORE;
- simuladores;
- replay offline;
- backtesting;
- treinamento supervisionado;
- motores de IA;
- serviços externos.

Nenhuma dependência da interface deverá impedir essa reutilização.

---

# 13. Evolução Contínua

Toda nova funcionalidade relacionada à decisão deverá ser incorporada ao Decision Intelligence Core.

Não serão aceitas novas regras de decisão implementadas diretamente no hook `useTacticalEngine`.

O hook permanecerá responsável apenas por:

- coordenar estados;
- atualizar interface;
- encaminhar eventos;
- receber a decisão produzida pelo núcleo.

---

# 14. Critérios de Conclusão da DEV000

A DEV000 será considerada concluída quando:

- todo o processo decisório estiver desacoplado do React;
- existir um Decision Engine independente;
- todas as decisões forem auditáveis;
- todos os módulos possuírem testes unitários;
- novas estratégias puderem ser adicionadas sem alterar o núcleo decisório.

---

# Próximo Documento

Documento 02 — Arquitetura Geral do Decision Intelligence Core.
