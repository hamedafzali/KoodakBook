#!/usr/bin/env bash
# Export the word list from prod as JSON, ready for build-briefs.py.
#
# Reads through the DB container's local socket (trust auth) so no app password
# is needed anywhere in this pipeline — same pattern the backup docs use.
#
#   ./export-words.sh > words.json                  # everything
#   CATEGORIES="food,animals" ./export-words.sh     # a subset
#   ONLY_MISSING=1 ./export-words.sh                # skip words that already have art
set -Eeuo pipefail

SERVER="${SERVER:-hamed@192.168.178.37}"
DB_CONTAINER="${DB_CONTAINER:-koodakbook-db-1}"

where="where true"
if [[ -n "${CATEGORIES:-}" ]]; then
  list=$(printf "'%s'," ${CATEGORIES//,/ } | sed 's/,$//')
  where="$where and category in ($list)"
fi
[[ "${ONLY_MISSING:-0}" == "1" ]] && where="$where and image_url is null"

sql="select coalesce(json_agg(row_to_json(w) order by w.category, w.english), '[]'::json)
       from (select id, persian, english, category from words $where) w;"

ssh "$SERVER" "docker exec -u postgres $DB_CONTAINER psql -U koodakbook -d koodakbook -tAc \"$sql\""
