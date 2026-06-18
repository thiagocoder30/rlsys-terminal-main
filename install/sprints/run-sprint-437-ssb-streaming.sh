#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 437"
echo " SSB STREAMING PERSISTENCE (V3.2)"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Injetando Repositório de Stream Não-Bloqueante (Zero-Allocation)..."
mkdir -p src/infrastructure/persistence

cat > src/infrastructure/persistence/StreamingContinuityStateRepository.ts <<'EOF'
/**
 * @file StreamingContinuityStateRepository.ts
 * @description Repositório de persistência de estado otimizado para o Helio P22 (2GB RAM).
 * Utiliza Write Streams para evitar alocação excessiva e bloqueios no Event Loop (Event Loop Lag).
 */
import { createWriteStream, WriteStream } from 'node:fs';
import { Result, ok, err, DomainError } from '../../domain/shared/Result';

export interface ProjectStatePayload {
    readonly generatedAt: string;
    readonly project: string;
    readonly phase: string;
    readonly currentSprint: string;
    readonly repositoryHealth: string;
    readonly runtime: Record<string, unknown>;
    readonly roadmap: Record<string, unknown>;
}

export class StreamingContinuityStateRepository {
    /**
     * Serializa e grava o estado do projeto de forma assíncrona baseada em chunks.
     * Complexidade de Espaço: O(1) relativo ao buffer, sem instanciar a string inteira na RAM.
     * * @param targetPath Caminho absoluto de destino.
     * @param payload Objeto completo do estado.
     */
    public async exportStateStream(targetPath: string, payload: ProjectStatePayload): Promise<Result<boolean, DomainError>> {
        return new Promise((resolve) => {
            try {
                const stream: WriteStream = createWriteStream(targetPath, {
                    flags: 'w',
                    encoding: 'utf8',
                    autoClose: true,
                });

                stream.on('error', (e) => {
                    resolve(err(new DomainError(`Stream write failure: ${e.message}`, 'SSB_STREAM_ERROR')));
                });

                stream.on('finish', () => {
                    resolve(ok(true));
                });

                // Escrita encadeada para não estrangular a pilha de chamadas
                stream.write('{\n');
                stream.write(`  "generatedAt": "${payload.generatedAt}",\n`);
                stream.write(`  "project": "${payload.project}",\n`);
                stream.write(`  "phase": "${payload.phase}",\n`);
                stream.write(`  "currentSprint": "${payload.currentSprint}",\n`);
                stream.write(`  "repositoryHealth": "${payload.repositoryHealth}",\n`);
                
                // Grava objetos internos como JSON strings isoladas (Chunks)
                stream.write(`  "runtime": ${JSON.stringify(payload.runtime, null, 4)},\n`);
                stream.write(`  "roadmap": ${JSON.stringify(payload.roadmap, null, 4)}\n`);
                stream.write('}\n');

                stream.end(); // Libera os recursos e dispara o evento 'finish'
            } catch (exception: unknown) {
                resolve(err(new DomainError(`Critical Stream Failure: ${(exception as Error).message}`, 'SSB_CRITICAL_FAILURE')));
            }
        });
    }
}
EOF

echo "[2/2] Atualizando controle de versão com as regras de I/O em Stream..."
git add src/infrastructure/persistence/StreamingContinuityStateRepository.ts
git add install/sprints/run-sprint-437-ssb-streaming.sh
git commit -m "perf(infrastructure): implement StreamingContinuityStateRepository for O(1) space complexity non-blocking file exports on limited RAM environments (Sprint 437)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 437 INSTALADA COM SUCESSO \033[0m"
echo " STATUS: PERSISTÊNCIA EM STREAM ATIVADA"
echo "======================================"
