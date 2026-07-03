# TTS sidecar — free Persian voices for AI stories.
# Edge TTS (Microsoft neural, needs internet) + Piper (offline fallback).
# Debian (glibc) so onnxruntime wheels work; bundles all fa_IR Piper voices.
# ffmpeg transcodes Edge's mp3 to WAV so the API always returns WAV.
FROM python:3.11-slim

WORKDIR /app
RUN pip install --no-cache-dir piper-tts edge-tts

# ffmpeg stays (Edge mp3 → WAV); curl is build-only for the voice download.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates ffmpeg && \
    mkdir -p /voices && \
    BASE=https://huggingface.co/rhasspy/piper-voices/resolve/main/fa/fa_IR && \
    for v in amir ganji ganji_adabi gyro reza_ibrahim; do \
      curl -fsSL -o /voices/fa_IR-$v-medium.onnx      "$BASE/$v/medium/fa_IR-$v-medium.onnx" && \
      curl -fsSL -o /voices/fa_IR-$v-medium.onnx.json "$BASE/$v/medium/fa_IR-$v-medium.onnx.json"; \
    done && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY apps/piper/server.py /app/server.py

EXPOSE 5000
CMD ["python", "server.py"]
