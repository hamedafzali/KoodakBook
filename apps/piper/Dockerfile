# Piper TTS sidecar — the free, offline Persian voice for AI stories.
# Debian (glibc) so onnxruntime wheels work; bundles all fa_IR voices.
FROM python:3.11-slim

WORKDIR /app
RUN pip install --no-cache-dir piper-tts

# Download every Persian Piper voice at build (each ~63MB).
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
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
