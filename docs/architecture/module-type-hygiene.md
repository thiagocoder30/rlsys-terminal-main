# RL.SYS CORE — Module Type Hygiene

## Decisão arquitetural

O RL.SYS CORE usa runtime operacional baseado em CommonJS.

Após a release v1.0-paper-runtime, esta sprint torna a semântica de módulo explícita.

O package raiz agora declara:

type: commonjs

## Motivo

Preservar compatibilidade com:

- scripts de instalação
- runtime do paper system
- testes node:test
- preloads do ledger
- preloads do discipline guard
- Termux/Proot

## Regras

- Não migrar para ESM nesta sprint.
- Nenhum gate operacional deve mudar.
- Nenhum runtime deve mudar.
- O domínio continua isolado.

## Critério de aceite

- npm run build verde
- npm test verde
- audit:module-type verde
- sem arquivos híbridos
