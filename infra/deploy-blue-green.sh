#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-babystar}"
POSTGRES_USER="${POSTGRES_USER:-babystar}"
export POSTGRES_DB POSTGRES_USER

active_color=""
if [[ -f .active-color ]]; then
  active_color="$(tr -d '[:space:]' < .active-color)"
fi

if [[ "$active_color" == "blue" ]]; then
  next_color="green"
  next_api_port=9201
  next_web_port=9202
else
  next_color="blue"
  next_api_port=9101
  next_web_port=9102
fi

next_project="babystar-${next_color}"

cleanup_legacy_stack() {
  docker compose -f docker-compose.yml down --remove-orphans >/dev/null 2>&1 || true
  docker ps -aq --filter label=com.docker.compose.project=babystar | xargs -r docker rm -f >/dev/null 2>&1 || true
  for container in babystar-db-1 babystar-api-1 babystar-worker-1 babystar-web-1 babystar-reverse-proxy-1; do
    docker rm -f "$container" >/dev/null 2>&1 || true
  done
  docker network rm babystar_default >/dev/null 2>&1 || true
}

wait_for_url() {
  local url="$1"
  local attempt
  for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error "$url" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

cleanup_failed_rollout() {
  local status=$?
  if [[ "$status" -ne 0 ]]; then
    docker compose --project-name "$next_project" --env-file .env -f docker-compose.app.yml down --remove-orphans >/dev/null 2>&1 || true
  fi
  exit "$status"
}

# Remove only the former single-stack deployment. Color stacks use different project names.
cleanup_legacy_stack

docker network create babystar_shared >/dev/null 2>&1 || true
docker volume create babystar_babystar_postgres >/dev/null
if ! docker ps --format '{{.Names}}' | grep -qx babystar-db-shared; then
  docker rm -f babystar-db-shared >/dev/null 2>&1 || true
fi
docker compose --project-name babystar-db --env-file .env -f docker-compose.db.yml up -d

for attempt in $(seq 1 30); do
  if docker exec babystar-db-shared pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo "PostgreSQL did not become ready" >&2
    exit 1
  fi
  sleep 2
done

export API_PORT="$next_api_port"
export WEB_PORT="$next_web_port"
trap cleanup_failed_rollout EXIT

docker compose --project-name "$next_project" --env-file .env -f docker-compose.app.yml up -d --build --remove-orphans
wait_for_url "http://127.0.0.1:${next_api_port}/api/v1/health"
wait_for_url "http://127.0.0.1:${next_web_port}/"

sed -e "s/__API_PORT__/${next_api_port}/g" -e "s/__WEB_PORT__/${next_web_port}/g" \
  infra/nginx.gateway.conf.template > .gateway-nginx.conf.tmp
if [[ -f .gateway-nginx.conf ]]; then
  cat .gateway-nginx.conf.tmp > .gateway-nginx.conf
  rm -f .gateway-nginx.conf.tmp
else
  mv .gateway-nginx.conf.tmp .gateway-nginx.conf
fi

if docker ps --format '{{.Names}}' | grep -qx babystar-gateway; then
  docker exec babystar-gateway nginx -t
  docker exec babystar-gateway nginx -s reload
else
  docker rm -f babystar-gateway >/dev/null 2>&1 || true
  docker compose --project-name babystar-gateway --env-file .env -f docker-compose.gateway.yml up -d
fi

wait_for_url "http://127.0.0.1:9000/api/v1/health"
wait_for_url "http://127.0.0.1:9000/"

if [[ "$active_color" == "blue" || "$active_color" == "green" ]]; then
  docker compose --project-name "babystar-${active_color}" --env-file .env -f docker-compose.app.yml down --remove-orphans >/dev/null 2>&1 || true
fi

printf '%s\n' "$next_color" > .active-color
trap - EXIT
echo "BabyStar ${next_color} is active on ports ${next_api_port}/${next_web_port}."
