# Scrapling-Sidecar (Python/FastAPI) fuer das Yupoo/Weidian-Scraping.
# Primaerer Fetcher ist curl_cffi (leichtgewichtig); der StealthyFetcher
# (Camoufox-Browser) ist nur Fallback und braucht die Browser-Libs unten.
FROM python:3.12-slim

WORKDIR /srv

# System-Libs fuer den Camoufox/Firefox-Fallback + curl fuer Healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && scrapling install || true

COPY main.py .

EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8100/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
