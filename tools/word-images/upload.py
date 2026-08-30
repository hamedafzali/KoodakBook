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
  ADMIN_API    base URL of the backend (default http://192.168.178.37:4000)
  ADMIN_TOKEN_FILE  path to a file containing an admin JWT and nothing else.
                    Preferred over ADMIN_TOKEN so the token never lands in
                    your shell history or process list. Mint one yourself:

                      read -rs -p 'admin password: ' PW; echo
                      curl -s -X POST "$ADMIN_API/api/auth/login" \
                        -H 'Content-Type: application/json' \
                        -d "{\"email\":\"you@example.com\",\"password\":\"$PW\"}" \
                        | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"]["token"])' \
                        > ~/.koodakbook-admin-token
                      chmod 600 ~/.koodakbook-admin-token; unset PW

  ADMIN_TOKEN       the JWT inline. Works, but prefer the file.
  IMAGE_DIR         directory of <word_id>.png files (default ./batch)

Usage:
  ADMIN_TOKEN_FILE=~/.koodakbook-admin-token python3 upload.py
  python3 upload.py --dry-run          # no token needed, lists what would go
"""
import mimetypes
import os
import re
import sys
import urllib.error
import urllib.request
import uuid

ADMIN_API = os.environ.get("ADMIN_API", "http://192.168.178.37:4000").rstrip("/")

# A malformed <word_id>.png filename (e.g. a macOS AppleDouble "._foo.png"
# sidecar, whose "word_id" comes out as "_foo") isn't a valid uuid and used to
# crash the backend on the resulting Postgres cast error instead of getting a
# clean 400 — skip these client-side rather than relying on the server.
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)


def _read_token() -> str:
    """Token from a file if one is named, else the inline env var.

    The file route keeps the JWT out of shell history and out of `ps` output,
    which matters because this token can publish to a children's app.
    """
    token_file = os.environ.get("ADMIN_TOKEN_FILE", "")
    if token_file:
        with open(os.path.expanduser(token_file), encoding="utf-8") as f:
            return f.read().strip()
    return os.environ.get("ADMIN_TOKEN", "").strip()


ADMIN_TOKEN = _read_token()
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
    # words leave behind are inputs, not deliverables. AppleDouble sidecars
    # ("._foo.png", created by macOS when copying to non-HFS volumes/network
    # shares) and any other non-uuid-named file are dropped here rather than
    # POSTed and left for the server to reject.
    files = sorted(
        f for f in os.listdir(IMAGE_DIR)
        if f.endswith(".png") and not f.endswith(".sticker.png") and not f.startswith(".")
    )
    skipped = [f for f in files if not UUID_RE.match(f[:-4])]
    if skipped:
        print(f"skipping {len(skipped)} file(s) with a non-uuid name: {', '.join(skipped)}", file=sys.stderr)
    files = [f for f in files if f not in skipped]
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
