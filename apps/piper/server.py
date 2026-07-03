"""Tiny TTS sidecar — free Persian voices for KoodakBook.

Two engines behind one endpoint:
  - Edge TTS (Microsoft neural voices, e.g. fa-IR-FaridNeural) — much better
    Persian, needs internet. Voice names look like "fa-IR-<Name>Neural".
  - Piper (offline, e.g. fa_IR-amir-medium) — the no-network fallback.

Always returns WAV regardless of engine (Edge's mp3 is transcoded via ffmpeg)
so callers and fixed client paths (/uploads/phonics/<slug>.wav) never care
which engine ran. If Edge fails (offline, API change), we fall back to Piper.

POST /synthesize {"text": "...", "voice": "fa-IR-FaridNeural"} -> audio/wav
GET  /health -> ok
"""
import asyncio
import io
import json
import os
import subprocess
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from piper import PiperVoice

VOICES_DIR = os.environ.get("VOICES_DIR", "/voices")
DEFAULT_VOICE = os.environ.get("DEFAULT_VOICE", "fa_IR-amir-medium")
_cache: dict[str, PiperVoice] = {}


def is_edge_voice(name: str) -> bool:
    # Microsoft voice ids: "fa-IR-FaridNeural" / "fa-IR-DilaraNeural".
    # Piper ids use an underscore locale: "fa_IR-amir-medium".
    return name.startswith("fa-IR-")


def get_voice(name: str) -> PiperVoice:
    path = os.path.join(VOICES_DIR, name + ".onnx")
    if not os.path.exists(path):
        name = DEFAULT_VOICE
        path = os.path.join(VOICES_DIR, DEFAULT_VOICE + ".onnx")
    if name not in _cache:
        _cache[name] = PiperVoice.load(path)
    return _cache[name]


def synth_piper(voice: str, text: str) -> bytes:
    v = get_voice(voice)
    buf = io.BytesIO()
    wf = wave.open(buf, "wb")
    v.synthesize_wav(text, wf)
    wf.close()
    return buf.getvalue()


async def _edge_mp3(voice: str, text: str) -> bytes:
    import edge_tts

    out = bytearray()
    async for chunk in edge_tts.Communicate(text, voice).stream():
        if chunk["type"] == "audio":
            out.extend(chunk["data"])
    if not out:
        raise RuntimeError("edge-tts returned no audio")
    return bytes(out)


def synth_edge(voice: str, text: str) -> bytes:
    """Edge TTS → WAV (mp3 transcoded with ffmpeg so callers only see WAV)."""
    mp3 = asyncio.run(asyncio.wait_for(_edge_mp3(voice, text), timeout=30))
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error",
         "-i", "pipe:0", "-ar", "22050", "-ac", "1", "-f", "wav", "pipe:1"],
        input=mp3, capture_output=True, timeout=30,
    )
    if p.returncode != 0 or not p.stdout:
        raise RuntimeError(f"ffmpeg failed: {p.stderr.decode(errors='replace')[:200]}")
    return p.stdout


def synthesize(voice: str, text: str) -> bytes:
    if is_edge_voice(voice):
        try:
            return synth_edge(voice, text)
        except Exception as e:  # offline / API change → offline fallback
            print(f"edge-tts failed ({e}); falling back to Piper", flush=True)
            voice = DEFAULT_VOICE  # Edge ids have no .onnx — use the Piper default
    return synth_piper(voice, text)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quieter logs
        pass

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != "/synthesize":
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            text = (body.get("text") or "").strip()
            voice = body.get("voice") or DEFAULT_VOICE
            if not text:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"text required")
                return
            data = synthesize(voice, text)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:  # never crash the server on one bad request
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode("utf-8"))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print(f"TTS sidecar on :{port} (piper voices: {VOICES_DIR}, edge: fa-IR-*)", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
