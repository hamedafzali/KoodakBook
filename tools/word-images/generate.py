#!/usr/bin/env python3
"""
Generate one illustration per word via a ComfyUI HTTP API (SDXL), driven by
each word's image_brief. Resumable: skips any word whose output file already
exists. No app-specific dependencies — stdlib only.

Config (all via env vars, nothing machine-specific hardcoded):
  COMFYUI_URL   base URL of the ComfyUI server, e.g. http://192.168.178.37:8188
  CKPT_NAME     checkpoint filename as ComfyUI sees it (default: sdxl.safetensors)
  WORDS_JSON    path to the word-list JSON (default: pilot-words.json next to this script)
  OUTPUT_DIR    where finished PNGs + manifest.csv go (default: ./output next to this script)
  STEPS         KSampler steps (default: 25)
  WIDTH/HEIGHT  image size (default: 1024x1024)
  CFG           classifier-free guidance scale (default: 7.0)
  SAMPLER       KSampler sampler_name (default: euler)
  SCHEDULER     KSampler scheduler (default: karras)
  SEED          if set, forces this one seed for every word (legacy behavior);
                default is a distinct, reproducible seed derived per word
  LORA_NAME     optional LoRA filename (as ComfyUI sees it) layered on CKPT_NAME
  LORA_STRENGTH LoRA strength_model/strength_clip (default: 0.8)
  LORA_TRIGGER  optional trigger word/phrase prepended to every prompt

Usage:
  COMFYUI_URL=http://192.168.178.37:8188 python3 generate.py
"""
import csv
import hashlib
import json
import os
import sys
import time
import urllib.request
import urllib.parse

COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
CKPT_NAME = os.environ.get("CKPT_NAME", "sdxl.safetensors")
# Optional LoRA on top of CKPT_NAME, for checkpoint-vs-LoRA diagnostic runs.
# Unset by default so normal production/diagnostic batches are unaffected.
LORA_NAME = os.environ.get("LORA_NAME")
LORA_STRENGTH = float(os.environ.get("LORA_STRENGTH", "0.8"))
LORA_TRIGGER = os.environ.get("LORA_TRIGGER", "")
HERE = os.path.dirname(os.path.abspath(__file__))
WORDS_JSON = os.environ.get("WORDS_JSON", os.path.join(HERE, "pilot-words.json"))
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", os.path.join(HERE, "output"))
STEPS = int(os.environ.get("STEPS", "25"))
WIDTH = int(os.environ.get("WIDTH", "1024"))
HEIGHT = int(os.environ.get("HEIGHT", "1024"))
CFG = float(os.environ.get("CFG", "7.0"))
SAMPLER = os.environ.get("SAMPLER", "euler")
SCHEDULER = os.environ.get("SCHEDULER", "karras")
# A single fixed seed (SEED=42) was used for all 263 words, on the theory
# that a fixed seed is the "style consistency" knob. It isn't - the prompt
# already carries style consistency via STYLE_PREFIX - and a fixed seed means
# every word starts sampling from identical initial noise. For certain short
# or low-information prompts (a bare color word, an ambiguous one-syllable
# noun) that shared noise collapses onto the same decorative-frame/wreath/
# segmented-circle composition regardless of subject; a plain "ant" test
# re-rendered clean the moment the seed changed with the prompt held fixed.
# So the default is now a seed derived per word from its stable id (still
# fully reproducible - same word always gets the same seed on a re-run) with
# SEED as an explicit override for cases that want one fixed seed again
# (e.g. reproducing the old behavior for comparison).
FORCE_SEED = os.environ.get("SEED")
MAX_ATTEMPTS = int(os.environ.get("MAX_ATTEMPTS", "3"))


