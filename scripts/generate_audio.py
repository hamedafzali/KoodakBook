#!/usr/bin/env python3
"""
Generate Persian audio for every word and letter using Microsoft's free
neural TTS (edge-tts), then emit a migration that points each row's
audio_url at the generated file.

WHY pre-generated files instead of runtime TTS:
  - The app already prefers `audio_url` and only falls back to the browser
    Web Speech API when it is missing. Browser TTS is robotic and, on iOS
    Safari, there is no Persian voice at all (silent). Files fix both, work
    offline (PWA-cacheable), cost nothing to serve, and are consistent on
    every device. This is the "TTS stopgap before a human voice actor" the
    product doc calls for.

Setup (one time):
    python3 -m venv scripts/.venv
    scripts/.venv/bin/pip install edge-tts
Run:
    scripts/.venv/bin/python scripts/generate_audio.py

Re-run any time after adding content — it skips files that already exist and
regenerates the migration. The migration is idempotent (UPDATE by natural key).
"""
import asyncio
import os
import re
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQL_FILES = [
    os.path.join(ROOT, "supabase", "seed.sql"),
    os.path.join(ROOT, "supabase", "migrations", "003_more_content.sql"),
]
# Story pages are also authored in 004 (the stories that shipped empty).
STORY_SQL_FILES = SQL_FILES + [
    os.path.join(ROOT, "supabase", "migrations", "004_fixes.sql"),
]
AUDIO_ROOT = os.path.join(ROOT, "apps", "web", "public", "audio")
MIGRATION = os.path.join(ROOT, "supabase", "migrations", "005_audio.sql")

# Warm, clear voice suited to young children. Swap to fa-IR-FaridNeural for male.
VOICE = "fa-IR-DilaraNeural"
RATE = "-10%"  # slightly slower for clarity / early learners


def slugify(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def uniq(slug: str, seen: set) -> str:
    base, n = slug, 2
    while slug in seen:
        slug = f"{base}-{n}"
        n += 1
    seen.add(slug)
    return slug


def sql_str(s: str) -> str:
    return s.replace("'", "''")


def parse_words():
    """Returns list of dicts: persian, english, finglish, slug."""
    words, seen = [], set()
    # ('persian', 'english', 'finglish', 'category', stage)
    pat = re.compile(
        r"\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*\d+\s*\)"
    )
    for path in SQL_FILES:
        text = open(path, encoding="utf-8").read()
        # only scan blocks that insert into words
        for block in re.split(r";\s*", text):
            if "insert into words" not in block.lower():
                continue
            for fa, en, fing, _cat in pat.findall(block):
                slug = uniq(slugify(en or fing or fa) or f"w{len(words)}", seen)
                words.append({"persian": fa, "english": en, "finglish": fing, "slug": slug})
    # de-dupe by (persian, english) keeping first
    out, keys = [], set()
    for w in words:
        k = (w["persian"], w["english"])
        if k in keys:
            continue
        keys.add(k)
        out.append(w)
    return out


def parse_letters():
    """Returns list of dicts: character, name_persian, name_english, slug."""
    letters, seen = [], set()
    # ('char', 'name_fa', 'name_en', group, order)
    pat = re.compile(
        r"\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*\d+\s*,\s*\d+\s*\)"
    )
    text = open(SQL_FILES[0], encoding="utf-8").read()
    for block in re.split(r";\s*", text):
        if "insert into letters" not in block.lower():
            continue
        for ch, name_fa, name_en in pat.findall(block):
            slug = uniq(slugify(name_en) or f"l{len(letters)}", seen)
            letters.append(
                {"character": ch, "name_persian": name_fa, "name_english": name_en, "slug": slug}
            )
    return letters


def parse_story_pages():
    """Returns list of dicts: title, num, persian, slug — one per story page."""
    pages, seen = [], set()
    title_pat = re.compile(r"title_english\s*=\s*'((?:[^']|'')*)'")
    # Matches both page formats:
    #   seed/004:  (N, 'fa', 'en')
    #   003:       ((select id from s), N, 'fa', 'en')
    # Captures (page_number, persian); the English column is ignored.
    tuple_pat = re.compile(
        r"\(\s*(?:\(\s*select\s+id\s+from\s+s\s*\)\s*,\s*)?(\d+)\s*,\s*'((?:[^']|'')*)'"
    )
    for path in STORY_SQL_FILES:
        text = open(path, encoding="utf-8").read()
        for block in re.split(r";\s*", text):
            if "insert into story_pages" not in block.lower():
                continue
            tm = title_pat.search(block)
            if not tm:
                continue
            title = tm.group(1).replace("''", "'")
            for num, fa in tuple_pat.findall(block):
                fa = fa.replace("''", "'")
                slug = uniq(f"{slugify(title)}-p{num}", seen)
                pages.append({"title": title, "num": int(num), "persian": fa, "slug": slug})
    return pages


async def synth(text: str, path: str):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return False  # already generated
    # Microsoft's free endpoint throttles bursts with 503s — retry with backoff.
    last_err = None
    for attempt in range(6):
        try:
            communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
            await communicate.save(path)
            if os.path.getsize(path) > 0:
                await asyncio.sleep(0.4)  # pace to avoid throttling
                return True
        except Exception as e:  # noqa: BLE001
            last_err = e
            if os.path.exists(path):
                os.remove(path)
            await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"TTS failed for {text!r} after retries: {last_err}")


