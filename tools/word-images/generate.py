#!/usr/bin/env python3
"""
Generate one illustration per word via a ComfyUI HTTP API (SDXL), driven by
each word's image_brief. Resumable: skips any word whose output file already
exists. No app-specific dependencies — stdlib only.

Config (all via env vars, nothing machine-specific hardcoded):
  COMFYUI_URL   base URL of the ComfyUI server, e.g. http://192.168.178.34:8188
  CKPT_NAME     checkpoint filename as ComfyUI sees it (default: sdxl.safetensors)
  WORDS_JSON    path to the word-list JSON (default: pilot-words.json next to this script)
  OUTPUT_DIR    where finished PNGs + manifest.csv go (default: ./output next to this script)
  STEPS         KSampler steps (default: 25)
  WIDTH/HEIGHT  image size (default: 1024x1024)
  CFG           classifier-free guidance scale (default: 7.0)
  SAMPLER       KSampler sampler_name (default: euler)
  SCHEDULER     KSampler scheduler (default: karras)
  SEED          fixed seed for all images, for style consistency (default: 42)

Usage:
  COMFYUI_URL=http://192.168.178.34:8188 python3 generate.py
"""
import csv
import json
import os
import sys
import time
import urllib.request
import urllib.parse

COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
CKPT_NAME = os.environ.get("CKPT_NAME", "sdxl.safetensors")
HERE = os.path.dirname(os.path.abspath(__file__))
WORDS_JSON = os.environ.get("WORDS_JSON", os.path.join(HERE, "pilot-words.json"))
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", os.path.join(HERE, "output"))
STEPS = int(os.environ.get("STEPS", "25"))
WIDTH = int(os.environ.get("WIDTH", "1024"))
HEIGHT = int(os.environ.get("HEIGHT", "1024"))
CFG = float(os.environ.get("CFG", "7.0"))
SAMPLER = os.environ.get("SAMPLER", "euler")
SCHEDULER = os.environ.get("SCHEDULER", "karras")
SEED = int(os.environ.get("SEED", "42"))
MAX_ATTEMPTS = int(os.environ.get("MAX_ATTEMPTS", "3"))

# One consistent illustration style applied to every word — this is the single
# knob that keeps all 295 images visually coherent (per product requirement:
# style consistency is pedagogy, not polish, for this age group).
#
# History: round 1 (flat-vector cartoon language, generic negatives) rendered
# cat/dog cleanly but let bread/red drift into decorative abstraction — SDXL
# filling in an underspecified or unfamiliar subject with "interesting"
# geometry instead of a literal object. Round 2 tried rewording the whole
# prefix toward "picture-book illustration" and overcorrected into a
# pencil-sketch storybook genre (lost flat colors, added an unrequested child
# character). Round 3 (this one) keeps the flat-vector-cartoon base that
# already worked, states explicitly what the image must BE and must NOT be,
# and — separately — fixes the two ambiguous per-word briefs (bread, red) so
# there is nothing left for the model to improvise. Style prefix/negatives
# fix style drift; naming a concrete referent fixes subject ambiguity. They
# are not substitutes for each other.
STYLE_PREFIX = (
    "IS: one single plainly recognizable subject that a 4-year-old could name "
    "instantly at a glance, drawn as a simple flat-color cartoon illustration "
    "for a children's educational app; bold thick black outlines; flat solid "
    "pastel colors with minimal shading; the subject centered and filling "
    "most of the frame; a plain simple background with nothing else in it; "
    "literal and straightforward, not artistic; warm and friendly; the exact "
    "same flat-vector cartoon style as every other image in this set. "
    "IS NOT: not abstract, not cubist, not fragmented, not a mosaic or "
    "collage, not a decorative or symbolic composition, not a sketch or "
    "pencil drawing, not photorealistic, no text or letters, no unrequested "
    "extra objects or characters beyond what is described"
)

