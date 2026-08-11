# Sprint 035 — Snapshot Revocation Engine

## Objetivo

Detectar quando o snapshot probabilístico deixou de representar a realidade operacional da mesa.

## Estados

- SNAPSHOT_VALID
- SNAPSHOT_REVIEW
- SNAPSHOT_REVOKED
- BLOCKED

## Critérios de Revogação

- snapshot expirado
- runtime sanity degradado
- entropia excessiva
- falha de integridade
- excesso de REVIEW escalado

## Complexidade

Tempo: O(1)
Espaço: O(1)
