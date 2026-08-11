# RELATORIO TECNICO - SPRINT 020

## Objetivo
Implantar o EV & Risk Analytics Engine para transformar resultados resolvidos de replay/offline research em métricas quantitativas objetivas de valor esperado, risco e robustez.

## Entregas
- `EVRiskAnalyticsEngine`
- Métrica de EV por sinal
- Métrica de EV por unidade apostada
- Profit factor
- Win rate e loss rate
- Drawdown máximo e drawdown rate
- Recovery factor
- Estimativa determinística de risco de ruína
- Frequência de sinal por frame pesquisado
- Breakdown por estratégia
- Breakdown por regime
- Checksum determinístico de relatório
- Testes unitários de EV positivo, EV negativo, amostra insuficiente, determinismo e payload inválido

## Decisão Arquitetural
A Sprint cria uma camada de domínio pura em `src/domain/analytics`. O motor não lê arquivos, não depende de UI, não executa apostas e não acessa infraestrutura. Ele recebe outcomes resolvidos por replay/offline runner e retorna um relatório auditável.

## Governança
A Sprint não autoriza stake real. Mesmo quando classifica um lote como `POSITIVE_EDGE_CANDIDATE`, o resultado é apenas candidato de pesquisa. A função do módulo é falsificar hipóteses de alpha antes que qualquer fluxo operacional seja considerado.

## Complexidade
- Tempo: `O(n + g log g)`, onde `n` é o número de outcomes e `g` é o número de grupos por estratégia/regime.
- Espaço: `O(g)`, limitado aos grupos agregados.

## Relevância para o RL.SYS
Esta Sprint inicia a medição objetiva de alpha. A partir dela, o RL.SYS passa a responder se os sinais simulados possuem EV positivo, risco aceitável e frequência operacional sustentável, ou se apenas reduzem a velocidade de perda esperada.
