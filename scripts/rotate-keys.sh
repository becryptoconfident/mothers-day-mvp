#!/usr/bin/env bash
# Rotate sensitive production keys on Vercel.
# Run after rotating each key in its provider dashboard.
# Prompts for the new value, pushes to Vercel production env, then redeploys.
#
# Usage: bash scripts/rotate-keys.sh
# Or:    ./scripts/rotate-keys.sh   (after chmod +x)
#
# Reads VERCEL_TOKEN from .env.local. If your local .env.local is also
# stale (e.g., you rotated a key but didn't update the file), update it
# manually after this script runs so local dev keeps working.

set -u

ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env.local"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ENV_FILE" ]; then
  echo "FATAL: .env.local not found at $ENV_FILE" >&2
  exit 2
fi

TOKEN=$(grep -E '^VERCEL_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
if [ -z "${TOKEN:-}" ]; then
  echo "FATAL: VERCEL_TOKEN missing from .env.local" >&2
  exit 2
fi
export VERCEL_TOKEN="$TOKEN"

cd "$PROJECT_DIR"

# Keys to rotate. Format: VAR_NAME|Provider|Where to get a new one
KEYS=(
  "STRIPE_SECRET_KEY|Stripe|https://dashboard.stripe.com/apikeys (Reveal live secret key)"
  "STRIPE_WEBHOOK_SECRET|Stripe|https://dashboard.stripe.com/webhooks → endpoint → Signing secret"
  "SUPABASE_SECRET_KEY|Supabase|https://supabase.com/dashboard → Project → API → Service role key"
  "R2_ACCESS_KEY_ID|Cloudflare R2|https://dash.cloudflare.com → R2 → Manage R2 API Tokens"
  "R2_SECRET_ACCESS_KEY|Cloudflare R2|Same R2 API Tokens page (rotated together with access key)"
  "RESEND_API_KEY|Resend|https://resend.com/api-keys"
  "ANTHROPIC_API_KEY|Anthropic|https://console.anthropic.com/settings/keys"
)

cat <<EOF
Rotating production keys on Vercel.

You'll be prompted for each key's new value. Hit Enter on a blank
line to SKIP that key (leave it as-is).

EOF

# Confirm before proceeding
read -r -p "Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi
echo ""

rotated=0
skipped=0
failed=0

for entry in "${KEYS[@]}"; do
  IFS='|' read -r name provider source <<< "$entry"

  echo "─── $name ($provider)"
  echo "    Get new value from: $source"
  # -s hides the input (sensitive)
  read -r -s -p "    New value (or Enter to skip): " value
  echo ""

  if [ -z "$value" ]; then
    echo "    ↳ skipped"
    skipped=$((skipped + 1))
    continue
  fi

  # Remove existing then add. Errors silenced for the rm step in case
  # the key wasn't already set.
  vercel env rm "$name" production --yes >/dev/null 2>&1 || true
  if printf '%s' "$value" | vercel env add "$name" production >/dev/null 2>&1; then
    echo "    ↳ updated on Vercel"
    rotated=$((rotated + 1))
  else
    echo "    ↳ FAILED — check Vercel CLI auth and try again" >&2
    failed=$((failed + 1))
  fi

  # Clear the variable so it isn't sitting around in shell memory.
  unset value
  echo ""
done

echo "Rotated: $rotated  Skipped: $skipped  Failed: $failed"

if [ "$failed" -gt 0 ]; then
  echo "Aborting redeploy — fix the failures and re-run." >&2
  exit 3
fi

if [ "$rotated" -eq 0 ]; then
  echo "Nothing rotated. Skipping redeploy."
  exit 0
fi

echo ""
read -r -p "Redeploy production now? [y/N] " redeploy
if [[ "$redeploy" =~ ^[Yy]$ ]]; then
  echo "Redeploying..."
  vercel --prod --yes
else
  echo "Skipped. Run 'vercel --prod --yes' manually when ready."
fi

cat <<EOF

Reminder: update your local .env.local with the new values too,
otherwise local dev will break the next time you run \`npm run dev\`.
The script doesn't touch .env.local — Vercel only.
EOF
