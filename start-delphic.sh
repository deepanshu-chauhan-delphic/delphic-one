#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_BASE="${SCRIPT_DIR}/docker-compose.yml"
COMPOSE_PROD="${SCRIPT_DIR}/docker-compose.prod.yml"
UNIT_NAME="delphic.service"
UNIT_PATH="/etc/systemd/system/${UNIT_NAME}"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ -t 1 ]]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BLUE=$'\033[34m'; NC=$'\033[0m'
else
  RED=""; GREEN=""; YELLOW=""; BLUE=""; NC=""
fi

info() { printf '%s[info]%s %s\n' "${BLUE}" "${NC}" "$*"; }
success() { printf '%s[ok]%s %s\n' "${GREEN}" "${NC}" "$*"; }
warning() { printf '%s[warn]%s %s\n' "${YELLOW}" "${NC}" "$*"; }
error() { printf '%s[error]%s %s\n' "${RED}" "${NC}" "$*" >&2; }

usage() {
  cat <<'EOF'
Usage: ./start-delphic.sh [options]

Start the Delphic stack with Docker Compose (Postgres + API + client nginx).

Options:
  --prod       Use docker-compose.prod.yml (loopback binds, required secrets)
  --service    Non-interactive entry for systemd (no boot reinstall)
  --no-boot    Skip installing/enabling the systemd unit after a successful start
  -h, --help   Show this help

Examples:
  ./start-delphic.sh --prod
  ./start-delphic.sh --prod --no-boot
  ./start-delphic.sh --prod --service
EOF
}

require_file() {
  local path="$1"
  if [[ ! -f "${path}" ]]; then
    error "Missing required file: ${path}"
    exit 2
  fi
}

env_has_value() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n1 | cut -d= -f2- || true)"
  if [[ -z "${value}" ]]; then
    return 1
  fi
  case "${value}" in
    change_me_*|dev_*_change_me|postgres|local_dev_*) return 1 ;;
  esac
  if [[ "${key}" == JWT_* && "${#value}" -lt 32 ]]; then
    return 1
  fi
  return 0
}

validate_prod_env() {
  require_file "${ENV_FILE}"
  local missing=0
  for key in POSTGRES_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET CORS_ORIGIN; do
    if ! env_has_value "${key}"; then
      error "${key} must be set to a strong non-placeholder value in ${ENV_FILE}"
      missing=1
    fi
  done
  if [[ "${missing}" -ne 0 ]]; then
    exit 2
  fi
}

compose_cmd() {
  docker compose -f "${COMPOSE_BASE}" -f "${COMPOSE_PROD}" "$@"
}

# The prod overlay relies on the !reset / !override merge tags (Compose 2.24+).
# On an older Compose those tags fail or silently append, which would publish
# Postgres and the API on every interface. Assert the merged result instead of
# trusting a version string.
assert_loopback_only() {
  local merged published_count loopback_count
  if ! merged="$(compose_cmd config 2>&1)"; then
    error "docker compose config failed:"
    printf '%s\n' "${merged}" >&2
    exit 1
  fi

  # Compose omits host_ip entirely when a port binds all interfaces, so compare
  # the number of published ports against the number bound to 127.0.0.1.
  published_count="$(printf '%s\n' "${merged}" | grep -cE '^\s*published:' || true)"
  loopback_count="$(printf '%s\n' "${merged}" | grep -cE '^\s*host_ip:\s*127\.0\.0\.1\s*$' || true)"

  if [[ "${published_count}" -ne "${loopback_count}" ]]; then
    error "Merged compose config publishes ${published_count} port(s) but only ${loopback_count} are bound to 127.0.0.1."
    error "Docker publish rules bypass UFW, so this would expose services to the internet."
    error "This usually means Docker Compose is older than 2.24 and ignored the !reset/!override tags."
    error "Check 'docker compose version', then re-run."
    exit 1
  fi

  if printf '%s\n' "${merged}" | grep -qE '^\s*published:\s*"?(5432|5434)"?\s*$'; then
    error "Merged compose config still publishes Postgres. Refusing to start."
    exit 1
  fi

  success "Preflight: all ${published_count} published port(s) bound to loopback only"
}

wait_for_health() {
  local url="http://127.0.0.1:${API_PORT:-4000}/api/v1/health"
  local i
  for i in $(seq 1 60); do
    if curl -sf "${url}" >/dev/null; then
      success "API healthy at ${url}"
      return 0
    fi
    info "Waiting for API… (${i}/60)"
    sleep 5
  done
  error "API did not become healthy"
  compose_cmd logs --no-color --tail=80 || true
  exit 1
}

install_boot_unit() {
  if [[ "${EUID}" -ne 0 ]]; then
    warning "Skipping systemd install (need root). Re-run with sudo to enable boot persistence."
    return 0
  fi

  cat > "${UNIT_PATH}" <<EOF
[Unit]
Description=Delphic One Docker Compose stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${SCRIPT_DIR}/start-delphic.sh --prod --service
ExecStop=/usr/bin/docker compose -f ${COMPOSE_BASE} -f ${COMPOSE_PROD} down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "${UNIT_NAME}"
  success "Installed and enabled ${UNIT_NAME}"
}

main() {
  local use_prod=0
  local as_service=0
  local no_boot=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prod) use_prod=1 ;;
      --service) as_service=1 ;;
      --no-boot) no_boot=1 ;;
      -h|--help) usage; exit 0 ;;
      *) error "Unknown option: $1"; usage; exit 2 ;;
    esac
    shift
  done

  if [[ "${use_prod}" -ne 1 ]]; then
    error "This front door is for production. Pass --prod (local Docker uses: docker compose up)."
    exit 2
  fi

  require_file "${COMPOSE_BASE}"
  require_file "${COMPOSE_PROD}"
  command -v docker >/dev/null || { error "docker is required"; exit 2; }
  command -v curl >/dev/null || { error "curl is required"; exit 2; }

  require_file "${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a
  validate_prod_env
  assert_loopback_only

  if [[ "${as_service}" -eq 1 ]]; then
    info "Stopping stale stack (service mode)"
    compose_cmd down || true
  fi

  info "Building and starting production stack"
  compose_cmd up -d --build
  wait_for_health

  if [[ "${as_service}" -eq 0 && "${no_boot}" -eq 0 ]]; then
    install_boot_unit
  elif [[ "${no_boot}" -eq 1 ]]; then
    warning "Boot persistence skipped (--no-boot)"
  fi

  success "Delphic is up. Client: http://127.0.0.1:${CLIENT_PORT:-8081} (front with host nginx + TLS)"
}

main "$@"
