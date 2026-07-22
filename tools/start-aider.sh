#!/usr/bin/env bash

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

source "$ROOT/.dev/ai/aider-runtime/.venv/bin/activate"

cd "$ROOT"

exec aider "$@"
