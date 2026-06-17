#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 348-UTILITY"
echo " AUTO-FETCH SCREENSHOT WORKFLOW"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

mkdir -p scripts
LOG_DIR="/sdcard/Download/rlsys/logs/sprint-348-utility"
mkdir -p "$LOG_DIR"

MAIN_LOG="$LOG_DIR/execution.log"
exec > >(tee -a "$MAIN_LOG") 2>&1

echo "[1/3] Criando Script de Extração de Diretório (fetch-latest-screenshot.sh)..."

cat > scripts/fetch-latest-screenshot.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

# Caminho padrão do Android/Termux para Screenshots
SOURCE_DIR="/data/data/com.termux/files/home/storage/shared/DCIM/Screenshots"
DEST_DIR="data/paper-runtime/warmup-screenshots"

echo "🔍 Inspecionando galeria do dispositivo..."

if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ ERRO CRÍTICO: Diretório de Screenshots não encontrado em: $SOURCE_DIR"
  echo "👉 DICA: Você precisa dar permissão de armazenamento ao Termux."
  echo "Execute o comando 'termux-setup-storage' e tente novamente."
  exit 1
fi

mkdir -p "$DEST_DIR"

# ls -t ordena por data de modificação. head -n 1 pega apenas o mais novo.
LATEST_FILE=$(ls -t "$SOURCE_DIR" | grep -iE '\.(png|jpg|jpeg|webp)$' | head -n 1 || true)

if [ -z "$LATEST_FILE" ]; then
  echo "❌ ERRO: Nenhuma imagem encontrada na pasta de Screenshots do celular."
  exit 1
fi

SOURCE_PATH="$SOURCE_DIR/$LATEST_FILE"
DEST_PATH="$DEST_DIR/$LATEST_FILE"

echo "🧹 Limpando prints antigos do projeto para evitar confusão no OCR..."
rm -f "$DEST_DIR"/*

echo "📸 Importando imagem mais recente: $LATEST_FILE"
cp "$SOURCE_PATH" "$DEST_PATH"

echo "✅ Imagem ancorada com sucesso no ambiente RL.SYS!"
EOF

chmod +x scripts/fetch-latest-screenshot.sh

echo "[2/3] Atualizando package.json para encadear a automação no boot..."

cat > package.json <<'EOF'
{
  "name": "rl-sys-core",
  "version": "2.9.0",
  "description": "RL.sys Core - enterprise-grade institutional roulette research and risk engine",
  "main": "dist/main.js",
  "scripts": {
    "start": "node dist/main.js",
    "build": "tsc",
    "dev": "tsc -w & node --watch dist/main.js",
    "test": "node install/quality/run-all-tests.cjs",
    "check": "npm run build && npm test",
    "audit:deps": "npm audit --omit=dev",
    "release:check": "npm run check && npm run audit:deps",
    "clean": "rm -rf dist",
    "build:clean": "npm run clean && npm run build",
    "start:live": "node dist/main.js",
    "start:headless": "node dist/main.js --headless",
    "start:cybernetic": "python3 satellite/main.py | npm run start:headless",
    "research:update": "node dist/research.js",
    "check:modules": "node install/quality/check-module-compatibility.cjs",
    "soak:runtime": "node scripts/runtime-soak-runner.js",
    "certify:runtime": "node scripts/runtime-certify-baseline.js",
    "paper:runtime": "node scripts/paper-runtime-session.js",
    "paper:daily": "node scripts/paper-runtime-daily-operation-cli.js",
    "paper:trial": "node scripts/paper-runtime-24h-supervision-trial.js",
    "paper:readiness": "node scripts/production-readiness-review.js",
    "warmup:qualify": "node scripts/warmup-qualification-runtime.js",
    "warmup:ingest": "node scripts/warmup-upload-ingestion-cli.js",
    "test:audit": "node install/quality/audit-test-discovery.cjs",
    "deps:audit": "node install/quality/dependency-governance-engine.cjs artifacts/dependency-governance/sprint-247-npm-audit.json",
    "arch:audit": "node install/quality/architecture-governance-engine.cjs",
    "debt:audit": "node install/quality/technical-debt-engine.cjs",
    "cert:audit": "node install/quality/repository-certification-engine.cjs --audit-json artifacts/dependency-governance/sprint-250-npm-audit.json",
    "build:guard": "node install/quality/check-clean-build-artifacts.cjs",
    "warmup:gemini-extract": "node install/runtime/warmup-gemini-extract-latest.cjs",
    "warmup:fetch": "bash scripts/fetch-latest-screenshot.sh",
    "paper": "node scripts/paper-runtime-session.js",
    "paper:live": "npm run warmup:fetch && node scripts/live-paper-orchestrator.js"
  },
  "keywords": [
    "rl-sys",
    "high-performance",
    "distributed-systems",
    "typescript",
    "express"
  ],
  "author": "RL.sys Core Team",
  "license": "MIT",
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.12",
    "@types/uuid": "^10.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.3"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "@types/multer": "^2.1.0",
    "dotenv": "^17.4.2",
    "express": "^4.19.2",
    "multer": "^2.1.1",
    "uuid": "^14.0.0"
  }
}
EOF

echo "[3/3] Consolidando Automação..."
git add scripts/fetch-latest-screenshot.sh package.json
git commit -m "chore(paper): implement automated screenshot fetcher for live paper workflow (Sprint 348-Utility)

- create fetch-latest-screenshot.sh to move newest gallery print to project data folder
- chain fetcher into npm run paper:live command for single-step operator boot
- ensure directory idempotency and stale artifact cleanup" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 348-UTILITY FINALIZADA \033[0m"
echo " FLUXO DE CAPTURA: AUTOMATIZADO"
echo "======================================"

