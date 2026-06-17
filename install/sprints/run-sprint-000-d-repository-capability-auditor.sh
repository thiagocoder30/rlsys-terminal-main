#!/bin/bash

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

SRC="$ROOT/src"
SPRINTS="$ROOT/install/sprints"
OUTPUT="$SPRINTS/flags/REPOSITORY_CAPABILITY_MAP.json"

echo "[RL.SYS] REPOSITORY CAPABILITY AUDITOR v1 START"

# -----------------------------
# 1. COLLECT REAL MODULES
# -----------------------------

echo "[1/4] Scanning real codebase..."

MODULES=$(find "$SRC" -type f -name "*.ts" \
  | sed 's|.*/src/||g' \
  | sed 's|\.ts||g' \
  | sort)

# -----------------------------
# 2. EXTRACT DOMAIN AREAS
# -----------------------------

echo "[2/4] Extracting domain structure..."

DOMAINS=$(echo "$MODULES" | awk -F/ '
{
  if (NF>=2) {
    domain[$1][$2]=1
  }
}
END {
  for (d in domain) {
    printf "%s:", d
    for (m in domain[d]) {
      printf "%s,", m
    }
    printf "\n"
  }
}')

# -----------------------------
# 3. DETECT DUPLICATES / CLUSTERS
# -----------------------------

echo "[3/4] Detecting duplicates..."

DUPLICATES=$(echo "$MODULES" | sort | uniq -d || true)

# -----------------------------
# 4. BUILD CAPABILITY MAP
# -----------------------------

echo "[4/4] Building capability map..."

node -e "
const fs = require('fs');

const modules = \`${MODULES}\`.split('\n').filter(Boolean);
const duplicates = \`${DUPLICATES}\`.split('\n').filter(Boolean);

const map = {
  generated_at: new Date().toISOString(),
  module_count: modules.length,
  modules,
  duplicates,
  domains: {}
};

for (const m of modules) {
  const parts = m.split('/');
  const domain = parts[0] || 'unknown';
  map.domains[domain] = map.domains[domain] || [];
  map.domains[domain].push(m);
}

fs.writeFileSync('$OUTPUT', JSON.stringify(map, null, 2));
console.log('CAPABILITY MAP WRITTEN:', '$OUTPUT');
"

echo ""
echo "[RL.SYS] DONE"
echo "OUTPUT: $OUTPUT"
