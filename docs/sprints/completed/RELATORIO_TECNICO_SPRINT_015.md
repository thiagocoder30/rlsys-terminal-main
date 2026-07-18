# RELATORIO TECNICO - SPRINT 015

## Objetivo
Criar um contrato de HUD operacional para transformar relatórios internos do RL.SYS Core em uma projeção compacta, determinística e segura para a futura interface do operador.

## Entregas
- `OperatorHudProjectionEngine`
- `OperatorHudProjectionInput`
- `OperatorHudProjection`
- Cards operacionais limitados por política de memória
- Risk band agregado (`LOW`, `MEDIUM`, `HIGH`)
- Linha compacta de status para terminal/mobile
- Checksum de auditoria da projeção
- Testes unitários de projeção, bloqueio, limite de cards e validação de entrada

## Decisão Arquitetural
A Sprint cria uma camada de domínio de apresentação, mas não uma UI. O motor define o contrato que a UI poderá renderizar futuramente sem acoplar o core a React, HTTP, terminal, banco ou filesystem.

O `OperatorHudProjectionEngine` consome relatórios já produzidos por módulos anteriores, como explicabilidade, estatística incremental, event bus e persistência. Ele não decide, não altera sessão, não libera stake e não interpreta imagens.

## Complexidade
- Tempo: `O(e + c)`, onde `e` é a quantidade limitada de evidências e `c` é o número máximo de cards.
- Espaço: `O(c)`, limitado por `maxCards`.

## Governança
A Sprint mantém a execução em modo `RESEARCH_ONLY`. O HUD pode exibir sinal de pesquisa, bloqueio ou observação, mas nunca autoriza aposta real.

## Resultado
O RL.SYS Core passa a ter um contrato estável para a futura Operator UI, reduzindo acoplamento e evitando que detalhes visuais contaminem o domínio.
