#!/usr/bin/env bash
.dev/scripts/bootstrap/start-aider-session.sh set -e

ROOT="$(pwd)"
.dev/scripts/bootstrap/validate-aider-context.sh
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

