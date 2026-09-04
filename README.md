# 🌊 HackWave Flood Engine

> Hybrid AI pipeline for real-time flood risk forecasting, spatial tabular LightGBM inference, critical infrastructure hazard evaluation, and automated tactical emergency advisory generation.

---

## Architecture Overview

```mermaid
flowchart TD
    Client["Frontend (Next.js MapCanvas / RainfallSlider / AlertHUD)"]
    
    subgraph FastAPI Backend ["FastAPI Backend (backend/app)"]
        API["REST API (main.py)"]
        Collector["FFS Ingestion (ffs_collector.py)"]
        Predictor["LightGBM ML Predictor (ml_predictor.py)"]
        Orchestrator["Hazard Orchestrator (alert_orchestrator.py)"]
        Agent["Featherless AI LLM Agent (featherless_agent.py)"]
        DBService["Supabase Data Service (supabase_service.py)"]
    end
    
    subgraph Storage & Services ["Storage & Cloud Services"]
        Supabase[("Supabase DB (PostgreSQL)")]
        Featherless["Featherless AI (Llama-3.1-8B)"]
        ModelStorage[("backend/models/flood_lgbm_model.txt")]
    end
    
    Client -->|1. GET /ffs/snapshot| API
    Client -->|2. POST /predict (Rainfall & Coords)| API
    API --> Predictor
    Predictor --> ModelStorage
    
    Client -->|3. POST /evaluate-hazard| API
    API --> Orchestrator
    Orchestrator --> Predictor
    Orchestrator --> DBService
    Orchestrator --> Agent
    
    Agent -.->|Emergency Advisory Prompts| Featherless
    DBService -.->|Persist Predictions & Alerts| Supabase
    API -->|4. Return Hazard & Advisories| Client
```

---

## Backend Modules

- **`ml_predictor.py`**: Tabular LightGBM Spatial Probability engine. Predicts flood inundation probability based on rainfall accumulation, terrain elevation, slope, soil moisture, river proximity, and drainage capacity.
- **`ffs_collector.py`**: Flash Flood Guidance (FFS) data collector. Provides regional saturation snapshots, accumulation metrics, and grid layers for map heatmaps.
- **`alert_orchestrator.py`**: Intersects flood probability with critical infrastructure (hospitals, power substations, bridges, schools) to calculate compound hazard scores.
- **`featherless_agent.py`**: OpenAI-compatible LLM client targeting Featherless AI (`meta-llama/Meta-Llama-3.1-8B-Instruct`) to generate tactical emergency broadcasts and civilian advisories (with robust fallback generator).
- **`supabase_service.py`**: Database abstraction layer for persisting predictions, alerts, and querying spatially indexed infrastructure assets (with in-memory fallback for local dev).
- **`main.py`**: FastAPI service exposing RESTful endpoints with full CORS support.

---

## REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health, ML model status, Supabase & LLM status |
| `POST` | `/predict` | Single-point spatial flood probability prediction |
| `POST` | `/predict/batch` | Batch multi-point flood probability predictions |
| `GET` | `/ffs/snapshot` | Flash Flood Guidance saturation snapshot |
| `GET` | `/ffs/grid` | Regional observation grid for map visualization |
| `POST` | `/evaluate-hazard` | Compound hazard evaluation & infrastructure intersection |
| `POST` | `/alerts/generate` | Generate AI emergency advisory & save to Supabase |
| `GET` | `/alerts` | Retrieve recent alerts |
| `GET` | `/infrastructure` | Retrieve critical infrastructure assets within radius |

---

## Quick Start (Backend)

### 1. Setup Virtual Environment
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
```
*(Optional: Add `FEATHERLESS_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY` in `.env`)*

### 3. Run Development Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- **API Root**: [http://localhost:8000/](http://localhost:8000/)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 4. Run Test Suite
```bash
PYTHONPATH=backend pytest backend/tests
```

---

## Database (Supabase) Setup

1. In your Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql) to create tables and spatial indexes.
2. Run [`supabase/seed_infrastructure.sql`](supabase/seed_infrastructure.sql) to populate initial critical infrastructure assets.
