FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OMP_NUM_THREADS=2 \
    MKL_NUM_THREADS=2 \
    OPENBLAS_NUM_THREADS=2 \
    NUMEXPR_NUM_THREADS=2 \
    HOME=/home/app \
    HF_HOME=/home/app/.cache/huggingface \
    MODEL_CACHE_DIR=/home/app/.cache/huggingface/hub \
    KRONOS_MODEL=NeoQuasar/Kronos-small \
    KRONOS_TOKENIZER=NeoQuasar/Kronos-Tokenizer-base \
    KRONOS_MODEL_REVISION=901c26c1332695a2a8f243eb2f37243a37bea320 \
    KRONOS_TOKENIZER_REVISION=0e0117387f39004a9016484a186a908917e22426 \
    MODEL_MOCK=false

WORKDIR /app

RUN groupadd --gid 1000 app && \
    useradd --uid 1000 --gid 1000 --create-home --home-dir /home/app app

COPY requirements-docker.txt ./requirements-docker.txt

# Keep PyTorch CPU-only; the model is always loaded on CPU in this service.
RUN python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch==2.15.0" && \
    python -m pip install --no-cache-dir -r requirements-docker.txt

COPY app ./app

# Bake both public model snapshots into the image so runtime startup is offline.
RUN mkdir -p "$MODEL_CACHE_DIR" && \
    python -c "import os; from huggingface_hub import snapshot_download; snapshot_download(repo_id=os.environ['KRONOS_MODEL'], revision=os.environ['KRONOS_MODEL_REVISION'], cache_dir=os.environ['MODEL_CACHE_DIR']); snapshot_download(repo_id=os.environ['KRONOS_TOKENIZER'], revision=os.environ['KRONOS_TOKENIZER_REVISION'], cache_dir=os.environ['MODEL_CACHE_DIR'])" && \
    chown -R 1000:1000 /home/app /app

ENV HF_HUB_OFFLINE=1 \
    HF_HUB_DISABLE_TELEMETRY=1

USER 1000:1000
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/health', timeout=3)" || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
