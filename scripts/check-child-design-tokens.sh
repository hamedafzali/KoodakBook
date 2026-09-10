#!/usr/bin/env bash
# ADVISORY ONLY — this script never fails the build.
#
# History: the 2026-09 "visual UX pass" added this as a hard gate that failed
# CI on any raw Tailwind radius/shadow utility under the child app, to lock in
# that pass's "one neutral + one hue, no gradients, no loose shadows" rules.
#
# Those rules are SUPERSEDED by DESIGN_CHARTER.md (2026-09, design-recovery):
# this is a children's app and colour, illustration, gradient and playfulness
# are the product. The child screens are deliberately being taken back toward
# the "Expression layer v2" design (8ace58f / f94794e). A gate that blocks
# gradients and free-form shadows now works against the product, so it has been
# demoted to a non-blocking heads-up. It still prints what it finds — a loose
# `shadow-md` is often still worth turning into `shadow-card` for consistency —
# but it always exits 0.
set -uo pipefail
cd "$(dirname "$0")/.."

TARGET="apps/web/src/app/child"

if [ ! -d "$TARGET" ]; then
  echo "check-child-design-tokens: $TARGET not found, skipping"
  exit 0
fi

hits=$(grep -rnE 'rounded-md|rounded-lg|rounded-\[1\.5rem\]|shadow-sm|shadow-md|shadow-lg' "$TARGET" --include="*.tsx" \
  | grep -vE 'drop-shadow-(sm|md|lg)' \
  || true)

if [ -n "$hits" ]; then
  echo "ℹ non-token radius/shadow classes under $TARGET (advisory, not an error):"
  echo "$hits"
  echo ""
  echo "If it's incidental drift, the kit tokens are still the tidy choice:"
  echo "  rounded-md/lg/[1.5rem] → rounded-xl / rounded-2xl / rounded-3xl / rounded-full"
  echo "  shadow-sm/md/lg        → shadow-card / shadow-raised"
  echo "Deliberate use (gradients, playful elevation, scene cards) is fine — see DESIGN_CHARTER.md."
else
  echo "✓ apps/web/src/app/child radius/shadow classes all map to kit tokens"
fi

exit 0
