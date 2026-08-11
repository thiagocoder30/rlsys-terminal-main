# RELATORIO TECNICO - SPRINT 032

## Runtime Drawdown Lock

### Objetivo

Implementar uma camada de bloqueio preventivo baseada em velocidade de drawdown.

A Sprint transforma perdas rápidas em evento de governança, permitindo que o runtime entre em REVIEW ou LOCKED antes de atingir o stop loss absoluto.

### Entregas

- `RuntimeDrawdownLock`
- Avaliacao O(1) de drawdown absoluto
- Avaliacao O(1) de velocidade de perda por minuto
- Estados `DRAWDOWN_OK`, `DRAWDOWN_REVIEW`, `DRAWDOWN_LOCKED` e `BLOCKED`
- Testes unitarios dedicados

### Governanca

A Sprint nao autoriza apostas e nao gera sinal live. Ela apenas atua como camada defensiva para impedir continuidade operacional quando a curva de capital degrada rapido demais.

### Complexidade

- Tempo: O(1)
- Espaco: O(1)
