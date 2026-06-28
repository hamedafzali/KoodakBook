"""Tiny Piper TTS sidecar.

Loads Persian Piper voices lazily (each ~63MB) and synthesizes WAV on demand.
POST /synthesize {"text": "...", "voice": "fa_IR-amir-medium"} -> audio/wav
GET  /health -> ok
"""
import io
import json
import os
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from piper import PiperVoice

VOICES_DIR = os.environ.get("VOICES_DIR", "/voices")
DEFAULT_VOICE = os.environ.get("DEFAULT_VOICE", "fa_IR-amir-medium")
_cache: dict[str, PiperVoice] = {}


def get_voice(name: str) -> PiperVoice:
    path = os.path.join(VOICES_DIR, name + ".onnx")
    if not os.path.exists(path):
        name = DEFAULT_VOICE
        path = os.path.join(VOICES_DIR, DEFAULT_VOICE + ".onnx")
    if name not in _cache:
        _cache[name] = PiperVoice.load(path)
    return _cache[name]


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
            v = get_voice(voice)
            buf = io.BytesIO()
            wf = wave.open(buf, "wb")
            v.synthesize_wav(text, wf)
            wf.close()
            data = buf.getvalue()
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
    print(f"Piper TTS sidecar on :{port} (voices: {VOICES_DIR})", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
