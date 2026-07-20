# DEV000 — Decision Intelligence Core
## Documento 04 — Feature Pipeline e Analisadores Estatísticos

**Status:** Aprovado

**Versão:** 1.0

**Autor da Arquitetura:** ChatGPT (System Architect)

---

# 1. Objetivo

O Feature Pipeline é responsável por transformar dados brutos da sessão em informações estatísticas que poderão ser utilizadas pelo Decision Engine.

Nenhum módulo do núcleo decisório deverá analisar diretamente o histórico de giros.

Toda decisão deverá ser baseada exclusivamente nas features produzidas pelo pipeline.

---

# 2. Conceito

O pipeline funciona como uma linha de produção.

```
Timeline

↓

Feature 01

↓

Feature 02

↓

Feature 03

↓

...

↓

Decision Context enriquecido

↓

Decision Engine
```

Cada etapa adiciona conhecimento.

Nenhuma etapa toma decisões.

---

# 3. Responsabilidade

Os analisadores não escolhem estratégias.

Eles apenas respondem perguntas estatísticas.

Exemplos:

- qual a entropia?
- existe tendência?
- existe concentração?
- existe repetição?
- existe estabilidade?
- existe transição dominante?

A interpretação dessas respostas será responsabilidade do Strategy Score Engine.

---

# 4. Ordem de Execução

O pipeline deverá executar sempre na mesma sequência.

```
1. Entropy Analyzer

↓

2. Frequency Analyzer

↓

3. Markov Analyzer

↓

4. Sector Analyzer

↓

5. Future Analyzers

↓

Decision Context atualizado
```

A ordem fixa garante determinismo.

---

# 5. Entropy Analyzer

Responsabilidade exclusiva:

Calcular o grau de organização da mesa.

Entradas:

- Timeline.

Saídas:

- Entropy Score.
- Entropy Class.
- Stability Index.

Nunca deverá sugerir estratégias.

---

# 6. Frequency Analyzer

Responsabilidade:

Analisar distribuição dos números.

Entradas:

- Timeline.

Saídas:

- números quentes;
- números frios;
- frequência relativa;
- concentração;
- distribuição.

Não deverá interpretar resultados.

---

# 7. Markov Analyzer

Responsabilidade:

Avaliar probabilidades de transição.

Entradas:

- matriz de Markov;
- último número.

Saídas:

- probabilidades;
- confiança;
- transição dominante;
- força estatística.

O algoritmo deverá permanecer desacoplado das estratégias.

---

# 8. Sector Analyzer

Responsabilidade:

Avaliar concentração espacial da roda.

Exemplos:

- Voisins;
- Tiers;
- Orphelins;
- Fusões;
- setores personalizados.

Saídas:

- intensidade;
- predominância;
- compatibilidade por setor.

Nenhuma recomendação será produzida.

---

# 9. Futuros Analisadores

A arquitetura prevê crescimento por extensão.

Exemplos previstos:

```
Bayesian Analyzer

↓

Monte Carlo Analyzer

↓

Pattern Analyzer

↓

Neural Analyzer

↓

Cycle Analyzer

↓

Cluster Analyzer
```

Nenhuma alteração deverá ser necessária no Decision Engine para adicionar novos analisadores.

---

# 10. Contrato dos Analisadores

Todos os analisadores deverão seguir a mesma interface conceitual.

```
Input

↓

Processamento

↓

FeatureResult
```

Cada FeatureResult deverá conter:

- nome da feature;
- valor calculado;
- confiança;
- qualidade dos dados;
- observações.

Isso padroniza toda a comunicação interna.

---

# 11. Independência

Cada Feature Analyzer deverá ser completamente independente.

Exemplo correto:

```
Entropy Analyzer

↓

Entropy Result
```

Exemplo incorreto:

```
Entropy Analyzer

↓

consulta Frequency Analyzer

↓

consulta Markov Analyzer
```

Analisadores não podem depender entre si.

Toda composição ocorrerá posteriormente.

---

# 12. Cache

Caso uma feature já tenha sido calculada durante o ciclo atual, nenhum módulo poderá recalculá-la.

O Decision Context armazenará os resultados produzidos pelo pipeline.

Isso evita processamento duplicado.

---

# 13. Tratamento de Dados Insuficientes

Cada analisador deverá informar quando não houver dados suficientes.

Exemplo:

```
Timeline muito pequena

↓

Confidence = LOW

↓

Resultado ainda produzido

↓

Sem exceções
```

O pipeline nunca deverá interromper a execução por falta de histórico.

---

# 14. Determinismo

As mesmas entradas deverão produzir exatamente as mesmas features.

Não serão permitidos:

- números aleatórios;
- estados internos ocultos;
- dependências externas.

Isso garante replay completo das sessões.

---

# 15. Auditoria

Cada FeatureResult deverá ser armazenado para inspeção.

Exemplo conceitual:

```
FeatureResult

├── Analyzer
├── Timestamp
├── Value
├── Confidence
├── Quality
└── Metadata
```

Essas informações permitirão explicar posteriormente como uma decisão foi construída.

---

# 16. Critérios de Aceitação

O Feature Pipeline será considerado implementado quando:

- todos os analisadores forem independentes;
- nenhuma decisão ocorrer nesta camada;
- todas as features forem padronizadas;
- o Decision Context receber apenas resultados consolidados;
- novos analisadores puderem ser adicionados sem alterar os existentes.

---

# Próximo Documento

Documento 05 — Strategy Score Engine e Sistema de Pontuação.
