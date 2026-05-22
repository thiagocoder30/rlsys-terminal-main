#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="069-guided-operation-mode"
BRANCH="sprint-069-guided-operation-mode"
PROJECT_DIR="${PROJECT_DIR:-$HOME/rlsys-terminal-main}"
LOG_DIR="/sdcard/Download"
LOG_FILE="$LOG_DIR/rlsys-terminal-$SPRINT.log"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1
trap 'echo "[ERROR] Sprint failed at line $LINENO"; exit 1' ERR

cd "$PROJECT_DIR"

git checkout main
git pull origin main
git reset --hard origin/main
git clean -fd tests 2>/dev/null || true
rm -f install/sprints/run-sprint-test.sh
git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true

git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p src/application/session tests install/sprints

cat > src/application/session/GuidedOperationMode.ts <<'TS'
export type GuidedOperationState =
  | 'SETUP_REQUIRED'
  | 'READY_TO_START'
  | 'SESSION_ACTIVE'
  | 'SESSION_PAUSED'
  | 'SESSION_FINISHED';

export type GuidedOperationCommand =
  | 'PROFILE_LOADED'
  | 'START_SESSION'
  | 'REGISTER_WIN'
  | 'REGISTER_LOSS'
  | 'PAUSE_SESSION'
  | 'RESUME_SESSION'
  | 'GENERATE_REPORT'
  | 'FINISH_SESSION'
  | 'RESET';

export interface GuidedOperationResult {
  readonly state: GuidedOperationState;
  readonly accepted: boolean;
  readonly message: string;
  readonly nextAction: string;
}

