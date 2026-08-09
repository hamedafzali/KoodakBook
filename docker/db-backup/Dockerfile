# db-backup sidecar — one image, several roles (backup / verify-offsite /
# restore-drill / on-demand).
#
# Base is postgres:16-alpine so pg_dump / pg_restore / psql VERSION-MATCH the
# server (mismatched client majors can refuse). Adds age (encryption), rclone
# (S3-compatible transfer to R2), curl (heartbeat pings) and supercronic (an
# in-container scheduler that logs to stdout and needs no root — we have no host
# cron on the shared server).
FROM postgres:16-alpine

# TARGETARCH is provided by BuildKit (amd64 on the prod host, arm64 on Apple Si).
ARG TARGETARCH
ARG SUPERCRONIC_VERSION=v0.2.33
# Per-arch SHA1 of the pinned supercronic release binary.
ARG SUPERCRONIC_SHA1SUM_amd64=71b0d58cc53f6bd72cf2f293e09e294b79c666d8
ARG SUPERCRONIC_SHA1SUM_arm64=e0f0c06ebc5627e43b25475711e694450489ab00

RUN set -eux; \
    apk add --no-cache bash age rclone curl coreutils tzdata; \
    case "${TARGETARCH}" in \
      amd64) SC_SHA1="${SUPERCRONIC_SHA1SUM_amd64}" ;; \
      arm64) SC_SHA1="${SUPERCRONIC_SHA1SUM_arm64}" ;; \
      *) echo "unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    SC="supercronic-linux-${TARGETARCH}"; \
    curl -fsSL "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/${SC}" -o /usr/local/bin/supercronic; \
    echo "${SC_SHA1}  /usr/local/bin/supercronic" | sha1sum -c -; \
    chmod +x /usr/local/bin/supercronic

# Non-root. Only the staging volume is writable; root fs can be mounted read-only.
RUN adduser -D -H -u 10001 backup
WORKDIR /app
COPY --chmod=0755 lib.sh backup.sh verify-offsite.sh restore-drill.sh entrypoint.sh /app/
COPY crontab /app/crontab
RUN mkdir -p /staging && chown backup:backup /staging /app/crontab
VOLUME ["/staging"]
USER backup

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["scheduler"]
