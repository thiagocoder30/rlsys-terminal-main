#!/bin/sh

rlsys_fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

rlsys_has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

rlsys_validate_dir() {
  if [ -d "$1" ]; then
    return 0
  fi
  rlsys_fail "Directory not found: $1"
}

rlsys_validate_file() {
  if [ -f "$1" ]; then
    return 0
  fi
  rlsys_fail "File not found: $1"
}

rlsys_load() {
  rlsys_validate_file "$1"
  . "$1"
}
