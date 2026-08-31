#!/usr/bin/env python3
"""
Generate one cover illustration per story via OpenAI's Images API (gpt-image-2),
driven by briefs.json. Mirrors tools/word-images/generate_hosted.py's approach
and lessons, adapted from "one centered object" to "one wide storybook scene":

  - no audience/intent language in the prompt (e.g. "for a child", "warm and
    friendly for kids") — that gets read as a literal scene cue toward human/
    child portraits rather than an instruction about who the image is for.
  - no meta-commentary about how this image relates to other images in the
    batch — only describe the single scene.
  - concrete subjects (named characters, actions, setting), not abstract
    description.
  - English-only prompt text.
  - Persian visual context (clothing, architecture, landscape, patterns)
    included in the brief itself for stories with human characters or built
    settings, per-story judgment rather than applied uniformly — animal-only
    fables don't need it.

Config (all via env vars):
  OPENAI_API_KEY_FILE  path to a file containing the key and nothing else
  OPENAI_API_KEY        the key inline
  MODEL                 default: gpt-image-2
  QUALITY                low | medium | high (default: medium)
  SIZE                   default: 1536x1024 (landscape — cheaper AND better
                          suited to a book cover than 1024x1024 square, per
                          OpenAI's tile-based output pricing)
  BRIEFS_JSON            default: briefs.json
  OUTPUT_DIR             default: ./output

Usage:
  OPENAI_API_KEY_FILE=../word-images/.secrets/openai_api_key python3 generate.py
"""
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
import base64

HERE = os.path.dirname(os.path.abspath(__file__))


def _read_key() -> str:
    key_file = os.environ.get("OPENAI_API_KEY_FILE", "")
    if key_file:
        with open(os.path.expanduser(key_file), encoding="utf-8") as f:
            return f.read().strip()
    return os.environ.get("OPENAI_API_KEY", "").strip()


API_KEY = _read_key()
MODEL = os.environ.get("MODEL", "gpt-image-2")
QUALITY = os.environ.get("QUALITY", "medium")
SIZE = os.environ.get("SIZE", "1536x1024")
BRIEFS_JSON = os.environ.get("BRIEFS_JSON", os.path.join(HERE, "briefs.json"))
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", os.path.join(HERE, "output"))
MAX_ATTEMPTS = int(os.environ.get("MAX_ATTEMPTS", "3"))

STYLE_PREFIX = (
    "a children's storybook cover illustration, flat-color cartoon style "
    "with bold clean outlines and warm colors, a single wide scene with "
    "clear foreground subjects and a simple background, no text, no "
    "letters, no title, no logos, no watermark, not photorealistic, not "
    "abstract, not a collage or grid of panels"
)

# Third-party-aggregated per-image cost figures for gpt-image-2 (OpenAI's own
# pricing is token-based; this is the commonly-quoted flat-rate equivalent,
# checked 2026-08-31). Non-square is cheaper than square at every tier.
COST_PER_IMAGE = {
    ("low", "1024x1024"): 0.006, ("low", "1024x1536"): 0.005, ("low", "1536x1024"): 0.005,
    ("medium", "1024x1024"): 0.053, ("medium", "1024x1536"): 0.041, ("medium", "1536x1024"): 0.041,
    ("high", "1024x1024"): 0.211, ("high", "1024x1536"): 0.165, ("high", "1536x1024"): 0.165,
}


def build_prompt(brief: dict) -> str:
    parts = [STYLE_PREFIX, brief["subject"]]
    if brief.get("background"):
        parts.append(brief["background"])
    return ", ".join(parts)


def generate_image(prompt: str) -> tuple:
    payload = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "size": SIZE,
        "quality": QUALITY,
        "n": 1,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    b64 = result["data"][0]["b64_json"]
    return base64.b64decode(b64), result


def main():
    if not API_KEY:
        sys.exit("No API key found. Set OPENAI_API_KEY_FILE (preferred) or OPENAI_API_KEY.")

    with open(BRIEFS_JSON, "r", encoding="utf-8") as f:
        stories = json.load(f)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    manifest_path = os.path.join(OUTPUT_DIR, "manifest.csv")
    manifest_exists = os.path.exists(manifest_path)
    manifest_f = open(manifest_path, "a", newline="", encoding="utf-8")
    manifest_w = csv.writer(manifest_f)
    if not manifest_exists:
        manifest_w.writerow(["story_id", "title_persian", "title_english", "prompt", "revised_prompt", "model", "quality", "size", "est_cost_usd", "generation_seconds", "output_file"])

    responses_dir = os.path.join(OUTPUT_DIR, "_api_responses")
    os.makedirs(responses_dir, exist_ok=True)

    print(f"OpenAI Images API  model: {MODEL}  quality: {QUALITY}  size: {SIZE}")
    print(f"Stories: {len(stories)}  output dir: {OUTPUT_DIR}")

    running_cost = 0.0
    for i, story in enumerate(stories, 1):
        story_id = story["id"]
        dest_path = os.path.join(OUTPUT_DIR, f"{story_id}.png")
        if os.path.exists(dest_path):
            print(f"[{i}/{len(stories)}] {story['title_english']:<24} skip (already generated)")
            continue

        positive = build_prompt(story)

        print(f"[{i}/{len(stories)}] {story['title_english']:<24} generating...", flush=True)
        t0 = time.time()
        last_error = None
        raw = None
        api_response = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                raw, api_response = generate_image(positive)
                last_error = None
                break
            except urllib.error.HTTPError as e:
                last_error = f"HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:300]}"
            except Exception as e:
                last_error = str(e)
            if attempt < MAX_ATTEMPTS:
                print(f"    attempt {attempt} failed ({last_error}); retrying...", flush=True)
                time.sleep(5)

        if last_error is not None:
            print(f"[{i}/{len(stories)}] {story['title_english']:<24} FAILED: {last_error}", file=sys.stderr)
            manifest_w.writerow([story_id, story["title_persian"], story["title_english"], positive, "", MODEL, QUALITY, SIZE, "", "", "ERROR"])
            manifest_f.flush()
            continue

        response_for_log = json.loads(json.dumps(api_response))
        for item in response_for_log.get("data", []):
            item.pop("b64_json", None)
        with open(os.path.join(responses_dir, f"{story_id}.json"), "w", encoding="utf-8") as f:
            json.dump(response_for_log, f, ensure_ascii=False, indent=2)
        revised_prompt = (api_response.get("data") or [{}])[0].get("revised_prompt", "")

        with open(dest_path, "wb") as f:
            f.write(raw)

        elapsed = time.time() - t0
        cost = COST_PER_IMAGE.get((QUALITY, SIZE), 0.0)
        running_cost += cost
        print(f"[{i}/{len(stories)}] {story['title_english']:<24} done in {elapsed:.0f}s (~${cost:.3f}) -> {dest_path}")
        manifest_w.writerow([story_id, story["title_persian"], story["title_english"], positive, revised_prompt, MODEL, QUALITY, SIZE, f"{cost:.3f}", f"{elapsed:.1f}", os.path.basename(dest_path)])
        manifest_f.flush()

    manifest_f.close()
    print(f"Done. Estimated total cost: ${running_cost:.2f}")


if __name__ == "__main__":
    main()
