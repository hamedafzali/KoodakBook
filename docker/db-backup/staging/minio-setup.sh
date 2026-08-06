#!/bin/sh
# Provision the staging bucket + least-privilege accounts in MinIO.
# Retries until MinIO answers, so no separate healthcheck is needed.
set -eu

echo "[minio-setup] waiting for MinIO…"
for i in $(seq 1 40); do
  if mc alias set local http://minio:9000 minioadmin minioadmin >/dev/null 2>&1; then break; fi
  sleep 1
done
mc ready local >/dev/null 2>&1 || true

echo "[minio-setup] creating bucket + object-lock-style protection"
mc mb --ignore-existing local/koodakbook-backups

# Writer policy: put/get/list, but DELETE IS DENIED — mirrors the R2 write token
# that cannot erase history (deletion is left to lifecycle rules only).
cat >/tmp/writer.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:PutObject","s3:GetObject","s3:ListBucket","s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::koodakbook-backups","arn:aws:s3:::koodakbook-backups/*"] },
    { "Effect": "Deny",
      "Action": ["s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::koodakbook-backups/*"] }
  ]
}
JSON

cat >/tmp/reader.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:GetObject","s3:ListBucket","s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::koodakbook-backups","arn:aws:s3:::koodakbook-backups/*"] }
  ]
}
JSON

mc admin user add local backupwriter backupwriterpw
mc admin user add local backupreader backupreaderpw
mc admin policy create local backupwriter /tmp/writer.json
mc admin policy create local backupreader /tmp/reader.json
mc admin policy attach local backupwriter --user backupwriter
mc admin policy attach local backupreader --user backupreader

echo "[minio-setup] done"
