#!/usr/bin/env sh

rlsys_path_contains() {
  case ":$PATH:" in
    *:"$1":*) return 0 ;;
    *) return 1 ;;
  esac
}

rlsys_path_add() {
  if [ ! -d "$1" ]; then
    return 0
  fi

  if rlsys_path_contains "$1"; then
    return 0
  fi

  if [ -z "$PATH" ]; then
    PATH="$1"
  else
    PATH="$PATH:$1"
  fi
}
