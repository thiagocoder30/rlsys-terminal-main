#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-101-loader-sha256-log-final"
COMMIT_MSG="fix(bootstrap): preserve sha256 loader contracts and sprint logs"

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

git checkout main
git pull origin main
git reset --hard
git clean -fd dist || true

git checkout -B "$BRANCH"

mkdir -p install/bootstrap tests

cat > install/bootstrap/rlsys <<'SH'
#!/usr/bin/env bash
set -euo pipefail

LOADER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/rlsys-install.sh"
exec "$LOADER" "$@"
SH

chmod +x install/bootstrap/rlsys

cat > install/bootstrap/rlsys-install.sh <<'SH'
#!/usr/bin/env bash
set -uo pipefail

SPRINT="${1:-}"

if [ -z "$SPRINT" ]; then
  echo "Usage: ./install/bootstrap/rlsys sprint-XXX"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

REGISTRY_FILE="install/registry/sprints.json"
MANIFESTS_DIR="install/manifests"

DEFAULT_SCRIPT="run-${SPRINT}.sh"
RESOLVED_SCRIPT="$DEFAULT_SCRIPT"
EXPECTED_SHA256=""

if [ -f "$REGISTRY_FILE" ] && command -v node >/dev/null 2>&1; then
  NODE_RESULT="$(node - "$SPRINT" "$REGISTRY_FILE" "$DEFAULT_SCRIPT" <<'NODE' 2>/dev/null || true
const fs = require("node:fs");

const sprint = process.argv[2];
const registryFile = process.argv[3];
const fallback = process.argv[4];

try {
  const registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
  const entry = registry?.[sprint] || registry?.sprints?.[sprint] || {};
  const script = entry.script || entry.file || fallback;
  const sha256 = entry.sha256 || entry.checksum || "";
  process.stdout.write(`${script}\n${sha256}`);
} catch {
  process.stdout.write(`${fallback}\n`);
}
NODE
)"

  RESOLVED_SCRIPT="$(printf '%s\n' "$NODE_RESULT" | sed -n '1p')"
  EXPECTED_SHA256="$(printf '%s\n' "$NODE_RESULT" | sed -n '2p')"

  if [ -z "$RESOLVED_SCRIPT" ]; then
    RESOLVED_SCRIPT="$DEFAULT_SCRIPT"
  fi
fi

SCRIPT_NAME="$RESOLVED_SCRIPT"
LOCAL_SCRIPT="install/sprints/${SCRIPT_NAME}"

REMOTE_BASE_URL="${RLSYS_REMOTE_BASE_URL:-https://raw.githubusercontent.com/thiagocoder30/rlsys-terminal-main/main/install/sprints}"
REMOTE_SCRIPT_URL="${REMOTE_BASE_URL}/${SCRIPT_NAME}"

RLSYS_INSTALL_CACHE="${RLSYS_INSTALL_CACHE:-.rlsys-install-cache}"
CACHE_DIR="$RLSYS_INSTALL_CACHE"
CACHE_SCRIPT="${CACHE_DIR}/${SCRIPT_NAME}"

mkdir -p logs "$CACHE_DIR"

LOG_FILE="logs/rlsys-install-${SPRINT}.log"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAMPED_LOG_FILE="logs/rlsys-install-${SPRINT}-${STAMP}.log"

DOWNLOAD_DIR="/sdcard/Download"
DOWNLOAD_LOG="${DOWNLOAD_DIR}/rlsys-install-${SPRINT}.log"
DOWNLOAD_STAMPED_LOG="${DOWNLOAD_DIR}/rlsys-install-${SPRINT}-${STAMP}.log"

verify_sha256() {
  FILE="$1"

  if [ -z "$EXPECTED_SHA256" ]; then
    echo "== SHA256 verification skipped: no checksum registered =="
    return 0
  fi

  if ! command -v sha256sum >/dev/null 2>&1; then
    echo "ERROR: sha256sum is required for registered checksum verification."
    return 1
  fi

  ACTUAL_SHA256="$(sha256sum "$FILE" | awk '{print $1}')"

  if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
    echo "ERROR: sha256 mismatch for $FILE"
    echo "Expected: $EXPECTED_SHA256"
    echo "Actual  : $ACTUAL_SHA256"
    return 1
  fi

  echo "== SHA256 verified with sha256sum =="
  return 0
}