async def main():
    words = parse_words()
    letters = parse_letters()
    pages = parse_story_pages()
    print(f"Parsed {len(words)} words, {len(letters)} letters, {len(pages)} story pages")

    os.makedirs(os.path.join(AUDIO_ROOT, "words"), exist_ok=True)
    os.makedirs(os.path.join(AUDIO_ROOT, "letters"), exist_ok=True)
    os.makedirs(os.path.join(AUDIO_ROOT, "stories"), exist_ok=True)

    made = 0
    for w in words:
        path = os.path.join(AUDIO_ROOT, "words", f"{w['slug']}.mp3")
        if await synth(w["persian"], path):
            made += 1
            print(f"  word  {w['persian']:12} -> audio/words/{w['slug']}.mp3")
    for l in letters:
        # Pronounce the letter NAME (e.g. «الف») — matches the app's TTS fallback.
        path = os.path.join(AUDIO_ROOT, "letters", f"{l['slug']}.mp3")
        if await synth(l["name_persian"], path):
            made += 1
            print(f"  letter {l['character']} ({l['name_persian']:8}) -> audio/letters/{l['slug']}.mp3")
    for p in pages:
        path = os.path.join(AUDIO_ROOT, "stories", f"{p['slug']}.mp3")
        if await synth(p["persian"], path):
            made += 1
            print(f"  page   {p['title']} p{p['num']} -> audio/stories/{p['slug']}.mp3")

    print(f"Generated {made} new audio files (skipped existing).")

    # ── Emit idempotent migration ──────────────────────────────────────────
    lines = [
        "-- ═══════════════════════════════════════════════════════════",
        "-- KoodakBook — Migration 005: wire generated neural-TTS audio",
        "-- Auto-generated by scripts/generate_audio.py — do not edit by hand.",
        f"-- Voice: {VOICE} (rate {RATE}). Files served by Next.js from /audio/*.",
        "-- ═══════════════════════════════════════════════════════════",
        "",
        "-- Words",
    ]
    for w in words:
        lines.append(
            f"update words set audio_url = '/audio/words/{w['slug']}.mp3' "
            f"where persian = '{sql_str(w['persian'])}' and english = '{sql_str(w['english'])}';"
        )
    lines += ["", "-- Letters"]
    for l in letters:
        lines.append(
            f"update letters set audio_url = '/audio/letters/{l['slug']}.mp3' "
            f"where character = '{sql_str(l['character'])}';"
        )
    lines += ["", "-- Story pages (matched by story title + page number)"]
    for p in pages:
        lines.append(
            f"update story_pages sp set audio_url = '/audio/stories/{p['slug']}.mp3' "
            f"from stories s where sp.story_id = s.id "
            f"and s.title_english = '{sql_str(p['title'])}' and sp.page_number = {p['num']};"
        )
    lines.append("")
    with open(MIGRATION, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Wrote migration: {os.path.relpath(MIGRATION, ROOT)}")


if __name__ == "__main__":
    if sys.version_info < (3, 8):
        sys.exit("Python 3.8+ required")
    asyncio.run(main())
