et -Eeuo pipefail

SPRINT="068-human-session-report"
BRANCH="sprint-068-human-session-report"
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
git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true

git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p src/application/reporting tests install/sprints

cat > src/application/reporting/HumanSessionReportComposer.ts <<'TS'
import { OperatorRiskProfile } from '../../domain/risk';
import { PaperLedgerRuntimeState } from '../ledger';

export type HumanSessionReportVerdict =
  | 'SESSION_HEALTHY'
  | 'SESSION_PROFIT_PROTECTED'
  | 'SESSION_RISK_REVIEW'
  | 'SESSION_STOP_LOSS';

export interface HumanSessionReportInput {
  readonly profile: OperatorRiskProfile;
  readonly ledger: PaperLedgerRuntimeState;
  readonly blockedEntries: number;
  readonly reviewEntries: number;
  readonly cooldownBlocks: number;
}

export interface HumanSessionReport {
  readonly verdict: HumanSessionReportVerdict;
  readonly title: string;
  readonly summary: string;
  readonly recommendedAction: string;
  readonly markdown: string;
}

/**
 * Builds a human-readable report focused on operator discipline.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class HumanSessionReportComposer {
  public compose(input: HumanSessionReportInput): HumanSessionReport {
    this.assertInput(input);

    const verdict = this.verdict(input);
    const title = this.title(verdict);
    const summary = this.summary(verdict);
    const recommendedAction = this.recommendedAction(verdict);

    return {
      verdict,
      title,
      summary,
      recommendedAction,
      markdown: this.markdown(input, verdict, title, summary, recommendedAction),
    };
  }

  private verdict(input: HumanSessionReportInput): HumanSessionReportVerdict {
    if (input.ledger.sessionPnl <= -input.profile.dailyStopLoss) {
      return 'SESSION_STOP_LOSS';
    }

    if (input.ledger.sessionPnl >= input.profile.dailyStopWin) {
      return 'SESSION_PROFIT_PROTECTED';
    }

    if (
      input.blockedEntries > 0 ||
      input.cooldownBlocks > 0 ||
      input.reviewEntries >= 3 ||
      input.ledger.drawdown >= input.profile.dailyStopLoss * 0.7
    ) {
      return 'SESSION_RISK_REVIEW';
    }

    return 'SESSION_HEALTHY';
  }

  private title(verdict: HumanSessionReportVerdict): string {
    if (verdict === 'SESSION_PROFIT_PROTECTED') {
      return 'Sessão positiva — lucro deve ser preservado';
    }

    if (verdict === 'SESSION_STOP_LOSS') {
      return 'Sessão encerrada por proteção de banca';
    }

    if (verdict === 'SESSION_RISK_REVIEW') {
      return 'Sessão exige revisão de disciplina';
    }

    return 'Sessão saudável';
  }

  private summary(verdict: HumanSessionReportVerdict): string {
    if (verdict === 'SESSION_PROFIT_PROTECTED') {
      return 'A meta de lucro foi atingida. Encerrar agora preserva o resultado positivo.';
    }

    if (verdict === 'SESSION_STOP_LOSS') {
      return 'O limite de perda foi atingido. Continuar aumenta o risco emocional.';
    }

    if (verdict === 'SESSION_RISK_REVIEW') {
      return 'A sessão apresentou bloqueios, revisões ou sinais de risco operacional.';
    }

    return 'A sessão permaneceu dentro dos limites saudáveis de banca e disciplina.';
  }

  private recommendedAction(verdict: HumanSessionReportVerdict): string {
    if (verdict === 'SESSION_PROFIT_PROTECTED') {
      return 'Encerrar a sessão e registrar o lucro.';
    }

    if (verdict === 'SESSION_STOP_LOSS') {
      return 'Encerrar imediatamente e evitar recuperação no impulso.';
    }

    if (verdict === 'SESSION_RISK_REVIEW') {
      return 'Pausar, revisar entradas e reduzir frequência operacional.';
    }

    return 'Manter o padrão conservador na próxima sessão.';
  }

  private markdown(
    input: HumanSessionReportInput,
    verdict: HumanSessionReportVerdict,
    title: string,
    summary: string,
    recommendedAction: string,
  ): string {
    return [
      '# RL.SYS — Relatório Humano de Sessão',
      '',
      `## ${title}`,
      '',
      `**Veredito:** ${verdict}`,
      '',
      `**Resumo:** ${summary}`,
      '',
      '## Banca',
      '',
      `- Banca inicial: R$ ${this.money(input.ledger.initialBalance)}`,
      `- Saldo final: R$ ${this.money(input.ledger.currentBalance)}`,
      `- PNL da sessão: R$ ${this.money(input.ledger.sessionPnl)}`,
      `- Drawdown: R$ ${this.money(input.ledger.drawdown)}`,
      '',
      '## Limites saudáveis',
      '',
      `- Entrada base: R$ ${this.money(input.profile.baseStake)}`,
      `- Stop win: R$ ${this.money(input.profile.dailyStopWin)}`,
      `- Stop loss: R$ ${this.money(input.profile.dailyStopLoss)}`,
      `- Exposição máxima: R$ ${this.money(input.profile.maxSingleExposure)}`,
      `- Martingale máximo: ${input.profile.maxMartingaleSteps}`,
      '',
      '## Disciplina operacional',
      '',
      `- Vitórias registradas: ${input.ledger.wins}`,
      `- Perdas registradas: ${input.ledger.losses}`,
      `- Entradas bloqueadas: ${input.blockedEntries}`,
      `- Entradas em revisão: ${input.reviewEntries}`,
      `- Bloqueios por cooldown: ${input.cooldownBlocks}`,
      '',
      '## Ação recomendada',
      '',
      recommendedAction,
      '',
    ].join('\n');
  }

  private assertInput(input: HumanSessionReportInput): void {
    if (!Number.isInteger(input.blockedEntries) || input.blockedEntries < 0) {
      throw new Error('blockedEntries must be a non-negative integer');
    }

    if (!Number.isInteger(input.reviewEntries) || input.reviewEntries < 0) {
      throw new Error('reviewEntries must be a non-negative integer');
    }

    if (!Number.isInteger(input.cooldownBlocks) || input.cooldownBlocks < 0) {
      throw new Error('cooldownBlocks must be a non-negative integer');
    }
  }

  private money(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }
}
TS

python - <<'PY'
from pathlib import Path

p = Path("src/application/reporting/index.ts")
s = p.read_text() if p.exists() else ""
line = "export * from './HumanSessionReportComposer';\n"

if line not in s:
    s += line

p.write_text(s)
PY

cat > tests/human-session-report-composer.test.js <<'JS'
const test = require('node:test');
const assert = require('node:assert/strict');
const { HumanSessionReportComposer } = require('../dist/application/reporting');
const { PaperLedgerRuntimeService } = require('../dist/application/ledger');
const { OperatorRiskProfileCalculator } = require('../dist/domain/risk');

function profile() {
  return new OperatorRiskProfileCalculator().calculate({
    bankroll: 200,
    riskMode: 'CONSERVATIVE',
    allowMartingale: true,
  });
}

test('HumanSessionReportComposer reports healthy session', () => {
  const ledger = new PaperLedgerRuntimeService(200);
  ledger.apply({ type: 'WIN', amount: 4 });

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 0,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_HEALTHY');
  assert.match(report.markdown, /Relatório Humano/);
  assert.match(report.markdown, /Saldo final/);
});

test('HumanSessionReportComposer protects profit at stop win', () => {
  const ledger = new PaperLedgerRuntimeService(200);
  ledger.apply({ type: 'WIN', amount: 16 });

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 0,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_PROFIT_PROTECTED');
  assert.match(report.recommendedAction, /Encerrar/);
});

test('HumanSessionReportComposer reports stop loss', () => {
  const ledger = new PaperLedgerRuntimeService(200);
  ledger.apply({ type: 'LOSS', amount: 10 });

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 0,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_STOP_LOSS');
  assert.match(report.summary, /limite de perda/);
});

test('HumanSessionReportComposer reports risk review for blocks', () => {
  const ledger = new PaperLedgerRuntimeService(200);

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 1,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_RISK_REVIEW');
  assert.match(report.recommendedAction, /Pausar/);
});

test('HumanSessionReportComposer rejects invalid counters', () => {
  const ledger = new PaperLedgerRuntimeService(200);

  assert.throws(() => new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: -1,
    reviewEntries: 0,
    cooldownBlocks: 0,
  }), /blockedEntries/);
});
JS

python - <<'PY'
import json
from pathlib import Path

path = Path("install/registry/sprints.json")
registry = json.loads(path.read_text())

registry.setdefault("sprints", {})["sprint-068"] = {
    "name": "Human Session Report",
    "script": "run-sprint-068.sh",
    "channel": "stable",
    "version": "1.0.0",
    "dependencies": ["sprint-067"],
    "description": "Adds human-readable session report composer for bankroll, discipline, drawdown and recommended actions."
}

path.write_text(json.dumps(registry, indent=2) + "\n")
PY

npm run build
npm test

git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true

git add src/application/reporting/HumanSessionReportComposer.ts src/application/reporting/index.ts tests/human-session-report-composer.test.js install/registry/sprints.json
git add -f install/sprints/run-sprint-068.sh

git commit -m "feat(reporting): add human session report composer"
git push -u origin "$BRANCH"

git checkout main
git pull origin main
git merge --no-ff "$BRANCH" -m "merge: sprint 068 human session report"

npm run build
npm test

git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true
git push origin main

echo "== Sprint 068 completed and merged successfully =="
echo "Next:"
echo "./install/bootstrap/rlsys sprint-069"#!/usr/bin/env bash
set -Eeuo pipefail

SPRINT="068-human-session-report"
BRANCH="sprint-068-human-session-report"
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
git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true

git branch -D "$BRANCH" 2>/dev/null || true
git checkout -b "$BRANCH"

mkdir -p src/application/reporting tests install/sprints

cat > src/application/reporting/HumanSessionReportComposer.ts <<'TS'
import { OperatorRiskProfile } from '../../domain/risk';
import { PaperLedgerRuntimeState } from '../ledger';

export type HumanSessionReportVerdict =
  | 'SESSION_HEALTHY'
  | 'SESSION_PROFIT_PROTECTED'
  | 'SESSION_RISK_REVIEW'
  | 'SESSION_STOP_LOSS';

export interface HumanSessionReportInput {
  readonly profile: OperatorRiskProfile;
  readonly ledger: PaperLedgerRuntimeState;
  readonly blockedEntries: number;
  readonly reviewEntries: number;
  readonly cooldownBlocks: number;
}

export interface HumanSessionReport {
  readonly verdict: HumanSessionReportVerdict;
  readonly title: string;
  readonly summary: string;
  readonly recommendedAction: string;
  readonly markdown: string;
}

/**
 * Builds a human-readable report focused on operator discipline.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class HumanSessionReportComposer {
  public compose(input: HumanSessionReportInput): HumanSessionReport {
    this.assertInput(input);

    const verdict = this.verdict(input);
    const title = this.title(verdict);
    const summary = this.summary(verdict);
    const recommendedAction = this.recommendedAction(verdict);

    return {
      verdict,
      title,
      summary,
      recommendedAction,
      markdown: this.markdown(input, verdict, title, summary, recommendedAction),
    };
  }

  private verdict(input: HumanSessionReportInput): HumanSessionReportVerdict {
    if (input.ledger.sessionPnl <= -input.profile.dailyStopLoss) {
      return 'SESSION_STOP_LOSS';
    }

    if (input.ledger.sessionPnl >= input.profile.dailyStopWin) {
      return 'SESSION_PROFIT_PROTECTED';
    }

    if (
      input.blockedEntries > 0 ||
      input.cooldownBlocks > 0 ||
      input.reviewEntries >= 3 ||
      input.ledger.drawdown >= input.profile.dailyStopLoss * 0.7
    ) {
      return 'SESSION_RISK_REVIEW';
    }

    return 'SESSION_HEALTHY';
  }

  private title(verdict: HumanSessionReportVerdict): string {
    if (verdict === 'SESSION_PROFIT_PROTECTED') {
      return 'Sessão positiva — lucro deve ser preservado';
    }

    if (verdict === 'SESSION_STOP_LOSS') {
      return 'Sessão encerrada por proteção de banca';
    }

    if (verdict === 'SESSION_RISK_REVIEW') {
      return 'Sessão exige revisão de disciplina';
    }

    return 'Sessão saudável';
  }

  private summary(verdict: HumanSessionReportVerdict): string {
    if (verdict === 'SESSION_PROFIT_PROTECTED') {
      return 'A meta de lucro foi atingida. Encerrar agora preserva o resultado positivo.';
    }

    if (verdict === 'SESSION_STOP_LOSS') {
      return 'O limite de perda foi atingido. Continuar aumenta o risco emocional.';
    }

    if (verdict === 'SESSION_RISK_REVIEW') {
      return 'A sessão apresentou bloqueios, revisões ou sinais de risco operacional.';
    }

    return 'A sessão permaneceu dentro dos limites saudáveis de banca e disciplina.';
  }

  private recommendedAction(verdict: HumanSessionReportVerdict): string {
    if (verdict === 'SESSION_PROFIT_PROTECTED') {
      return 'Encerrar a sessão e registrar o lucro.';
    }

    if (verdict === 'SESSION_STOP_LOSS') {
      return 'Encerrar imediatamente e evitar recuperação no impulso.';
    }

    if (verdict === 'SESSION_RISK_REVIEW') {
      return 'Pausar, revisar entradas e reduzir frequência operacional.';
    }

    return 'Manter o padrão conservador na próxima sessão.';
  }

  private markdown(
    input: HumanSessionReportInput,
    verdict: HumanSessionReportVerdict,
    title: string,
    summary: string,
    recommendedAction: string,
  ): string {
    return [
      '# RL.SYS — Relatório Humano de Sessão',
      '',
      `## ${title}`,
      '',
      `**Veredito:** ${verdict}`,
      '',
      `**Resumo:** ${summary}`,
      '',
      '## Banca',
      '',
      `- Banca inicial: R$ ${this.money(input.ledger.initialBalance)}`,
      `- Saldo final: R$ ${this.money(input.ledger.currentBalance)}`,
      `- PNL da sessão: R$ ${this.money(input.ledger.sessionPnl)}`,
      `- Drawdown: R$ ${this.money(input.ledger.drawdown)}`,
      '',
      '## Limites saudáveis',
      '',
      `- Entrada base: R$ ${this.money(input.profile.baseStake)}`,
      `- Stop win: R$ ${this.money(input.profile.dailyStopWin)}`,
      `- Stop loss: R$ ${this.money(input.profile.dailyStopLoss)}`,
      `- Exposição máxima: R$ ${this.money(input.profile.maxSingleExposure)}`,
      `- Martingale máximo: ${input.profile.maxMartingaleSteps}`,
      '',
      '## Disciplina operacional',
      '',
      `- Vitórias registradas: ${input.ledger.wins}`,
      `- Perdas registradas: ${input.ledger.losses}`,
      `- Entradas bloqueadas: ${input.blockedEntries}`,
      `- Entradas em revisão: ${input.reviewEntries}`,
      `- Bloqueios por cooldown: ${input.cooldownBlocks}`,
      '',
      '## Ação recomendada',
      '',
      recommendedAction,
      '',
    ].join('\n');
  }

  private assertInput(input: HumanSessionReportInput): void {
    if (!Number.isInteger(input.blockedEntries) || input.blockedEntries < 0) {
      throw new Error('blockedEntries must be a non-negative integer');
    }

    if (!Number.isInteger(input.reviewEntries) || input.reviewEntries < 0) {
      throw new Error('reviewEntries must be a non-negative integer');
    }

    if (!Number.isInteger(input.cooldownBlocks) || input.cooldownBlocks < 0) {
      throw new Error('cooldownBlocks must be a non-negative integer');
    }
  }

  private money(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }
}
TS

python - <<'PY'
from pathlib import Path

p = Path("src/application/reporting/index.ts")
s = p.read_text() if p.exists() else ""
line = "export * from './HumanSessionReportComposer';\n"

if line not in s:
    s += line

p.write_text(s)
PY

cat > tests/human-session-report-composer.test.js <<'JS'
const test = require('node:test');
const assert = require('node:assert/strict');
const { HumanSessionReportComposer } = require('../dist/application/reporting');
const { PaperLedgerRuntimeService } = require('../dist/application/ledger');
const { OperatorRiskProfileCalculator } = require('../dist/domain/risk');

function profile() {
  return new OperatorRiskProfileCalculator().calculate({
    bankroll: 200,
    riskMode: 'CONSERVATIVE',
    allowMartingale: true,
  });
}

test('HumanSessionReportComposer reports healthy session', () => {
  const ledger = new PaperLedgerRuntimeService(200);
  ledger.apply({ type: 'WIN', amount: 4 });

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 0,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_HEALTHY');
  assert.match(report.markdown, /Relatório Humano/);
  assert.match(report.markdown, /Saldo final/);
});

test('HumanSessionReportComposer protects profit at stop win', () => {
  const ledger = new PaperLedgerRuntimeService(200);
  ledger.apply({ type: 'WIN', amount: 16 });

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 0,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_PROFIT_PROTECTED');
  assert.match(report.recommendedAction, /Encerrar/);
});

test('HumanSessionReportComposer reports stop loss', () => {
  const ledger = new PaperLedgerRuntimeService(200);
  ledger.apply({ type: 'LOSS', amount: 10 });

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 0,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_STOP_LOSS');
  assert.match(report.summary, /limite de perda/);
});

test('HumanSessionReportComposer reports risk review for blocks', () => {
  const ledger = new PaperLedgerRuntimeService(200);

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 1,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_RISK_REVIEW');
  assert.match(report.recommendedAction, /Pausar/);
});

test('HumanSessionReportComposer rejects invalid counters', () => {
  const ledger = new PaperLedgerRuntimeService(200);

  assert.throws(() => new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: -1,
    reviewEntries: 0,
    cooldownBlocks: 0,
  }), /blockedEntries/);
});
JS

python - <<'PY'
import json
from pathlib import Path

path = Path("install/registry/sprints.json")
registry = json.loads(path.read_text())

registry.setdefault("sprints", {})["sprint-068"] = {
    "name": "Human Session Report",
    "script": "run-sprint-068.sh",
    "channel": "stable",
    "version": "1.0.0",
    "dependencies": ["sprint-067"],
    "description": "Adds human-readable session report composer for bankroll, discipline, drawdown and recommended actions."
}

path.write_text(json.dumps(registry, indent=2) + "\n")
PY

npm run build
npm test

git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true

git add src/application/reporting/HumanSessionReportComposer.ts src/application/reporting/index.ts tests/human-session-report-composer.test.js install/registry/sprints.json
git add -f install/sprints/run-sprint-068.sh

git commit -m "feat(reporting): add human session report composer"
git push -u origin "$BRANCH"

git checkout main
git pull origin main
git merge --no-ff "$BRANCH" -m "merge: sprint 068 human session report"

npm run build
npm test

git restore dist/application/live/LiveSessionCoordinator.js dist/main.js 2>/dev/null || true
git push origin main

echo "== Sprint 068 completed and merged successfully =="
echo "Next:"
echo "./install/bootstrap/rlsys sprint-069"
