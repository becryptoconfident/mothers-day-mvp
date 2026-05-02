#!/usr/bin/env bash
# Secure rotation of leaked production keys.
#
# Workflow:
#   1. Roll the key in its provider dashboard FIRST (script reminds you).
#   2. Run: bash scripts/rotate-keys.sh --group N
#        (1=Stripe, 2=Supabase/Resend/R2, 3=Vercel/Namecheap, 4=Anthropic)
#   3. Paste each new value at the prompt — input is hidden.
#   4. Script removes the old Vercel env, adds the new via stdin (chmod-600
#      tempfile, shred-on-exit), then updates .env.local atomically.
#   5. Optional: redeploy production at the end.
#
# Security non-negotiables:
#   - Hidden input via `read -rs` for every value.
#   - Values never on the command line as positional args.
#   - Values never echoed to terminal.
#   - Tempfiles use mktemp + chmod 600 + overwrite-then-rm (or shred when
#     available), removed via EXIT/INT/TERM trap.
#   - `set -euo pipefail` + `umask 077`.
#   - No logs or backups containing values.
#
# Compatible with macOS bash 3.2 (no associative arrays, no namerefs).

set -euo pipefail
umask 077

# ─── Paths + colors ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.local"

if [ -t 1 ]; then
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'
  C_RESET=$'\033[0m'
else
  C_BOLD=''; C_DIM=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_RESET=''
fi

# ─── Trap-based tempfile cleanup ──────────────────────────────────────
TMP_FILES=()

cleanup() {
  local f
  if [ "${#TMP_FILES[@]}" -eq 0 ]; then return; fi
  for f in "${TMP_FILES[@]}"; do
    [ -z "${f:-}" ] && continue
    [ ! -e "$f" ] && continue
    if command -v shred >/dev/null 2>&1; then
      shred -u "$f" 2>/dev/null || rm -f "$f"
    else
      # macOS lacks shred. Overwrite same-size random bytes, then rm.
      local size
      size=$(wc -c < "$f" 2>/dev/null | tr -d ' ' || echo 0)
      if [ "${size:-0}" -gt 0 ]; then
        dd if=/dev/urandom of="$f" bs=1 count="$size" conv=notrunc >/dev/null 2>&1 || true
      fi
      rm -f "$f"
    fi
  done
}
trap cleanup EXIT INT TERM

# ─── Group definitions ────────────────────────────────────────────────
# Each group prints its rows in KEY|Provider|Dashboard URL|Format-regex format.
# Single-quoted heredocs keep $ literal in regexes.
get_group_keys() {
  case "$1" in
    1) cat <<'EOF'
STRIPE_SECRET_KEY|Stripe|https://dashboard.stripe.com/apikeys|^sk_(live|test)_
STRIPE_WEBHOOK_SECRET|Stripe|https://dashboard.stripe.com/webhooks (endpoint -> Signing secret)|^whsec_
EOF
      ;;
    2) cat <<'EOF'
SUPABASE_SERVICE_ROLE_KEY|Supabase|https://supabase.com/dashboard/project/_/settings/api|^eyJ
RESEND_API_KEY|Resend|https://resend.com/api-keys|^re_
R2_ACCESS_KEY_ID|Cloudflare R2|https://dash.cloudflare.com -> R2 -> Manage R2 API Tokens|^[a-f0-9]{20,}$
R2_SECRET_ACCESS_KEY|Cloudflare R2|same R2 API Tokens page (rotated together)|^[a-f0-9]{40,}$
EOF
      ;;
    3) cat <<'EOF'
VERCEL_TOKEN|Vercel|https://vercel.com/account/tokens|^[A-Za-z0-9_-]{20,}$
NAMECHEAP_API_KEY|Namecheap|https://ap.www.namecheap.com/Profile/Tools/ApiAccess|^[a-f0-9]{20,}$
EOF
      ;;
    4) cat <<'EOF'
ANTHROPIC_API_KEY|Anthropic|https://console.anthropic.com/settings/keys|^sk-ant-
EOF
      ;;
    *) return 1 ;;
  esac
}

get_group_label() {
  case "$1" in
    1) printf 'Priority 1: Stripe' ;;
    2) printf 'Priority 2: Supabase / Resend / R2' ;;
    3) printf 'Priority 3: Vercel / Namecheap' ;;
    4) printf 'Priority 4: Anthropic' ;;
    *) return 1 ;;
  esac
}

get_group_verify() {
  case "$1" in
    1) printf 'Send a test webhook event from the Stripe dashboard. Confirm /api/stripe-webhook returns 200.' ;;
    2) printf 'Run a verify pass: load /preview (Supabase), trigger save-progress (Resend), upload a photo (R2).' ;;
    3) printf "Run 'vercel whoami' to confirm token works. Test Namecheap API only if you actively use it." ;;
    4) printf 'Trigger a /preview generation to confirm Anthropic calls succeed.' ;;
    *) return 1 ;;
  esac
}

# ─── Helpers ──────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${C_BOLD}rotate-keys.sh${C_RESET} -- secure rotation of leaked production keys.

${C_BOLD}Usage:${C_RESET}
  bash scripts/rotate-keys.sh --group N

${C_BOLD}Groups:${C_RESET}
  1   Stripe (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
  2   Supabase / Resend / R2 (SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
        R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)
  3   Vercel / Namecheap (VERCEL_TOKEN, NAMECHEAP_API_KEY)
  4   Anthropic (ANTHROPIC_API_KEY)

Run groups in priority order. Verify each group works before moving on.
EOF
}