{
  echo "== RL.SYS Remote Sprint Loader =="
  echo "Sprint: $SPRINT"
  echo "Started at: $(date -Iseconds)"
  echo "Project root: $ROOT_DIR"
  echo "Registry: $REGISTRY_FILE"
  echo "Manifests: $MANIFESTS_DIR"
  echo "Resolved script: $RESOLVED_SCRIPT"
  echo "Remote source: raw.githubusercontent.com"
  echo "Remote URL: $REMOTE_SCRIPT_URL"
  echo "Cache env: RLSYS_INSTALL_CACHE=$RLSYS_INSTALL_CACHE"
  echo "Checksum tool: sha256sum"
  echo "Log file: rlsys-install-${SPRINT}.log"
  echo "Loader: rlsys-install.sh"

  if [ -d "$MANIFESTS_DIR" ]; then
    echo "== Manifests directory detected =="
  else
    echo "WARN: manifests directory not found at $MANIFESTS_DIR"
  fi

  if [ -f "$REGISTRY_FILE" ]; then
    echo "== Registry detected =="
  else
    echo "WARN: registry not found at $REGISTRY_FILE"
  fi

  if [ -f "$LOCAL_SCRIPT" ]; then
    echo "== Using local sprint artifact =="
    cp "$LOCAL_SCRIPT" "$CACHE_SCRIPT"
  else
    echo "== Local sprint artifact not found. Trying remote =="
    if command -v curl >/dev/null 2>&1; then
      if curl -fsSL "$REMOTE_SCRIPT_URL" -o "$CACHE_SCRIPT"; then
        echo "== Using remote sprint artifact =="
      elif [ -f "$CACHE_SCRIPT" ]; then
        echo "== Remote unavailable. Using cached sprint artifact =="
      else
        echo "ERROR: sprint artifact not found locally, remotely, or in cache."
        exit 1
      fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -q "$REMOTE_SCRIPT_URL" -O "$CACHE_SCRIPT"; then
        echo "== Using remote sprint artifact =="
      elif [ -f "$CACHE_SCRIPT" ]; then
        echo "== Remote unavailable. Using cached sprint artifact =="
      else
        echo "ERROR: sprint artifact not found locally, remotely, or in cache."
        exit 1
      fi
    elif [ -f "$CACHE_SCRIPT" ]; then
      echo "== Network tools unavailable. Using cached sprint artifact =="
    else
      echo "ERROR: curl/wget unavailable and no cached sprint artifact found."
      exit 1
    fi
  fi

  verify_sha256 "$CACHE_SCRIPT" || exit 1

  chmod +x "$CACHE_SCRIPT"

  echo "== Executing sprint =="
  bash "$CACHE_SCRIPT"
  STATUS=$?

  echo "== Sprint process finished =="
  echo "Exit status: $STATUS"
  echo "Finished at: $(date -Iseconds)"

  exit "$STATUS"
} 2>&1 | tee "$LOG_FILE" "$STAMPED_LOG_FILE"

STATUS="${PIPESTATUS[0]}"

if [ -d "$DOWNLOAD_DIR" ]; then
  cp "$LOG_FILE" "$DOWNLOAD_LOG" 2>/dev/null || true
  cp "$STAMPED_LOG_FILE" "$DOWNLOAD_STAMPED_LOG" 2>/dev/null || true
  echo "Log copied to: $DOWNLOAD_LOG" | tee -a "$LOG_FILE" "$STAMPED_LOG_FILE"
  echo "Stamped log copied to: $DOWNLOAD_STAMPED_LOG" | tee -a "$LOG_FILE" "$STAMPED_LOG_FILE"
else
  echo "WARN: /sdcard/Download not found. Log kept at: $LOG_FILE" | tee -a "$LOG_FILE" "$STAMPED_LOG_FILE"
fi

if [ "$STATUS" -eq 0 ]; then
  echo "Sprint completed successfully. Log: $LOG_FILE" | tee -a "$LOG_FILE" "$STAMPED_LOG_FILE"
else
  echo "Sprint failed. Log: $LOG_FILE" | tee -a "$LOG_FILE" "$STAMPED_LOG_FILE"
fi

exit "$STATUS"
SH

chmod +x install/bootstrap/rlsys-install.sh

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  install/bootstrap/rlsys \
  install/bootstrap/rlsys-install.sh \
  install/sprints/run-sprint-101.sh

git commit -m "$COMMIT_MSG"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 101 loader sha256 log final"
git push origin main

echo "== Sprint 101 completed, merged and pushed successfully =="