NEGATIVE_BASE = (
    "abstract, abstract art, cubism, cubist, geometric, fragmented, "
    "fragmented shapes, mosaic, collage, tiling pattern, kaleidoscope, "
    "symmetric decorative pattern, repeating pattern, concentric shapes, "
    "line art maze, multiple small copies of the subject, surreal, "
    "surrealism, artistic interpretation, modern art, fine art, gallery art, "
    "symbolic representation, metaphorical imagery, abstract concept art, "
    "over-stylized, distorted, ambiguous composition, confusing composition, "
    "decorative border, ornamental pattern, "
    "pencil sketch, ink sketch, line drawing, hand-drawn sketch linework, "
    "watercolor, sepia, monochrome, black and white, crosshatching, "
    "unrequested extra characters, extra people, extra animals, "
    "random unrelated objects in the scene, cluttered scene, busy "
    "composition, multiple unrelated subjects, "
    "photo, photorealistic, realistic, 3d render, text, watermark, "
    "signature, letters, words, writing, blurry, low quality, extra limbs, "
    "disfigured, deformed, scary, violent, weapon, blood, gore, nudity, "
    "frame, border, cluttered background, jpeg artifacts, dark, grim"
)


def build_prompt(brief: dict) -> str:
    parts = [STYLE_PREFIX, brief["subject"]]
    if brief.get("composition"):
        parts.append(brief["composition"])
    if brief.get("background"):
        parts.append(brief["background"])
    if brief.get("cultural_notes"):
        parts.append(brief["cultural_notes"])
    return ", ".join(parts)


def build_negative(brief: dict) -> str:
    avoid = brief.get("avoid") or []
    if avoid:
        return NEGATIVE_BASE + ", " + ", ".join(avoid)
    return NEGATIVE_BASE


def build_workflow(positive: str, negative: str, filename_prefix: str) -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT_NAME}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": WIDTH, "height": HEIGHT, "batch_size": 1}},
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "seed": SEED,
                "steps": STEPS,
                "cfg": CFG,
                "sampler_name": SAMPLER,
                "scheduler": SCHEDULER,
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
                "denoise": 1.0,
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": filename_prefix}},
    }


def http_post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def server_healthy() -> bool:
    try:
        http_get_json(f"{COMFYUI_URL}/system_stats")
        return True
    except Exception:
        return False


def wait_for_server(max_wait_s: int = 1800) -> bool:
    """Block until ComfyUI answers again.

    An overnight batch outlives any single crash of the GPU process, so a dead
    server is something to wait out, not a reason to fail 263 words in ten
    seconds. Polls quietly and gives up only if it stays down for a long time.
    """
    waited = 0
    while waited < max_wait_s:
        if server_healthy():
            return True
        time.sleep(30)
        waited += 30
        if waited % 300 == 0:
            print(f"    ...ComfyUI still unreachable after {waited // 60} min", flush=True)
    return False


def queue_prompt(workflow: dict) -> str:
    result = http_post_json(f"{COMFYUI_URL}/prompt", {"prompt": workflow})
    if "prompt_id" not in result:
        raise RuntimeError(f"unexpected /prompt response: {result}")
    return result["prompt_id"]


def wait_for_result(prompt_id: str, timeout_s: int = 600) -> dict:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        history = http_get_json(f"{COMFYUI_URL}/history/{prompt_id}")
        if prompt_id in history:
            entry = history[prompt_id]
            status = entry.get("status", {})
            if status.get("completed") or status.get("status_str") == "success":
                return entry
            if status.get("status_str") == "error":
                raise RuntimeError(f"ComfyUI reported an error for {prompt_id}: {status}")
        time.sleep(3)
    raise TimeoutError(f"prompt {prompt_id} did not finish within {timeout_s}s")


def download_output(entry: dict, dest_path: str) -> None:
    outputs = entry.get("outputs", {})
    node_out = outputs.get("7", {})
    images = node_out.get("images", [])
    if not images:
        raise RuntimeError(f"no images in SaveImage output: {outputs}")
    img = images[0]
    qs = urllib.parse.urlencode({
        "filename": img["filename"],
        "subfolder": img.get("subfolder", ""),
        "type": img.get("type", "output"),
    })
    url = f"{COMFYUI_URL}/view?{qs}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = resp.read()
    with open(dest_path, "wb") as f:
        f.write(data)


