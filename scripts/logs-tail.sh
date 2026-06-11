#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

current="data/logs/current.log"
applied="data/logs/applied.log"

ensure_status=0
pnpm exec tsx scripts/ensure-log-file.ts || ensure_status=$?

if [ "$ensure_status" -eq 2 ]; then
  exit 1
fi

tail_path="$current"
if [ ! -e "$tail_path" ] && [ -f "$applied" ]; then
  tail_path="$applied"
fi

if [ ! -e "$tail_path" ]; then
  echo "Waiting for log file (start the app with pnpm dev if it is not running)..."
  while [ ! -e "$current" ] && [ ! -f "$applied" ]; do
    sleep 0.5
  done
  tail_path="$current"
  if [ ! -e "$tail_path" ]; then
    tail_path="$applied"
  fi
fi

exec tail -f "$tail_path"
