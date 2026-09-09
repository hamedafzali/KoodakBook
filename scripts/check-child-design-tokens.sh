#!/usr/bin/env bash
# Guards apps/web/src/app/child/** against re-drift from the child design
# system (docs/design-system.md §4: "no new colors, no new radii, no new
# shadows — compose kit"). Flags raw Tailwind radius/shadow utilities that
# should instead be the kit's token classes:
#   rounded-md / rounded-lg / rounded-[1.5rem]  → rounded-xl/2xl/3xl/full
#   shadow-sm / shadow-md / shadow-lg           → shadow-card / shadow-raised
# (`drop-shadow-*` is a different, unrelated utility — text/icon drop
# shadows, not the card-elevation system — and is intentionally excluded.)
# (2026-09 visual UX audit — added so the contrast/shape cleanup done that
# pass doesn't quietly regress as new screens are added.)
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="apps/web/src/app/child"

if [ ! -d "$TARGET" ]; then
  echo "check-child-design-tokens: $TARGET not found, skipping" >&2
  exit 0
fi

hits=$(grep -rnE 'rounded-md|rounded-lg|rounded-\[1\.5rem\]|shadow-sm|shadow-md|shadow-lg' "$TARGET" --include="*.tsx" \
  | grep -vE 'drop-shadow-(sm|md|lg)' \
  || true)

if [ -n "$hits" ]; then
  echo "✗ Non-token radius/shadow classes found under $TARGET:" >&2
  echo "$hits" >&2
  echo "" >&2
  echo "Use the child design-system tokens instead (see docs/design-system.md):" >&2
  echo "  rounded-md/lg/[1.5rem] → rounded-xl / rounded-2xl / rounded-3xl / rounded-full" >&2
  echo "  shadow-sm/md/lg        → shadow-card (resting) / shadow-raised (one primary action)" >&2
  exit 1
fi

echo "✓ apps/web/src/app/child uses only design-system radius/shadow tokens"