# Atomic in-place .env.local update. Replace existing KEY= line if present,
# else append. Tempfile registered with trap cleanup.
update_env_local() {
  local key="$1"
  local value="$2"
  local tmp
  tmp=$(mktemp "$PROJECT_DIR/.env.local.XXXXXX")
  TMP_FILES+=("$tmp")
  chmod 600 "$tmp"

  local found=0
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "$key="*)
        printf '%s=%s\n' "$key" "$value" >> "$tmp"
        found=1
        ;;
      *)
        printf '%s\n' "$line" >> "$tmp"
        ;;
    esac
  done < "$ENV_FILE"
  if [ "$found" -eq 0 ]; then
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi

  mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

# Prompt for one key, format-check (with retry), push to Vercel via stdin
# tempfile, then update .env.local. Returns non-zero on hard failure.
rotate_one() {
  local key="$1" provider="$2" dashboard="$3" pattern="$4"
  echo ""
  echo "${C_BOLD}-- $key${C_RESET} ${C_DIM}($provider)${C_RESET}"
  echo "  ${C_DIM}1. Roll this key in the $provider dashboard first:${C_RESET}"
  echo "     $dashboard"
  echo "  ${C_DIM}2. Paste the new value below (input hidden, Enter to submit).${C_RESET}"

  local value=""
  while true; do
    printf "  Paste new %s: " "$key"
    if ! read -rs value; then
      echo ""
      echo "  ${C_RED}aborted${C_RESET}" >&2
      return 1
    fi
    echo ""
    if [ -z "$value" ]; then
      echo "  ${C_YELLOW}empty value -- try again or Ctrl+C to abort${C_RESET}"
      continue
    fi
    if [ "$pattern" != "-" ] && ! [[ "$value" =~ $pattern ]]; then
      echo "  ${C_YELLOW}format check failed (expected match: $pattern)${C_RESET}"
      printf "  Use this value anyway? [y/N]: "
      local confirm=""
      read -r confirm
      if [[ "$confirm" =~ ^[Yy]$ ]]; then
        break
      fi
      value=""
      continue
    fi
    break
  done

  # Write the value to a chmod-600 tempfile and feed to vercel env add via
  # stdin. Value never appears as a process arg or in shell history.
  local payload
  payload=$(mktemp "${TMPDIR:-/tmp}/rotate-key.XXXXXX")
  TMP_FILES+=("$payload")
  chmod 600 "$payload"
  printf '%s' "$value" > "$payload"

  # Remove existing var. -y auto-confirms; ignore errors since the var may
  # not exist yet -- that just means it was never set, which is fine.
  vercel env rm "$key" production -y >/dev/null 2>&1 || true

  if vercel env add "$key" production < "$payload" >/dev/null 2>&1; then
    echo "  ${C_GREEN}OK updated on Vercel${C_RESET}"
  else
    echo "  ${C_RED}FAIL vercel env add for $key${C_RESET}" >&2
    unset value
    return 1
  fi

  if update_env_local "$key" "$value"; then
    echo "  ${C_GREEN}OK .env.local updated${C_RESET}"
  else
    echo "  ${C_RED}FAIL .env.local update${C_RESET}" >&2
    unset value
    return 1
  fi

  unset value
  return 0
}

# ─── Args ─────────────────────────────────────────────────────────────
GROUP=""
while [ $# -gt 0 ]; do
  case "$1" in
    --group)
      GROUP="${2:-}"
      shift 2 || true
      ;;
    --group=*)
      GROUP="${1#--group=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$GROUP" ]; then
  usage
  exit 0
fi

# Validate group number.
if ! get_group_label "$GROUP" >/dev/null 2>&1; then
  echo "${C_RED}error:${C_RESET} unknown group '$GROUP' (valid: 1, 2, 3, 4)" >&2
  exit 1
fi

# ─── Pre-flight ───────────────────────────────────────────────────────
if ! command -v vercel >/dev/null 2>&1; then
  echo "${C_RED}fatal:${C_RESET} vercel CLI not found. Install: npm i -g vercel" >&2
  exit 2
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "${C_RED}fatal:${C_RESET} $ENV_FILE not found" >&2
  exit 2
fi

VERCEL_TOKEN_FROM_FILE=$(grep -E '^VERCEL_TOKEN=' "$ENV_FILE" | head -n 1 | cut -d= -f2- | tr -d '"' || true)
if [ -z "$VERCEL_TOKEN_FROM_FILE" ]; then
  echo "${C_RED}fatal:${C_RESET} VERCEL_TOKEN missing from .env.local -- needed for vercel CLI auth" >&2
  exit 2
fi
export VERCEL_TOKEN="$VERCEL_TOKEN_FROM_FILE"
unset VERCEL_TOKEN_FROM_FILE

cd "$PROJECT_DIR"

# ─── Run the group ────────────────────────────────────────────────────
echo "${C_BOLD}$(get_group_label "$GROUP")${C_RESET}"
echo "${C_DIM}Each prompt accepts hidden input. Values never echo.${C_RESET}"
echo ""

while IFS='|' read -r key provider dashboard pattern; do
  [ -z "${key:-}" ] && continue
  if ! rotate_one "$key" "$provider" "$dashboard" "$pattern"; then
    echo ""
    echo "${C_RED}rotation failed for $key -- fix and re-run${C_RESET}" >&2
    exit 3
  fi
done < <(get_group_keys "$GROUP")

echo ""
echo "${C_GREEN}${C_BOLD}group $GROUP complete.${C_RESET}"
echo ""
echo "${C_BOLD}verify:${C_RESET} $(get_group_verify "$GROUP")"
echo ""

printf "Redeploy production now? [y/N]: "
read -r redeploy
if [[ "$redeploy" =~ ^[Yy]$ ]]; then
  echo "Redeploying..."
  vercel --prod --yes
else
  echo "Skipped. Run manually when ready: ${C_BOLD}vercel --prod --yes${C_RESET}"
fi
