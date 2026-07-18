#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-A"
echo "DEV GOVERNANCE ORGANIZATION"
echo "=================================================="


ROOT="$(pwd)"
DEV="$ROOT/.dev"


if [ ! -d "$DEV" ]; then
    echo "[ERROR] .dev directory not found"
    exit 1
fi


echo "[1/5] Creating governance directories..."

mkdir -p "$DEV/agents"
mkdir -p "$DEV/prompts"
mkdir -p "$DEV/workflow"
mkdir -p "$DEV/templates"

mkdir -p "$DEV/scripts/validation"
mkdir -p "$DEV/scripts/bootstrap"
mkdir -p "$DEV/scripts/automation"



echo "[2/5] Migrating AI guidelines..."

if [ -f "$DEV/ai/agent-guidelines.md" ]; then

    mv \
    "$DEV/ai/agent-guidelines.md" \
    "$DEV/agents/agent-guidelines.md"

    rmdir "$DEV/ai" 2>/dev/null || true

    echo "[OK] agent-guidelines migrated"

else

    echo "[INFO] No migration required"

fi



echo "[3/5] Creating governance map..."

if [ ! -f "$DEV/GOVERNANCE_MAP.md" ]; then

cat > "$DEV/GOVERNANCE_MAP.md" <<'EOF'
# RL.SYS Development Governance Map

## agents

Defines AI and engineering roles.

Purpose:

- architecture agents
- implementation agents
- review agents


## prompts

Defines reusable AI instructions.


## standards

Defines mandatory technical rules.


## workflow

Defines official development processes.


## templates

Defines document structures.


## scripts

Defines project automation.

EOF

else

echo "[INFO] Governance map already exists"

fi



echo "[4/5] Validating structure..."

for DIR in \
agents \
prompts \
workflow \
templates \
scripts
do

    if [ -d "$DEV/$DIR" ]; then
        echo "[OK] .dev/$DIR"
    else
        echo "[ERROR] Missing .dev/$DIR"
        exit 1
    fi

done



echo "[5/5] Final structure"

tree "$DEV" 2>/dev/null || find "$DEV" -maxdepth 2 -type d | sort



echo "=================================================="
echo "R1-A COMPLETE"
echo "=================================================="
