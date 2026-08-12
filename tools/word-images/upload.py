#!/usr/bin/env python3
"""
Push generated images to the server as review CANDIDATES.

Nothing here publishes anything. Each file is uploaded to
words.image_candidate_url with animation_review='pending'; a human then clears
the queue in the admin panel at /dashboard/word-images, and approving is the
only thing that ever writes words.image_url.

Resumable in the same spirit as the generator: a local .uploaded marker file
records what has already been sent, so re-running only sends new work.

Config:
  ADMIN_API    base URL of the backend (default http://192.168.178.34:4000)
  ADMIN_TOKEN  an admin JWT. Get one with:
                 curl -s -X POST "$ADMIN_API/api/auth/login" \
                   -H 'Content-Type: application/json' \
                   -d '{"email":"...","password":"..."}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["token"])'
  IMAGE_DIR    directory of <word_id>.png files (default ./batch)

Usage:
  ADMIN_TOKEN=... python3 upload.py            # upload everything new
  ADMIN_TOKEN=... python3 upload.py --dry-run
"""
import mimetypes
import os
import sys
import urllib.error
import urllib.request
import uuid

ADMIN_API = os.environ.get("ADMIN_API", "http://192.168.178.34:4000").rstrip("/")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
HERE = os.path.dirname(os.path.abspath(__file__))
IMAGE_DIR = os.environ.get("IMAGE_DIR", os.path.join(HERE, "batch"))
MARKER = os.path.join(IMAGE_DIR, ".uploaded")
DRY_RUN = "--dry-run" in sys.argv


def multipart(file_path: str) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    name = os.path.basename(file_path)
    ctype = mimetypes.guess_type(name)[0] or "image/png"
    with open(file_path, "rb") as f:
        payload = f.read()
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{name}"\r\n'.encode(),
        f"Content-Type: {ctype}\r\n\r\n".encode(),
        payload,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    return body, f"multipart/form-data; boundary={boundary}"


def upload_one(word_id: str, path: str) -> None:
    body, content_type = multipart(path)
    req = urllib.request.Request(
        f"{ADMIN_API}/api/admin/word-images/{word_id}/candidate",
        data=body,
        headers={"Content-Type": content_type, "Authorization": f"Bearer {ADMIN_TOKEN}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        if resp.status not in (200, 201):
            raise RuntimeError(f"HTTP {resp.status}")


def main():
    if not ADMIN_TOKEN and not DRY_RUN:
        sys.exit("ADMIN_TOKEN is required (see the module docstring for how to mint one)")

    done = set()
    if os.path.exists(MARKER):
        with open(MARKER, encoding="utf-8") as f:
            done = {line.strip() for line in f if line.strip()}

    # <word_id>.png only — the .sticker.png intermediates that count-composited
    # words leave behind are inputs, not deliverables.
    files = sorted(
        f for f in os.listdir(IMAGE_DIR)
        if f.endswith(".png") and not f.endswith(".sticker.png")
    )
    todo = [f for f in files if f[:-4] not in done]
    print(f"{len(files)} images, {len(done)} already uploaded, {len(todo)} to send -> {ADMIN_API}")

    ok = 0
    with open(MARKER, "a", encoding="utf-8") as marker:
        for i, name in enumerate(todo, 1):
            word_id = name[:-4]
            path = os.path.join(IMAGE_DIR, name)
            if DRY_RUN:
                print(f"[{i}/{len(todo)}] would upload {word_id}")
                continue
            try:
                upload_one(word_id, path)
            except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError) as e:
                detail = e.read().decode()[:200] if isinstance(e, urllib.error.HTTPError) else e
                print(f"[{i}/{len(todo)}] {word_id} FAILED: {detail}", file=sys.stderr)
                continue
            marker.write(word_id + "\n")
            marker.flush()
            ok += 1
            print(f"[{i}/{len(todo)}] {word_id} uploaded")

    if not DRY_RUN:
        print(f"\n{ok} uploaded as PENDING candidates. Nothing is visible to a child yet.")
        print("Review them at /dashboard/word-images - approving is what publishes.")


if __name__ == "__main__":
    main()
