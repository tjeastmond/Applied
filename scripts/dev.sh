#!/usr/bin/env sh
set -eu

default_port=3030
env_file=".env.local"

if [ -f "$env_file" ]; then
  env_port=$(grep -E "^PORT=" "$env_file" | tail -n 1 | cut -d= -f2-)
  if [ -n "$env_port" ]; then
    PORT="$env_port"
    export PORT
  fi
fi

exec next dev -p "${PORT:-$default_port}"
