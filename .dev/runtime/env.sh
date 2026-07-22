#!/usr/bin/env sh
RLSYS_HOME="$(git rev-parse --show-toplevel)"
DEV_HOME="$RLSYS_HOME/.dev"
RUNTIME_HOME="$DEV_HOME/runtime"
export RLSYS_HOME
export DEV_HOME
export RUNTIME_HOME
