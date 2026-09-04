FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (libgomp for LightGBM OpenMP support and curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/models ./models
COPY backend/data ./data

EXPOSE 8000

ENV PORT=8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
