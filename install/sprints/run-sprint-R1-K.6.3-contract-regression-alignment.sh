#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.6.3"
echo "Contract Regression Alignment"
echo "=================================================="

python3 <<'PY'
from pathlib import Path

path = Path("tests/strategy-decision-service.test.js")

text = path.read_text()

text = text.replace(
    "report.schemaVersion, '2.8.0'",
    "report.schemaVersion, '2.9.0'"
)

path.write_text(text)

PY


echo "=================================================="
echo "Regression contract aligned"
echo "=================================================="

npx tsc --noEmit

echo "=================================================="
echo "R1-K.6.3 COMPLETE"
echo "=================================================="

