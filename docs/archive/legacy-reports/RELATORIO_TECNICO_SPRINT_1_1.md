# RL.SYS Sprint 1.1 — Quant Research Foundation

## Objetivo
Criar a fundação científica para ingestão, normalização e validação de datasets históricos de roleta antes de qualquer inferência de edge.

## Entregas
- `DatasetEngine`: parser para JSON, CSV e texto simples.
- `DataIntegrityValidator`: validação institucional de integridade, cobertura, repetição e cronologia.
- `ResearchDatasetService`: orquestra parse, normalização, checksum, score e recomendações.
- Endpoint `/api/research/dataset/evaluate`.
- Testes automatizados cobrindo parse, checksum, rejeição e recomendações.

## Critérios de governança
- Dataset pequeno é bloqueado como pesquisa insuficiente.
- Spins fora do domínio 0-36 são rejeitados.
- Checksums SHA-256 dão rastreabilidade aos registros normalizados.
- Timestamps são normalizados em ISO-8601 quando disponíveis.
- O sistema recomenda coleta massiva antes de qualquer alegação de edge.

## Status
Build e testes validados em ambiente Node/TypeScript.
