# DEV000 — Decision Intelligence Core
## Documento 02 — Arquitetura Geral

**Status:** Aprovado

**Versão:** 1.0

**Autor da Arquitetura:** ChatGPT (System Architect)

---

# 1. Objetivo

Este documento define a arquitetura estrutural do novo Decision Intelligence Core.

O objetivo é separar completamente a tomada de decisão da camada React, transformando o núcleo decisório em um subsistema institucional independente, modular e extensível.

Ao final da DEV000, o hook `useTacticalEngine` deixará de conter regras de decisão e passará apenas a orquestrar estados e encaminhar informações para o núcleo decisório.

---

# 2. Visão Geral da Arquitetura

O Decision Intelligence Core será organizado em camadas, cada uma com responsabilidades bem definidas.

```
                   +----------------------+
                   |  useTacticalEngine   |
                   +----------+-----------+
                              |
                              |
                              v
                   +----------------------+
                   |   Decision Engine    |
                   +----------+-----------+
                              |
        +---------------------+---------------------+
        |                     |                     |
        v                     v                     v
+---------------+    +----------------+    +----------------+
| Feature Layer |    | Scoring Layer  |    |  Risk Layer    |
+-------+-------+    +--------+-------+    +--------+-------+
        |                     |                     |
        +---------------------+---------------------+
                              |
                              v
                   +----------------------+
                   | Strategy Registry    |
                   +----------+-----------+
                              |
                              v
                   +----------------------+
                   | Decision Result      |
                   +----------------------+
```

Cada camada possui uma única responsabilidade e comunica-se apenas por contratos bem definidos.

---

# 3. Estrutura Física

A organização do código seguirá a estrutura abaixo.

```
src/
└── decision/
    ├── DecisionEngine.ts
    ├── DecisionContext.ts
    ├── DecisionResult.ts
    │
    ├── features/
    │   ├── EntropyAnalyzer.ts
    │   ├── MarkovAnalyzer.ts
    │   ├── FrequencyAnalyzer.ts
    │   ├── SectorAnalyzer.ts
    │   └── (novos analisadores)
    │
    ├── scoring/
    │   └── StrategyScoreEngine.ts
    │
    ├── risk/
    │   ├── ExposureController.ts
    │   └── DrawdownGuard.ts
    │
    └── strategies/
        └── StrategyRegistry.ts
```

Nenhum componente desta estrutura poderá importar componentes React.

---

# 4. Fluxo Completo da Decisão

A decisão ocorrerá obrigatoriamente na seguinte sequência:

```
Histórico de Giros
        │
        ▼
DecisionContext
        │
        ▼
Feature Extraction
        │
        ▼
Strategy Scoring
        │
        ▼
Risk Validation
        │
        ▼
Decision Engine
        │
        ▼
Decision Result
        │
        ▼
HUD
```

Não serão permitidos atalhos entre etapas.

---

# 5. Decision Context

O Decision Context será o único objeto aceito pelo Decision Engine.

Ele reunirá todas as informações necessárias para uma decisão.

Exemplos:

- histórico recente;
- bankroll;
- matriz de Markov;
- VIX;
- Burn-In;
- Cooldown;
- desempenho das estratégias;
- pesos dinâmicos;
- métricas estatísticas.

O Decision Engine nunca buscará informações diretamente no React.

---

# 6. Feature Layer

A Feature Layer transforma dados brutos em informações úteis.

Cada Feature Analyzer executa apenas um cálculo.

Exemplo:

```
Timeline

↓

Entropy Analyzer

↓

Entropy Score
```

Outro exemplo:

```
Timeline

↓

Frequency Analyzer

↓

Hot Numbers
```

Outro:

```
Timeline

↓

Markov Analyzer

↓

Transition Confidence
```

Cada analisador deverá ser completamente independente dos demais.

---

# 7. Strategy Scoring

Após extrair as features, inicia-se a avaliação das estratégias.

Cada estratégia receberá uma pontuação composta por múltiplos fatores.

Exemplo conceitual:

```
Score Final

=

Peso Histórico

+

Compatibilidade com Entropia

+

Compatibilidade Markov

+

Performance Recente

+

Consistência Estatística
```

O algoritmo de pontuação será documentado em detalhes em documento próprio.

---

# 8. Risk Layer

Antes da decisão final, toda recomendação será validada pela camada de risco.

A Risk Layer poderá:

- reduzir stake;
- bloquear entrada;
- cancelar decisão;
- limitar exposição;
- ativar modo conservador.

O Decision Engine nunca poderá ignorar a resposta da Risk Layer.

---

# 9. Strategy Registry

O Decision Engine não conhecerá estratégias específicas.

Ele solicitará estratégias registradas ao Strategy Registry.

Fluxo:

```
Decision Engine

↓

Strategy Registry

↓

Lista de Estratégias

↓

Avaliação

↓

Retorno da Melhor Estratégia
```

Adicionar novas estratégias nunca exigirá alterar o Decision Engine.

---

# 10. Decision Result

Toda decisão produzirá um objeto padronizado.

Exemplo conceitual:

```
DecisionResult

├── approved
├── strategy
├── confidence
├── stake
├── reason
├── analysis
└── warnings
```

A interface consumirá apenas esse objeto.

Nenhuma regra adicional será aplicada após o retorno.

---

# 11. Papel do useTacticalEngine

Após a DEV000, o hook será apenas um coordenador.

Responsabilidades mantidas:

- ingestão dos giros;
- atualização da HUD;
- persistência;
- gerenciamento da banca;
- gerenciamento de sessão;
- sincronização da interface.

Responsabilidades removidas:

- escolha da estratégia;
- cálculo de score;
- decisão de entrada;
- validação estatística;
- análise de risco.

Essas funções passarão integralmente para o Decision Intelligence Core.

---

# 12. Benefícios Arquiteturais

A nova arquitetura permitirá:

- testes independentes;
- simulações offline;
- backtesting;
- replay de sessões;
- comparação entre motores;
- múltiplos modelos estatísticos;
- integração futura com IA.

O núcleo decisório poderá evoluir sem qualquer impacto na interface.

---

# 13. Critérios de Aceitação

A arquitetura será considerada corretamente implementada quando:

- nenhum componente React contiver lógica decisória;
- o Decision Engine for totalmente independente;
- todas as dependências ocorrerem por contratos;
- novas estratégias puderem ser adicionadas sem alterar o núcleo;
- todos os módulos puderem ser testados isoladamente.

---

# Próximo Documento

Documento 03 — Decision Context e Contratos do Núcleo Decisório.
