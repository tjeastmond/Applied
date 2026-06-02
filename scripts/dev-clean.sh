#!/usr/bin/env sh
set -eu

pkill -f "next dev" 2>/dev/null || true
sleep 2

attempt=1
max_attempts=5
while [ "$attempt" -le "$max_attempts" ]; do
  if rm -rf .next 2>/dev/null; then
    break
  fi
  if [ "$attempt" -eq "$max_attempts" ]; then
    echo "dev:clean: could not remove .next (is another Next.js process still running?)" >&2
    exit 1
  fi
  sleep 1
  attempt=$((attempt + 1))
done

exec next dev --turbopack
