#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-A.6"
echo "AI CONTEXT BOOTSTRAP AUTOMATION"
echo "=================================================="


ROOT="$(pwd)"

SCRIPT_DIR="$ROOT/.dev/scripts/bootstrap"
OUTPUT_DIR="$ROOT/.dev/context"


echo "[1/5] Creating bootstrap directories..."

mkdir -p "$SCRIPT_DIR"
mkdir -p "$OUTPUT_DIR"


echo "[2/5] Creating context bootstrap script..."


cat > "$SCRIPT_DIR/prepare-aider-context.sh" <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash

set -e

ROOT="$(pwd)"

OUTPUT="$ROOT/.dev/context/AIDER_CONTEXT.md"


echo "Generating RL.Sys AI context..."


cat > "$OUTPUT" <<CTX
# RL.Sys Aider Context

Generated automatically.

---

# Project Identity

$(cat .dev/PROJECT.md)

---

# Vision

$(cat .dev/VISION.md)

---

# Glossary

$(cat .dev/GLOSSARY.md)

---

# Agent Rules

$(cat .dev/AGENTS.md)

---

# Architecture Standards

$(cat .dev/standards/architecture.md)

---

# Testing Standards

$(cat .dev/standards/testing.md)

---

# TypeScript Standards

$(cat .dev/standards/typescript.md)

---

# AI Workflow Contract

$(cat .dev/workflow/AI_WORKFLOW_CONTRACT.md)

---

Context ready for Aider.
CTX


echo "[OK] Context generated:"
echo "$OUTPUT"

EOF


chmod +x "$SCRIPT_DIR/prepare-aider-context.sh"


echo "[3/5] Creating context directory documentation..."


cat > "$OUTPUT_DIR/README.md" <<'EOF'
# RL.Sys AI Context

This directory contains generated AI development context.

Files in this directory are generated automatically.

Do not manually edit generated context files.

Source documents:

- .dev/PROJECT.md
- .dev/VISION.md
- .dev/GLOSSARY.md
- .dev/AGENTS.md
- .dev/standards/
- .dev/workflow/

EOF


echo "[4/5] Creating validation helper..."


cat > "$SCRIPT_DIR/validate-aider-context.sh" <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash

set -e

FILE=".dev/context/AIDER_CONTEXT.md"

if [ -f "$FILE" ]; then
    echo "[OK] Aider context available"
else
    echo "[ERROR] Missing Aider context"
    exit 1
fi
EOF


chmod +x "$SCRIPT_DIR/validate-aider-context.sh"


echo "[5/5] Validation"


for FILE in \
prepare-aider-context.sh \
validate-aider-context.sh

do

if [ -f "$SCRIPT_DIR/$FILE" ]; then
    echo "[OK] $FILE"
else
    echo "[ERROR] Missing $FILE"
    exit 1
fi

done


echo "=================================================="
echo "R1-A.6 COMPLETE"
echo "=================================================="
