#!/data/data/com.termux/files/usr/bin/bash

set -e

FILE=".dev/context/AIDER_CONTEXT.md"

if [ -f "$FILE" ]; then
    echo "[OK] Aider context available"
else
    echo "[ERROR] Missing Aider context"
    exit 1
fi