def seed_for(word_id: str) -> int:
    if FORCE_SEED is not None:
        return int(FORCE_SEED)
    return int(hashlib.sha256(word_id.encode("utf-8")).hexdigest()[:8], 16) % (2**31)

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
# character). Round 3 kept the flat-vector-cartoon base that already worked
# and stated explicitly what the image must BE and must NOT be, but included
# the phrase "the exact same flat-vector cartoon style as every other image
# in this set" — meta-commentary about how this image relates to the REST OF
# THE SET, not a description of this image; fixed by dropping it. Round 4
# still broke on ~75% of a 20-word concrete-noun sample, mostly as unrelated
# human/child portraits, even with the subject placed before this prefix —
# so the failure wasn't ordering. The prime suspect left was "a 4-year-old
# could name instantly at a glance" / "for a children's educational app" /
# "warm and friendly": these describe who the image is FOR, not what it
# shows, and CLIP has no way to separate "image for a child" from "image of
# a child" — the same class of leak as the fixed-character bug, just aimed
# at the audience instead of the process. Round 5 (this one) removes every
# audience/intent/purpose word and keeps only literal visual instructions.
STYLE_PREFIX = (
    "IS: one single object, drawn as a simple flat-color cartoon "
    "illustration; bold thick black outlines; flat solid pastel colors "
    "with minimal shading; the object centered and filling most of the "
    "frame; a plain simple background with nothing else in it; literal "
    "and straightforward. "
    "IS NOT: not abstract, not cubist, not fragmented, not a mosaic or "
    "collage, not a decorative or symbolic composition, not a sketch or "
    "pencil drawing, not photorealistic, no text or letters, no "
    "unrequested extra objects or characters beyond what is described"
)

NEGATIVE_BASE = (
    "abstract, abstract art, cubism, cubist, geometric, fragmented, "
    "fragmented shapes, mosaic, collage, tiling pattern, kaleidoscope, "
    "symmetric decorative pattern, repeating pattern, concentric shapes, "
    "line art maze, multiple small copies of the subject, "
    "character sheet, sticker sheet, expression sheet, reference sheet, "
    "grid of images, contact sheet, comic panels, multiple panels, "
    "collection of icons, set of icons, pattern of many small objects, "
    "wallpaper pattern, seamless pattern, surreal, "
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
    # cultural_notes is documentation for humans reading the brief (why a
    # strategy was chosen, what a reviewer should know) — it is deliberately
    # NOT sent to CLIP. Every instance we found was written as a note to a
    # person ("a plain circle is used because...", "reuses one fixed
    # character so the set reads as...") and the model has no way to tell
    # that apart from a scene description; it just draws whatever the
    # sentence describes, including references to a "set" it isn't given.
    parts = [STYLE_PREFIX, brief["subject"]]
    if LORA_TRIGGER:
        parts.insert(0, LORA_TRIGGER)
    if brief.get("composition"):
        parts.append(brief["composition"])
    if brief.get("background"):
        parts.append(brief["background"])
    return ", ".join(parts)


def build_negative(brief: dict) -> str:
    avoid = brief.get("avoid") or []
    if avoid:
        return NEGATIVE_BASE + ", " + ", ".join(avoid)
    return NEGATIVE_BASE


def build_workflow(positive: str, negative: str, filename_prefix: str, seed: int = None) -> dict:
    if seed is None:
        seed = seed_for(filename_prefix)
    workflow = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT_NAME}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": WIDTH, "height": HEIGHT, "batch_size": 1}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": filename_prefix}},
    }
    model_src, clip_src = ["1", 0], ["1", 1]
    if LORA_NAME:
        workflow["8"] = {
            "class_type": "LoraLoader",
            "inputs": {
                "model": model_src,
                "clip": clip_src,
                "lora_name": LORA_NAME,
                "strength_model": LORA_STRENGTH,
                "strength_clip": LORA_STRENGTH,
            },
        }
        model_src, clip_src = ["8", 0], ["8", 1]
    workflow["2"] = {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": clip_src}}
    workflow["3"] = {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": clip_src}}
    workflow["5"] = {
        "class_type": "KSampler",
        "inputs": {
            "model": model_src,
            "seed": seed,
            "steps": STEPS,
            "cfg": CFG,
            "sampler_name": SAMPLER,
            "scheduler": SCHEDULER,
            "positive": ["2", 0],
            "negative": ["3", 0],
            "latent_image": ["4", 0],
            "denoise": 1.0,
        },
    }
    return workflow


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
        word_seed = seed_for(word_id)
        workflow = build_workflow(positive, negative, filename_prefix=word_id, seed=word_seed)

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
            manifest_w.writerow([word_id, word["persian"], word["english"], word["category"], positive, negative, word_seed, STEPS, "", "ERROR"])
            manifest_f.flush()
            continue

        elapsed = time.time() - t0
        print(f"[{i}/{len(words)}] {word['english']:<10} done in {elapsed:.0f}s -> {dest_path}")
        manifest_w.writerow([word_id, word["persian"], word["english"], word["category"], positive, negative, word_seed, STEPS, f"{elapsed:.1f}", os.path.basename(dest_path)])
        manifest_f.flush()

    manifest_f.close()
    print("Done.")


if __name__ == "__main__":
    main()
