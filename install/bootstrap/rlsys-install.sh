#!/usr/bin/env bash
set -Eeuo pipefail

REPO_OWNER="${RLSYS_REPO_OWNER:-thiagocoder30}"
REPO_NAME="${RLSYS_REPO_NAME:-rlsys-terminal-main}"
REPO_BRANCH="${RLSYS_REPO_BRANCH:-main}"
PROJECT_DIR="${PROJECT_DIR:-$HOME/rlsys-terminal-main}"
CACHE_DIR="${RLSYS_INSTALL_CACHE:-$PROJECT_DIR/.rlsys-install-cache}"
LOG_DIR="${RLSYS_LOG_DIR:-/sdcard/Download}"

SPRINT="${1:-}"

if [ -z "$SPRINT" ]; then
  echo "Usage: rlsys-install.sh sprint-056"
  exit 2
fi

mkdir -p "$CACHE_DIR" "$LOG_DIR"

BASE_URL="https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/$REPO_BRANCH"
REGISTRY_FILE="$PROJECT_DIR/install/registry/sprints.json"

if [ -f "$REGISTRY_FILE" ] && command -v node >/dev/null 2>&1; then
  RESOLVED_SCRIPT="$(node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const s=r.sprints[process.argv[2]]; console.log(s && s.script ? s.script : '')" "$REGISTRY_FILE" "$SPRINT")"
else
  RESOLVED_SCRIPT=""
fi

if [ -n "$RESOLVED_SCRIPT" ]; then
  SCRIPT_NAME="$RESOLVED_SCRIPT"
else
  SCRIPT_NAME="run-${SPRINT}.sh"
fi
SCRIPT_URL="$BASE_URL/install/sprints/$SCRIPT_NAME"
MANIFEST_URL="$BASE_URL/install/manifests/${SPRINT}.sha256"
LOCAL_SCRIPT="$CACHE_DIR/$SCRIPT_NAME"
LOCAL_MANIFEST="$CACHE_DIR/${SPRINT}.sha256"
LOG_FILE="$LOG_DIR/rlsys-install-${SPRINT}.log"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "== RL.SYS Remote Sprint Loader =="
echo "Sprint: $SPRINT"
echo "Script: $SCRIPT_URL"
echo "Cache: $LOCAL_SCRIPT"

LOCAL_REPO_SCRIPT="$PROJECT_DIR/install/sprints/$SCRIPT_NAME"

if [ -f "$LOCAL_REPO_SCRIPT" ]; then
  echo "== Using local sprint artifact =="
  echo "Local: $LOCAL_REPO_SCRIPT"
  cp "$LOCAL_REPO_SCRIPT" "$LOCAL_SCRIPT"
else
  echo "== Downloading remote sprint artifact =="
  curl -fsSL "$SCRIPT_URL" -o "$LOCAL_SCRIPT"
fi

chmod +x "$LOCAL_SCRIPT"

if curl -fsSL "$MANIFEST_URL" -o "$LOCAL_MANIFEST"; then
  echo "== Validating SHA256 =="
  EXPECTED="$(awk '{print $1}' "$LOCAL_MANIFEST")"
  ACTUAL="$(sha256sum "$LOCAL_SCRIPT" | awk '{print $1}')"

  if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "[ERROR] SHA256 mismatch"
    echo "Expected: $EXPECTED"
    echo "Actual:   $ACTUAL"
    exit 10
  fi

  echo "SHA256 OK"
else
  echo "No SHA256 manifest found. Continuing without integrity manifest."
fi

echo "== Executing sprint =="
bash "$LOCAL_SCRIPT"
