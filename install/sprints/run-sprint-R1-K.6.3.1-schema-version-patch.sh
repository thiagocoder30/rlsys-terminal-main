#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================================="
echo "RL.SYS CORE"
echo "SPRINT R1-K.6.3.1"
echo "Schema Version Exact Patch"
echo "=================================================="

python3 <<'PY'
from pathlib import Path

path = Path("tests/strategy-decision-service.test.js")

text = path.read_text()

old = "assert.equal(report.schemaVersion, '2.8.0');"
new = "assert.equal(report.schemaVersion, '2.9.0');"

if old not in text:
    raise SystemExit(
        "Expected schema assertion not found"
    )

text = text.replace(old, new)

path.write_text(text)

PY

echo "=================================================="
echo "Schema version updated"
echo "=================================================="

