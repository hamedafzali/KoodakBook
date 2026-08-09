#!/usr/bin/env bash
# db-backup entrypoint — one image, several roles (approved plan §3).
#
#   (no args) | scheduler   run supercronic on the crontab (the default service)
#   backup [--label X]       run the backup job once (scheduled or on-demand)
#   verify-offsite           run the WEEKLY keyless verification once (no key)
#   restore-drill            run the QUARTERLY manual decrypt→restore (off-server key)
#   sh|bash|<other>          exec through, for debugging
set -Eeuo pipefail
HERE="$(dirname "$0")"
# shellcheck source=lib.sh
. "${HERE}/lib.sh"   # for heartbeat_preflight (+ log/die); harmless to source early

role="${1:-scheduler}"
case "$role" in
  scheduler)
    heartbeat_preflight scheduler          # fails closed if the dead-man's switch is off
    exec supercronic -passthrough-logs "${HERE}/crontab"
    ;;
  backup)
    heartbeat_preflight backup
    shift; exec "${HERE}/backup.sh" "$@"
    ;;
  verify-offsite)
    heartbeat_preflight verify-offsite
    shift; exec "${HERE}/verify-offsite.sh" "$@"
    ;;
  restore-drill)
    heartbeat_preflight restore-drill
    shift; exec "${HERE}/restore-drill.sh" "$@"
    ;;
  *)
    exec "$@"                               # debug passthrough (sh/bash/…) — no preflight
    ;;
esac
