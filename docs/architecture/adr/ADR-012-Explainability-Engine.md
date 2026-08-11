ADR-012 — EXPLAINABILITY ENGINE (XAI)

STATUS:
IMPLEMENTED

DATA:
2026-07-26


IMPLEMENTATION SPRINT:
012 — Explainability Engine (XAI)


VALIDATION SPRINT:
012.1 — XAI Architecture Hardening & Governance Review



1. CONTEXTO ARQUITETURAL

O RL.SYS CORE v5.x possui uma camada institucional de inteligência quantitativa responsável pela análise estatística, avaliação de risco operacional, classificação de estratégias e consolidação de resultados decisórios.

Antes da implementação da Explainability Engine (XAI), o sistema era capaz de produzir análises quantitativas através dos seguintes componentes:

- Markov Probability Engine
- Shannon Entropy Engine
- Operational VIX Engine
- Z-Score Engine
- Strategy Ranking Engine
- Decision Intelligence Engine


Embora os motores quantitativos fossem capazes de produzir resultados analíticos, não existia uma camada formal responsável por transformar esses resultados em artefatos de transparência, interpretação e auditoria humana.

Esta ADR define a posição arquitetural da Explainability Engine, suas responsabilidades, limitações e garantias de segurança.



2. DECISÃO ARQUITETURAL

A Explainability Engine (XAI) foi implementada como um bounded context downstream dedicado exclusivamente à transparência dos resultados quantitativos.

A responsabilidade da XAI é:

- Consumir resultados quantitativos finalizados.
- Organizar evidências existentes.
- Produzir explicações estruturadas.
- Gerar artefatos de transparência.
- Apoiar processos de auditoria humana.


A Explainability Engine NÃO possui responsabilidade sobre:

- Cálculo estatístico.
- Reexecução de motores quantitativos.
- Geração de estratégias.
- Alteração de scores.
- Alteração de rankings.
- Modificação de decisões.
- Execução operacional.



3. POSIÇÃO DA XAI NA ARQUITETURA

O fluxo arquitetural oficial é:


Quantitative Engines

↓

DecisionIntelligenceEngine

↓

DecisionSummary

↓

ExplainabilityEngine

↓

DecisionExplanation



A Explainability Engine atua somente após a conclusão da análise quantitativa.

Não existe dependência reversa entre XAI e os motores quantitativos.



4. CLASSIFICAÇÃO DO BOUNDED CONTEXT

A Explainability Engine é classificada como:

Downstream Analytical Bounded Context


Responsabilidades:

- Transparência.
- Explicação.
- Organização de evidências.
- Interpretação de resultados.
- Suporte à auditoria.


Não responsabilidades:

- Inferência matemática.
- Predição.
- Cálculo probabilístico.
- Alteração de estado decisório.
- Controle operacional.



5. CONTRATOS QUE A XAI PODE CONSUMIR

A Explainability Engine possui permissão para consumir:


DecisionSummary


O DecisionSummary representa a fonte final dos resultados quantitativos consolidados.


A XAI também pode consumir contratos públicos congelados quando necessário para leitura:


IExplainabilityEngine

IDecisionIntelligenceEngine

IQuantitativeEngine

IProbabilityEngine

IEntropyEngine

IVixEngine

IZScoreEngine

IStrategyRankingEngine

IDecisionAuditLedger



6. PUBLIC API FROZEN

Os seguintes contratos permanecem congelados:


IQuantitativeEngine

IProbabilityEngine

IEntropyEngine

IVixEngine

IZScoreEngine

IStrategyRankingEngine

IDecisionIntelligenceEngine

IDecisionAuditLedger

QuantitativeInput

QuantitativeOutput

DecisionSummary

DecisionAnalysis

DecisionContext



A partir desta ADR:

- Nenhuma assinatura existente deve ser modificada.
- Nenhum campo obrigatório deve ser removido.
- Nenhum contrato deve ser alterado para atender necessidades da XAI.
- Novas evoluções devem ocorrer por extensão aditiva.



7. GARANTIAS ARQUITETURAIS OBRIGATÓRIAS


XAI does not recalculate quantitative engines.


A Explainability Engine nunca deve:

- Executar novamente Markov Probability Engine.
- Executar novamente Shannon Entropy Engine.
- Executar novamente Operational VIX Engine.
- Executar novamente Z-Score Engine.
- Executar novamente Strategy Ranking Engine.


Todos os artefatos explicativos devem ser derivados exclusivamente de resultados já processados.



DecisionSummary remains immutable.


O DecisionSummary deve permanecer:

- Somente leitura.
- Imutável.
- Fonte final dos resultados quantitativos.


A XAI não pode:

- Alterar valores.
- Corrigir métricas.
- Recalcular scores.
- Substituir resultados.



