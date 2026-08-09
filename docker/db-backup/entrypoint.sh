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

case "${1:-scheduler}" in
  scheduler)
    exec supercronic -passthrough-logs "${HERE}/crontab"
    ;;
  backup)
    shift; exec "${HERE}/backup.sh" "$@"
    ;;
  verify-offsite)
    shift; exec "${HERE}/verify-offsite.sh" "$@"
    ;;
  restore-drill)
    shift; exec "${HERE}/restore-drill.sh" "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
