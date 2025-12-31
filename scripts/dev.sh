#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

compose() {
  local -a args
  args=()
  args+=("-f" "docker-compose.yml")
  if [[ "${USE_NISQA:-}" == "1" ]]; then
    args+=("-f" "docker-compose.nisqa.yml")
  fi
  docker compose "${args[@]}" "$@"
}

echo "[dev] Starting Docker services (postgres/redis/minio/pyworker)…"
cd "$ROOT_DIR"
compose up -d postgres redis minio

if [[ "${FORCE_MIGRATE:-}" == "1" ]]; then
  echo "[dev] FORCE_MIGRATE=1: running DB migrations + seed…"
  compose run --rm migrate
  echo "[dev] DB initialized via docker-compose migrate service."
else
  echo "[dev] Checking whether DB is already initialized…"
  set +e
  HAS_PRISMA_MIGRATIONS_TABLE=$(
    compose exec -T postgres bash -lc \
      "psql -U va -d va_platform -tAc \"select 1 from information_schema.tables where table_schema='public' and table_name='_prisma_migrations' limit 1\"" \
      2>/dev/null | tr -d '[:space:]'
  )
  set -e

  if [[ "$HAS_PRISMA_MIGRATIONS_TABLE" == "1" ]]; then
    echo "[dev] DB already initialized; skipping migrate+seed (set FORCE_MIGRATE=1 to force)."
  else
    echo "[dev] DB not initialized; running migrations + seed in a one-off container…"
    compose run --rm migrate
    echo "[dev] DB initialized via docker-compose migrate service."
  fi
fi

echo "[dev] Starting pyworker…"
compose up -d pyworker

echo "[dev] Installing web dependencies (if needed)…"
if [[ ! -d "${ROOT_DIR}/web/node_modules" ]]; then
  npm --prefix web install
fi

echo "[dev] DB ready."

echo "[dev] Starting Next.js dev server + BullMQ worker…"
# Run both long-lived processes and clean them up on exit
npm --prefix web run dev &
WEB_PID=$!

npm --prefix web run worker:dev &
WORKER_PID=$!

cleanup() {
  echo ""
  echo "[dev] Shutting down…"
  kill "$WORKER_PID" 2>/dev/null || true
  kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[dev] Web:    http://localhost:3000"
echo "[dev] Pyworker: http://localhost:8000/health"

echo "[dev] Press Ctrl+C to stop."
wait "$WEB_PID"
