# DEV000 — Decision Intelligence Core
## Documento 03 — Decision Context e Contratos do Núcleo Decisório

**Status:** Aprovado

**Versão:** 1.0

**Autor da Arquitetura:** ChatGPT (System Architect)

---

# 1. Objetivo

O Decision Context é o contrato de entrada do Decision Intelligence Core.

Toda decisão deverá ser produzida exclusivamente a partir das informações contidas neste objeto.

O núcleo decisório não poderá acessar diretamente:

- React;
- Hooks;
- LocalStorage;
- Componentes visuais;
- Estados globais;
- APIs externas.

Toda dependência deverá ser entregue através do Decision Context.

---

# 2. Papel do Decision Context

O Decision Context representa uma fotografia completa do estado operacional da mesa em um determinado instante.

Ele é imutável.

Depois de criado, nenhum módulo poderá alterá-lo.

Todos os analisadores receberão exatamente a mesma instância.

---

# 3. Responsabilidades

O Decision Context deverá concentrar todas as informações necessárias para a tomada de decisão.

Exemplos:

- histórico recente de giros;
- bankroll atual;
- banca inicial;
- banca máxima da sessão;
- valor do VIX;
- estado do Burn-In;
- estado do Cooldown;
- matriz de Markov;
- pesos das estratégias;
- desempenho acumulado;
- indicadores estatísticos.

Qualquer dado utilizado pelo Decision Engine deverá estar presente neste contrato.

---

# 4. Estrutura Conceitual

```
DecisionContext

├── Session
├── Timeline
├── Market
├── Statistics
├── StrategyState
├── RiskState
└── Metadata
```

Cada grupo possui responsabilidade específica.

---

# 5. Session

Representa o estado financeiro e operacional da sessão.

Informações previstas:

- bankroll inicial;
- bankroll atual;
- maior banca da sessão;
- lucro acumulado;
- quantidade de vitórias;
- quantidade de derrotas;
- objetivo financeiro;
- limite de perda.

Essa camada não realiza cálculos.

Ela apenas fornece contexto.

---

# 6. Timeline

Representa o histórico utilizado pelos analisadores.

Deverá conter:

- sequência cronológica;
- último giro;
- quantidade de observações;
- janela ativa.

Nenhum analisador poderá acessar o histórico diretamente fora deste contrato.

---

# 7. Market

Representa o estado atual da mesa.

Exemplos:

- valor do VIX;
- classificação da entropia;
- estado operacional;
- indicadores de estabilidade.

Esses dados poderão ser produzidos por módulos anteriores do pipeline.

---

# 8. Statistics

Representa todos os indicadores estatísticos calculados até o momento.

Exemplos:

- matriz de Markov;
- distribuição de frequência;
- repetições;
- atraso dos números;
- concentração;
- volatilidade.

Os analisadores deverão consumir essas informações sem recalcular dados já disponíveis.

---

# 9. Strategy State

Representa a situação atual de cada estratégia.

Cada estratégia deverá possuir seu próprio registro.

Exemplo conceitual:

```
StrategyState

├── Strategy A
│   ├── Weight
│   ├── PnL
│   ├── Confidence
│   └── Enabled
│
├── Strategy B
│
└── Strategy C
```

O Decision Engine nunca deverá acessar estruturas paralelas para obter essas informações.

---

# 10. Risk State

Representa todos os controles relacionados ao gerenciamento de risco.

Exemplos:

- Burn-In ativo;
- Cooldown ativo;
- Stop Loss atingido;
- Take Profit atingido;
- velocidade de Drawdown;
- exposição atual.

Essa camada informa o estado do risco, mas não decide.

A decisão permanece responsabilidade da Risk Layer.

---

# 11. Metadata

Armazena informações auxiliares para auditoria.

Exemplos:

- timestamp;
- versão do motor;
- versão da arquitetura;
- identificador da sessão;
- modo operacional.

Esses dados facilitam replay, rastreabilidade e depuração.

---

# 12. Regras de Imutabilidade

Após sua construção:

- nenhum campo poderá ser alterado;
- nenhuma lista poderá ser modificada;
- nenhuma referência poderá ser compartilhada para escrita.

Caso algum módulo necessite alterar informações, deverá produzir um novo objeto.

---

# 13. Construção do Contexto

A criação do Decision Context será responsabilidade exclusiva do `useTacticalEngine`.

Fluxo previsto:

```
Timeline

+

Bankroll

+

Pesos

+

Markov

+

VIX

+

Estados da Sessão

↓

DecisionContext

↓

Decision Engine
```

Após esse ponto, o hook apenas aguardará o resultado da decisão.

---

# 14. Benefícios

A utilização de um contrato único proporciona:

- desacoplamento completo;
- previsibilidade;
- facilidade de testes;
- replay determinístico;
- auditoria;
- evolução do núcleo sem alterar a interface.

Além disso, qualquer novo analisador poderá utilizar o mesmo contexto sem necessidade de alterações estruturais.

---

# 15. Critérios de Aceitação

O Decision Context será considerado corretamente implementado quando:

- representar completamente o estado da sessão;
- for imutável;
- for a única entrada do Decision Engine;
- eliminar acessos diretos ao React;
- permitir testes totalmente determinísticos.

---

# Próximo Documento

Documento 04 — Feature Pipeline e Analisadores Estatísticos.