/**
 * Lightweight finite-state workflow for assisted operator sessions.
 *
 * This application service does not execute bets, calculate risk, or persist
 * data. It only guides the operator through a safe operational lifecycle.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class GuidedOperationMode {
  private state: GuidedOperationState;

  public constructor(profileLoaded: boolean = false) {
    this.state = profileLoaded ? 'READY_TO_START' : 'SETUP_REQUIRED';
  }

  public current(): GuidedOperationState {
    return this.state;
  }

  public handle(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'RESET') {
      this.state = 'SETUP_REQUIRED';
      return this.result(true, 'Fluxo reiniciado.', 'Configurar perfil de risco.');
    }

    if (this.state === 'SETUP_REQUIRED') {
      return this.handleSetupRequired(command);
    }

    if (this.state === 'READY_TO_START') {
      return this.handleReady(command);
    }

    if (this.state === 'SESSION_ACTIVE') {
      return this.handleActive(command);
    }

    if (this.state === 'SESSION_PAUSED') {
      return this.handlePaused(command);
    }

    return this.handleFinished(command);
  }

  private handleSetupRequired(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'PROFILE_LOADED') {
      this.state = 'READY_TO_START';
      return this.result(true, 'Perfil carregado com sucesso.', 'Iniciar sessão assistida.');
    }

    return this.result(false, 'Perfil de risco ainda não configurado.', 'Executar setup do operador.');
  }

  private handleReady(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'START_SESSION') {
      this.state = 'SESSION_ACTIVE';
      return this.result(true, 'Sessão assistida iniciada.', 'Registrar win/loss ou consultar status.');
    }

    if (command === 'PROFILE_LOADED') {
      return this.result(true, 'Perfil já está carregado.', 'Iniciar sessão assistida.');
    }

    return this.result(false, 'Sessão ainda não foi iniciada.', 'Usar START_SESSION.');
  }

  private handleActive(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'REGISTER_WIN') {
      return this.result(true, 'Vitória registrada no fluxo guiado.', 'Atualizar ledger e verificar stop win.');
    }

    if (command === 'REGISTER_LOSS') {
      return this.result(true, 'Perda registrada no fluxo guiado.', 'Atualizar ledger e verificar cooldown/stop loss.');
    }

    if (command === 'PAUSE_SESSION') {
      this.state = 'SESSION_PAUSED';
      return this.result(true, 'Sessão pausada.', 'Retomar ou gerar relatório.');
    }

    if (command === 'GENERATE_REPORT') {
      return this.result(true, 'Relatório solicitado.', 'Gerar relatório humano da sessão.');
    }

    if (command === 'FINISH_SESSION') {
      this.state = 'SESSION_FINISHED';
      return this.result(true, 'Sessão finalizada.', 'Gerar relatório final e encerrar.');
    }

    return this.result(false, 'Comando não permitido durante sessão ativa.', 'Registrar resultado, pausar, reportar ou finalizar.');
  }

  private handlePaused(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'RESUME_SESSION') {
      this.state = 'SESSION_ACTIVE';
      return this.result(true, 'Sessão retomada.', 'Continuar apenas com disciplina operacional.');
    }

    if (command === 'GENERATE_REPORT') {
      return this.result(true, 'Relatório solicitado durante pausa.', 'Gerar relatório humano da sessão.');
    }

    if (command === 'FINISH_SESSION') {
      this.state = 'SESSION_FINISHED';
      return this.result(true, 'Sessão finalizada a partir da pausa.', 'Gerar relatório final e encerrar.');
    }

    return this.result(false, 'Sessão está pausada.', 'Retomar, gerar relatório ou finalizar.');
  }

  private handleFinished(command: GuidedOperationCommand): GuidedOperationResult {
    if (command === 'GENERATE_REPORT') {
      return this.result(true, 'Relatório final solicitado.', 'Gerar relatório humano final.');
    }

    return this.result(false, 'Sessão já foi finalizada.', 'Gerar relatório final ou reiniciar fluxo.');
  }

  private result(
    accepted: boolean,
    message: string,
    nextAction: string,
  ): GuidedOperationResult {
    return {
      state: this.state,
      accepted,
      message,
      nextAction,
    };
  }
}
TS

cat > src/application/session/index.ts <<'TS'
export * from './GuidedOperationMode';
TS

cat > tests/guided-operation-mode.test.js <<'JS'
const test = require('node:test');
const assert = require('node:assert/strict');
const { GuidedOperationMode } = require('../dist/application/session');

test('GuidedOperationMode starts requiring setup when profile is missing', () => {
  const mode = new GuidedOperationMode(false);

  assert.equal(mode.current(), 'SETUP_REQUIRED');

  const rejected = mode.handle('START_SESSION');
  assert.equal(rejected.accepted, false);
  assert.match(rejected.nextAction, /setup/i);
});

test('GuidedOperationMode transitions from setup to ready when profile loads', () => {
  const mode = new GuidedOperationMode(false);

  const result = mode.handle('PROFILE_LOADED');

  assert.equal(result.accepted, true);
  assert.equal(result.state, 'READY_TO_START');
  assert.equal(mode.current(), 'READY_TO_START');
});

test('GuidedOperationMode starts active session from ready state', () => {
  const mode = new GuidedOperationMode(true);

  const result = mode.handle('START_SESSION');

  assert.equal(result.accepted, true);
  assert.equal(result.state, 'SESSION_ACTIVE');
  assert.match(result.message, /iniciada/);
});

test('GuidedOperationMode accepts win and loss during active session', () => {
  const mode = new GuidedOperationMode(true);

  mode.handle('START_SESSION');

  assert.equal(mode.handle('REGISTER_WIN').accepted, true);
  assert.equal(mode.handle('REGISTER_LOSS').accepted, true);
  assert.equal(mode.current(), 'SESSION_ACTIVE');
});

test('GuidedOperationMode pauses and resumes active session', () => {
  const mode = new GuidedOperationMode(true);

  mode.handle('START_SESSION');

  const paused = mode.handle('PAUSE_SESSION');
  assert.equal(paused.state, 'SESSION_PAUSED');

  const resumed = mode.handle('RESUME_SESSION');
  assert.equal(resumed.state, 'SESSION_ACTIVE');
});

test('GuidedOperationMode finishes session and allows final report', () => {
  const mode = new GuidedOperationMode(true);

  mode.handle('START_SESSION');
  const finished = mode.handle('FINISH_SESSION');
  const report = mode.handle('GENERATE_REPORT');

  assert.equal(finished.state, 'SESSION_FINISHED');
  assert.equal(report.accepted, true);
  assert.match(report.message, /Relatório final/);
});

test('GuidedOperationMode reset returns to setup required', () => {
  const mode = new GuidedOperationMode(true);

  mode.handle('START_SESSION');
  const reset = mode.handle('RESET');

  assert.equal(reset.state, 'SETUP_REQUIRED');
  assert.equal(mode.current(), 'SETUP_REQUIRED');
});
JS

python - <<'PY'
import json
from pathlib import Path

path = Path("install/registry/sprints.json")
registry = json.loads(path.read_text())

registry.setdefault("sprints", {})["sprint-069"] = {
    "name": "Guided Operation Mode",
    "script": "run-sprint-069.sh",
    "channel": "stable",
    "version": "1.0.0",
    "dependencies": ["sprint-068"],
    "description": "Adds a lightweight guided operation workflow for assisted user sessions."
}

path.write_text(json.dumps(registry, indent=2) + "\n")
PY

npm run build
npm test

git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true

git add src/application/session tests/guided-operation-mode.test.js install/registry/sprints.json
git add -f install/sprints/run-sprint-069.sh

git commit -m "feat(session): add guided operation mode"
git push -u origin "$BRANCH"

git checkout main
git pull origin main
git merge --no-ff "$BRANCH" -m "merge: sprint 069 guided operation mode"

npm run build
npm test

git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true
git push origin main

echo "== Sprint 069 completed and merged successfully =="
echo "Next:"
echo "./install/bootstrap/rlsys sprint-070"
