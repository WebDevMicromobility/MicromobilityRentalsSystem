#!/usr/bin/env bash
# The instant lane: push the site live from this machine in under a minute.
#
# CI is the safety net — every push still runs the full suite and deploys on
# green (~5-6 min). THIS is for the moments that cannot wait for a runner to
# wake up: it builds (1-2s), refuses to ship what git does not have, uploads
# straight to Cloudflare Pages, and prints what it did.
#
# One-time setup, either:
#   npx wrangler login                          # browser sign-in on this machine
# or put the two values in .env.deploy (gitignored, chmod 600):
#   CLOUDFLARE_API_TOKEN=...                    # a Pages:Edit token
#   CLOUDFLARE_ACCOUNT_ID=...
#
# Flags: --dirty  ship despite uncommitted changes (the guard exists because a
#                 live site running code that is in no commit is undebuggable).
set -euo pipefail
cd "$(dirname "$0")/.."
t0=$(date +%s)

[ -f .env.deploy ] && set -a && . ./.env.deploy && set +a

if [ "${1:-}" != "--dirty" ] && ! git diff --quiet HEAD -- . ':!dist'; then
  echo "✗ uncommitted changes — commit first, or run with --dirty" >&2
  git status --short | head -5 >&2
  exit 1
fi

npm run build:html --silent
# the same stale guard CI runs: what we upload must match what git holds
git diff --quiet -- index.html service-worker.js || {
  [ "${1:-}" = "--dirty" ] || { echo "✗ build changed index.html — commit it (or --dirty)" >&2; exit 1; }
}
node scripts/assemble-dist.mjs >/dev/null

npx --yes wrangler@4.128.0 pages deploy dist \
  --project-name=micromobilityrentals --branch=main --commit-dirty=true

echo "── live in $(( $(date +%s) - t0 ))s · $(git rev-parse --short HEAD)$(git diff --quiet HEAD -- . ':!dist' || echo ' +dirty') ──"