Explainability is a downstream bounded context.


A comunicação permitida é:


DecisionSummary

↓

ExplainabilityEngine


A comunicação proibida é:


ExplainabilityEngine

↓

DecisionIntelligenceEngine



8. OBJETOS PRODUZIDOS PELA XAI


A Explainability Engine produz exclusivamente artefatos de transparência:


DecisionExplanation

DecisionExplanationSection

DecisionReason

DecisionEvidenceBundle

DecisionTransparencyReport

DecisionConfidenceBreakdown



Esses objetos:

- Não possuem autoridade decisória.
- Não substituem DecisionSummary.
- Não alteram resultados quantitativos.
- Não influenciam motores anteriores.



9. COMPONENTES IMPLEMENTADOS


Domain:


src/domain/intelligence/explainability/


DecisionExplanation.ts

DecisionExplanationSection.ts

DecisionReason.ts

DecisionEvidenceBundle.ts

DecisionTransparencyReport.ts

DecisionConfidenceBreakdown.ts

ExplainabilityEngine.ts



Contracts:


src/domain/contracts/


IExplainabilityEngine.ts



Application:


src/application/intelligence/


ExplainabilityCoordinator.ts



10. REGRAS DE DEPENDÊNCIA


Permitido:


ExplainabilityCoordinator

↓

IExplainabilityEngine



Permitido:


ExplainabilityEngine

↓

DecisionSummary



Proibido:


ExplainabilityEngine

↓

MarkovProbabilityEngine


Proibido:


ExplainabilityEngine

↓

ShannonEntropyEngine


Proibido:


ExplainabilityEngine

↓

OperationalVixEngine


Proibido:


ExplainabilityEngine

↓

StrategyRankingEngine



11. CONFORMIDADE SOLID


Single Responsibility Principle:

A XAI possui responsabilidade única de transformar resultados quantitativos em explicações.


Dependency Inversion Principle:

A aplicação depende exclusivamente do contrato IExplainabilityEngine.


Interface Segregation Principle:

O contrato XAI contém apenas responsabilidades relacionadas à explicabilidade.



12. COMPLEXIDADE COMPUTACIONAL


ExplainabilityEngine:


Complexidade:

O(n)


Onde n representa a quantidade de evidências ou subanálises processadas.


Não existem cálculos estatísticos durante esta etapa.



ExplainabilityCoordinator:


Complexidade:

O(1)


O Coordinator executa apenas orquestração e delegação.



13. IMPLEMENTAÇÃO SPRINT 012


Componentes implementados:


Sprint 012 — Explainability Engine


Resultado:

CONCLUÍDO



14. VALIDAÇÃO SPRINT 012.1


Sprint:

012.1 — XAI Architecture Hardening & Governance Review


Validações realizadas:

- Auditoria de dependências.
- Auditoria de imutabilidade.
- Auditoria de contratos.
- Auditoria DDD.
- Auditoria SOLID.
- Verificação de dependências circulares.
- Verificação de ausência de reprocessamento quantitativo.



Resultado dos testes:


94 testes aprovados

26 arquivos de teste aprovados



15. REVISÃO ARQUITETURAL FINAL


Clean Architecture:

APPROVED


DDD:

APPROVED


SOLID:

APPROVED


Dependency Inversion:

APPROVED


Circular Dependencies:

APPROVED


Resultado Madge:

0 dependências circulares detectadas



Technical Debt:

NONE DETECTED



16. ATUALIZAÇÕES DOCUMENTAIS FUTURAS


Os seguintes documentos devem refletir esta decisão:


Domain_Model:

Adicionar Explainability Bounded Context como camada downstream.


Data_Dictionary:

Adicionar:


DecisionExplanation

DecisionReason

DecisionEvidenceBundle

DecisionTransparencyReport

DecisionConfidenceBreakdown



Audit Trail Schema:

Registrar futura integração entre:

DecisionAuditLedger

e

DecisionExplanation



17. CLASSIFICAÇÃO DOS VALUE OBJECTS REMOVIDOS


Os seguintes objetos foram auditados:


ConfidenceScore

EntropyScore

ProbabilityScore

RiskScore



Classificação:


SAFE TO REMOVE



Motivo:

- Ausência de uso ativo.
- Redundância estrutural.
- Substituição por tipos primitivos validados.
- Redução de complexidade arquitetural.



Nenhuma regressão foi identificada.



18. STATUS FINAL DA ADR


ADR-012:

IMPLEMENTED


Implementation:

Sprint 012 — COMPLETE


Validation:

Sprint 012.1 — APPROVED



Garantias finais:


XAI does not recalculate quantitative engines.


DecisionSummary remains immutable.


Explainability is a downstream bounded context.



Architecture Review:

APPROVED
