#!/usr/bin/env bash
set -euo pipefail

ADMIN_URL="${ADMIN_URL:-https://admin.codeloot.codes}"
PUBLIC_URL="${PUBLIC_URL:-https://codeloot.codes}"

fail=0

check_contains() {
  local url="$1"
  local needle="$2"
  local label="$3"
  local body
  body="$(curl -fsSL -m 15 "$url" 2>/dev/null || true)"
  if printf '%s' "$body" | grep -q "$needle"; then
    echo "OK  $label"
  else
    echo "FAIL $label ($url)"
    fail=1
  fi
}

check_contains "$ADMIN_URL/" "CodeLoot Admin Dashboard" "admin root serves admin panel"
check_contains "$PUBLIC_URL/" "CodeLoot | Verified Roblox Codes Hub" "public root serves homepage"
check_contains "$ADMIN_URL/api/cms-health" '"cms"' "admin API health responds"

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "All routing checks passed."