def main():
    with open(WORDS_JSON, "r", encoding="utf-8") as f:
        words = json.load(f)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    manifest_path = os.path.join(OUTPUT_DIR, "manifest.csv")
    manifest_exists = os.path.exists(manifest_path)
    manifest_f = open(manifest_path, "a", newline="", encoding="utf-8")
    manifest_w = csv.writer(manifest_f)
    if not manifest_exists:
        manifest_w.writerow(["word_id", "persian", "english", "category", "prompt", "negative", "seed", "steps", "generation_seconds", "output_file"])

    print(f"ComfyUI: {COMFYUI_URL}  checkpoint: {CKPT_NAME}  steps: {STEPS}  size: {WIDTH}x{HEIGHT}")
    print(f"Words: {len(words)}  output dir: {OUTPUT_DIR}")

    if not server_healthy():
        sys.exit(f"ComfyUI is not answering at {COMFYUI_URL} - start it before launching the batch.")

    for i, word in enumerate(words, 1):
        word_id = word["id"]
        dest_path = os.path.join(OUTPUT_DIR, f"{word_id}.png")
        if os.path.exists(dest_path):
            print(f"[{i}/{len(words)}] {word['english']:<10} skip (already generated)")
            continue

        brief = word["image_brief"]

        if brief.get("render_mode") == "count":
            sticker_brief = {
                "subject": brief["count_object_subject"],
                "composition": "one single object only, centered, filling most of the frame",
                "background": "plain solid white background, nothing else in the scene",
                "avoid": (brief.get("avoid") or []) + [
                    "more than one object", "numerals", "text", "numbers",
                ],
            }
            positive = build_prompt(sticker_brief)
            negative = build_negative(sticker_brief)
        else:
            positive = build_prompt(brief)
            negative = build_negative(brief)
        workflow = build_workflow(positive, negative, filename_prefix=word_id)

        print(f"[{i}/{len(words)}] {word['english']:<10} generating...", flush=True)
        t0 = time.time()
        # Retry per word. A crashed ComfyUI is the expected interruption on an
        # overnight run, and without this the queue drains in seconds: every
        # remaining word fails instantly on "connection refused" and the whole
        # batch is burned by one restart.
        last_error = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                prompt_id = queue_prompt(workflow)
                entry = wait_for_result(prompt_id)
                if brief.get("render_mode") == "count":
                    sticker_path = os.path.join(OUTPUT_DIR, f"{word_id}.sticker.png")
                    download_output(entry, sticker_path)
                    from compose import cutout_sticker, compose_count_image
                    sticker = cutout_sticker(sticker_path)
                    compose_count_image(
                        sticker=sticker,
                        count=brief["count"],
                        background_hex=brief["background_hex"],
                        numeral_text=brief["numeral_text"],
                        numeral_fill_hex=brief["numeral_fill_hex"],
                        numeral_outline_hex=brief["numeral_outline_hex"],
                        out_path=dest_path,
                    )
                else:
                    download_output(entry, dest_path)
                last_error = None
                break
            except Exception as e:
                last_error = e
                if attempt == MAX_ATTEMPTS:
                    break
                print(f"    attempt {attempt} failed ({e}); waiting for ComfyUI...", flush=True)
                if not wait_for_server():
                    sys.exit("ComfyUI has been unreachable for 30 minutes - stopping so the "
                             "remaining words stay unattempted and a re-run picks them up.")
                time.sleep(5)

        if last_error is not None:
            print(f"[{i}/{len(words)}] {word['english']:<10} FAILED: {last_error}", file=sys.stderr)
            manifest_w.writerow([word_id, word["persian"], word["english"], word["category"], positive, negative, SEED, STEPS, "", "ERROR"])
            manifest_f.flush()
            continue

        elapsed = time.time() - t0
        print(f"[{i}/{len(words)}] {word['english']:<10} done in {elapsed:.0f}s -> {dest_path}")
        manifest_w.writerow([word_id, word["persian"], word["english"], word["category"], positive, negative, SEED, STEPS, f"{elapsed:.1f}", os.path.basename(dest_path)])
        manifest_f.flush()

    manifest_f.close()
    print("Done.")


if __name__ == "__main__":
    main()
