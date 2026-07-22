# DEV000 — Decision Intelligence Core
## Documento 05 — Strategy Score Engine

**Status:** Aprovado

**Versão:** 1.0

**Autor da Arquitetura:** ChatGPT (System Architect)

---

# 1. Objetivo

O Strategy Score Engine é o coração analítico do Decision Intelligence Core.

Sua responsabilidade é transformar as features estatísticas produzidas pelo Feature Pipeline em uma pontuação objetiva para cada estratégia registrada no sistema.

O Score Engine não executa apostas.

O Score Engine não controla risco.

O Score Engine apenas mede a qualidade de cada estratégia naquele exato instante.

---

# 2. Posição na Arquitetura

```
Feature Pipeline

↓

Strategy Score Engine

↓

Risk Layer

↓

Decision Engine
```

Todo Strategy Score será calculado antes da validação de risco.

---

# 3. Filosofia

A arquitetura anterior escolhia uma estratégia utilizando poucas regras espalhadas pelo código.

A nova arquitetura avalia TODAS as estratégias simultaneamente.

Cada estratégia recebe uma nota.

Depois todas são classificadas.

Somente então inicia-se a análise de risco.

---

# 4. Processo de Avaliação

Para cada estratégia registrada:

```
Estratégia

↓

Aplicação das Features

↓

Cálculo dos Indicadores

↓

Score Final

↓

Ranking
```

Ao final existirá um ranking completo das estratégias.

Não apenas uma vencedora.

---

# 5. Fontes de Pontuação

O Score Engine utilizará múltiplas fontes de informação.

Exemplos:

• Compatibilidade com Entropia

• Compatibilidade Markov

• Frequência

• Concentração Setorial

• Performance Histórica

• Shadow Learning

• Consistência Estatística

• Confiança Histórica

• Penalizações

• Bonificações

A arquitetura permite adicionar novas fontes futuramente.

---

# 6. Estrutura Conceitual do Score

```
Score Final

=

Σ (Features Positivas)

-

Σ (Penalizações)

+

Bônus

-

Riscos Estatísticos
```

O algoritmo exato permanecerá encapsulado.

A arquitetura define apenas sua responsabilidade.

---

# 7. Avaliação Individual

Cada estratégia deverá ser avaliada isoladamente.

Exemplo:

```
VOISINS

↓

Score

↓

0.82
```

```
TIERS

↓

Score

↓

0.71
```

```
ORPHELINS

↓

Score

↓

0.43
```

Nenhuma estratégia interfere diretamente na nota da outra.

---

# 8. Ranking

Após calcular todas as notas, o Score Engine produzirá um ranking.

Exemplo:

```
1. VOISINS

Score 0.87

-----------------

2. TIERS

Score 0.81

-----------------

3. ORPHELINS

Score 0.59
```

Esse ranking será encaminhado para a Risk Layer.

---

# 9. Explicabilidade

Cada Score deverá possuir justificativa.

Exemplo conceitual:

```
VOISINS

Score:

0.87

Motivos:

+ Alta compatibilidade Markov

+ Boa distribuição setorial

+ Performance recente

- Frequência moderada
```

Nenhuma nota poderá existir sem explicação.

---

# 10. Pesos

Cada Feature poderá possuir um peso diferente.

Exemplo conceitual:

```
Markov

30%

Entropia

20%

Setores

15%

Shadow Learning

25%

Histórico

10%
```

Os pesos serão parametrizáveis.

A alteração de pesos não deverá exigir mudanças estruturais.

---

# 11. Penalizações

O Score poderá ser reduzido quando houver evidências desfavoráveis.

Exemplos:

- baixa confiança;
- pouca amostragem;
- instabilidade;
- excesso de drawdown histórico;
- baixa consistência.

Penalizações não eliminam automaticamente a estratégia.

Apenas reduzem sua classificação.

---

# 12. Bonificações

O Score poderá aumentar quando existirem evidências fortes.

Exemplos:

- alta confiança Markov;
- forte estabilidade;
- Shadow Learning positivo;
- excelente desempenho recente;
- convergência de múltiplas features.

Bonificações nunca poderão ultrapassar os limites definidos pela arquitetura.

---

# 13. Shadow Learning

O Shadow Learning deixa de escolher estratégias.

Seu novo papel será fornecer uma evidência adicional para o Score Engine.

Exemplo:

```
Shadow Learning

↓

Weight

↓

Score Engine
```

Isso elimina acoplamentos existentes no motor atual.

---

# 14. Resultado Produzido

Ao final da avaliação, o Strategy Score Engine deverá produzir uma coleção padronizada.

Exemplo conceitual:

```
StrategyScore

├── Strategy
├── Score
├── Confidence
├── Evidence
├── Penalties
├── Bonuses
└── Explanation
```

Essa estrutura será utilizada posteriormente pelo Decision Engine para justificar qualquer decisão.

---

# 15. Regras Arquiteturais

O Strategy Score Engine:

✔ Calcula notas.

✔ Classifica estratégias.

✔ Produz justificativas.

✔ Gera ranking.

O Strategy Score Engine NÃO:

✘ Aprova apostas.

✘ Rejeita apostas.

✘ Calcula stake.

✘ Controla banca.

✘ Executa regras de risco.

Essas responsabilidades pertencem à Risk Layer.

---

# 16. Critérios de Aceitação

O Score Engine será considerado implementado quando:

- todas as estratégias forem avaliadas simultaneamente;
- existir um ranking completo;
- cada nota possuir justificativa;
- os pesos forem parametrizáveis;
- Shadow Learning atuar apenas como evidência;
- nenhuma decisão operacional ocorrer nesta camada.

---

# Próximo Documento

Documento 06 — Risk Layer e Validação Operacional.
