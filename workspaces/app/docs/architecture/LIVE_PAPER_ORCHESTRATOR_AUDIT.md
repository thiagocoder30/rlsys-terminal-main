# Auditoria: LivePaperOrchestrator

**Arquivo Analisado:** `src/presentation/cli/LivePaperOrchestrator.ts`

*(Nota da Auditoria: No workspace atual, a implementação física deste arquivo encontra-se desidratada/pendente de recuperação, no entanto as definições conceituais estão descritas abaixo com base no Baseline V3)*

## Responsabilidades (Responsibilities)
- Orquestrar a transição e a garantia do ciclo de vida entre o ambiente de simulação (Paper Trading) e a camada de visualização.
- Impedir que sinais de execução de operações sejam direcionados para execuções reais, interceptando eventos na camada de apresentação (CLI/HUD).
- Apresentar relatórios estatísticos provenientes do `StrategyPerformanceEvaluator`.

## Importações / Dependências Mapeadas (Imports & Dependencies)
- **Internas**: Depende de contratos definidos em `src/domain/contracts/IGovernancePolicy.ts`.
- **Internas**: Depende de `src/application/usecases` (ex: geração de análises quantitativas).
- **Externas**: Nenhuma dependência externa deve interagir diretamente com este orquestrador (isolamento de apresentação).

## Acoplamentos (Coupling)
- Fortemente acoplado aos eventos visuais do Terminal Quantitativo Institucional.
- Não deve conhecer detalhes do `DecisionAuditLedger` de forma direta (deve passar pela camada Application).

## Riscos (Risks)
- **Risco Crítico**: Caso o orquestrador sofra injeção de dependência inadequada, o operador poderia tentar habilitar ordens via CLI que o domínio rejeitaria. O `SystemGovernancePolicy` existe no Domínio exatamente como última barreira (Safety Gate).
- O arquivo deve garantir puramente apresentação e encaminhamento de intent (intenção de aprovação do operador). Não deve realizar cálculos de risco ou Drawdown, delegando para os módulos responsáveis.
