#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(sed 's/\r$//' .env)
  set +a
fi

exec 9>/tmp/babystar-deploy.lock
echo "Waiting for the BabyStar deployment lock..."
flock 9

deployment_commit="${DEPLOY_COMMIT:-}"
env_fingerprint="$(sed 's/\r$//' .env | sha256sum | awk '{print $1}')"
if [[ -n "$deployment_commit" && -f .deployed-state ]]; then
  read -r deployed_commit deployed_env_fingerprint < .deployed-state || true
  if [[ "$deployed_commit" == "$deployment_commit" && "$deployed_env_fingerprint" == "$env_fingerprint" ]]; then
    echo "Commit ${deployment_commit} with the current environment is already deployed; nothing to do."
    exit 0
  fi
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
else
  next_color="blue"
  next_api_port=9101
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
    if [[ "${gateway_updated:-0}" == "1" && -f .gateway-nginx.conf.previous ]]; then
      cat .gateway-nginx.conf.previous > .gateway-nginx.conf
      docker exec babystar-gateway nginx -s reload >/dev/null 2>&1 || true
    fi
    docker compose --project-name "$next_project" --env-file .env -f docker-compose.app.yml down --remove-orphans >/dev/null 2>&1 || true
  fi
  rm -f .gateway-nginx.conf.previous .gateway-nginx.conf.tmp
  exit "$status"
}

# Remove only the former single-stack deployment. Color stacks use different project names.
if [[ "$active_color" != "blue" && "$active_color" != "green" ]]; then
  cleanup_legacy_stack
fi

docker network create babystar_shared >/dev/null 2>&1 || true
docker volume create babystar_babystar_postgres >/dev/null
if docker ps -aq --filter 'name=^/babystar-db-shared$' | grep -q .; then
  docker start babystar-db-shared >/dev/null 2>&1 || true
  docker network connect babystar_shared babystar-db-shared >/dev/null 2>&1 || true
else
  docker compose --project-name babystar-db --env-file .env -f docker-compose.db.yml up -d
fi

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
trap cleanup_failed_rollout EXIT

docker compose --project-name "$next_project" --env-file .env -f docker-compose.app.yml up -d --build --remove-orphans
wait_for_url "http://127.0.0.1:${next_api_port}/api/v1/health"

sed -e "s/__API_PORT__/${next_api_port}/g" \
  infra/nginx.gateway.conf.template > .gateway-nginx.conf.tmp
if [[ -f .gateway-nginx.conf ]]; then
  cp .gateway-nginx.conf .gateway-nginx.conf.previous
  gateway_updated=1
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
  gateway_updated=1
fi

wait_for_url "http://127.0.0.1:9000/api/v1/health"

if [[ "$active_color" == "blue" || "$active_color" == "green" ]]; then
  docker compose --project-name "babystar-${active_color}" --env-file .env -f docker-compose.app.yml down --remove-orphans >/dev/null 2>&1 || true
fi

printf '%s\n' "$next_color" > .active-color
if [[ -n "$deployment_commit" ]]; then
  printf '%s %s\n' "$deployment_commit" "$env_fingerprint" > .deployed-state
fi
trap - EXIT
rm -f .gateway-nginx.conf.previous
echo "BabyStar ${next_color} API is active on port ${next_api_port}. Static frontend is served by Render."
