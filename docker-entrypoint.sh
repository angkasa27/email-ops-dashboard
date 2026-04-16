#!/usr/bin/env bash
set -eu

pnpm run start:worker &
worker_pid=$!

pnpm run start:web &
web_pid=$!

terminate() {
  kill -TERM "$worker_pid" "$web_pid" 2>/dev/null || true
}

trap terminate INT TERM

wait -n "$worker_pid" "$web_pid"
status=$?
terminate
wait "$worker_pid" "$web_pid" 2>/dev/null || true
exit "$status"
