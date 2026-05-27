# RL.SYS CORE — Repository Hygiene & Artifact Boundary

## Objetivo

Manter o repositório profissional, leve e auditável.

## Código-fonte versionado

Devem permanecer versionados:

- `src/`
- `scripts/`
- `tests/`
- `install/`
- `docs/`
- `prisma/`
- `satellite/`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `.env.example`
- `.gitignore`
- `README.md`

## Artefatos gerados

Não devem ser versionados:

- `node_modules/`
- `dist/`
- logs de execução
- relatórios runtime em `data/paper-runtime/*.json`
- relatórios runtime em `reports/`
- arquivos temporários
- backups antigos
- buffers de terminal

## Diretórios preservados com `.gitkeep`

- `logs/`
- `reports/`
- `data/paper-runtime/`
- `storage/`

## Política institucional

Toda Sprint deve:

1. gerar logs em `logs/`
2. copiar log para `/sdcard/Download` quando disponível
3. rodar `npm ci`
4. rodar `npm run build`
5. rodar `npm test`
6. commitar somente se os testes passarem
