# 🌊 FloodCast

### Hyperlocal Flood Extent Prediction & Emergency Intelligence

> **Predict the flood before it reaches the street.**

Flood warnings are often issued at a district or city level.
**FloodCast** takes a more localized approach by combining rainfall,
terrain, hydrological signals, historical patterns, and machine learning
to estimate flood susceptibility at specific locations and translate
that prediction into actionable emergency intelligence.

Built as a hackathon prototype for **urban flood-risk prediction and
decision support**, FloodCast brings together a geospatial interface, a
LightGBM prediction engine, infrastructure-aware hazard analysis, and
Featherless AI-powered emergency advisories.

------------------------------------------------------------------------

## 🚨 The Problem

A city-level flood warning answers:

> **"Is this city at risk?"**

But a resident needs to know:

> **"Is my street at risk?"**

And an emergency operator needs to know:

> **"Which locations and critical infrastructure should we
> prioritize?"**

Traditional warnings can be too spatially coarse for these decisions.

FloodCast aims to bridge that gap by converting environmental and
geospatial signals into **location-specific flood susceptibility and
actionable risk intelligence.**

------------------------------------------------------------------------

# 💡 What FloodCast Does

FloodCast combines multiple sources of information to produce a
localized flood-risk assessment.

``` text
Rainfall / Hydrological Signals
             │
             ▼
      Terrain & Location
             │
             ▼
       LightGBM Model
             │
             ▼
   Flood Susceptibility
             │
       ┌─────┴─────┐
       ▼           ▼
Infrastructure   AI Analysis
   Analysis      (Featherless)
       │           │
       └─────┬─────┘
             ▼
     Emergency Intelligence
             │
       ┌─────┴─────┐
       ▼           ▼
  Ops Dashboard  Resident View
```

------------------------------------------------------------------------

# 🧠 Core Intelligence

## 1. Spatial Flood Prediction

FloodCast uses a **LightGBM-based tabular ML model** to estimate flood
susceptibility from environmental and spatial features.

The prediction pipeline considers signals such as:

-   🌧️ Rainfall accumulation
-   ⛰️ Terrain elevation
-   📐 Terrain slope
-   💧 Soil moisture
-   🌊 River proximity
-   🏙️ Drainage capacity
-   📍 Geographic location

The model produces a location-specific susceptibility score that is
converted into interpretable risk tiers.

## 2. Geospatial Risk Visualization

Predictions are displayed directly on an interactive map.

The interface allows operators to understand:

-   Flood-susceptible areas
-   Risk severity
-   Geographic context
-   Hydrological conditions
-   Critical infrastructure
-   Prediction locations
-   Analysis horizons

## 3. Critical Infrastructure Hazard Analysis

Flood risk becomes significantly more important when it intersects with
critical infrastructure.

FloodCast evaluates predicted flood risk alongside infrastructure such
as:

-   🏥 Hospitals
-   ⚡ Power substations
-   🌉 Bridges
-   🏫 Schools
-   🚓 Police infrastructure
-   🏢 Other critical assets

This allows the system to move beyond:

> "This location may flood."

toward:

> "This location may flood, and critical infrastructure is potentially
> exposed."

## 4. 🤖 Featherless AI Emergency Intelligence

Flood prediction and language generation are deliberately separated.

The ML system determines the **risk**.

Featherless AI converts structured risk information into a
**human-readable emergency advisory**.

``` text
ML Prediction
     │
     ▼
Risk + Location + Infrastructure
     │
     ▼
Hazard Orchestrator
     │
     ▼
Featherless AI
     │
     ▼
Emergency Advisory
```

This separation keeps the predictive layer deterministic and lets the
LLM focus on communicating the result clearly.

------------------------------------------------------------------------

# 🎯 Why AI?

A simple elevation threshold cannot adequately capture urban flood
susceptibility.

Two locations at similar elevations can behave differently because of
differences in:

-   Rainfall intensity
-   Terrain
-   River proximity
-   Soil conditions
-   Drainage
-   Historical patterns
-   Geographic context

FloodCast therefore uses machine learning to learn relationships between
these variables and localized flood susceptibility.

The current implementation uses **LightGBM**, providing fast tabular
inference suitable for an interactive decision-support system.

------------------------------------------------------------------------

# 🖥️ Product Interfaces

## Operations Dashboard

Designed for disaster-management and emergency-response workflows.

It provides:

-   Interactive geospatial visualization
-   Area search
-   Flood susceptibility score
-   Risk tier
-   AI advisory
-   Actionable recommendations
-   Model status
-   Backend connectivity status
-   Prediction horizon controls
-   Hydrological context

## 📱 Resident View

The resident-facing interface simplifies the technical prediction into
information that matters during an emergency:

-   Current risk
-   Expected flood depth
-   Estimated arrival
-   Prediction confidence
-   Flooded-area visualization
-   Evacuation information

> **Turn complex flood modelling into a decision a resident can
> understand in seconds.**

------------------------------------------------------------------------

# 🗺️ Geographic Intelligence

FloodCast is built around a map-first architecture.

The map can display:

-   River gauges
-   River infrastructure
-   Police stations
-   Critical infrastructure
-   Flood-risk regions
-   Prediction locations
-   Geographic context

------------------------------------------------------------------------

# 🏗️ Architecture

``` text
                         FLOODCAST
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
       Frontend Application          External Data Sources
              │                             │
              │                             ├── Rainfall
              │                             ├── FFS / Hydrological Data
              │                             ├── Terrain / Spatial Data
              │                             └── Infrastructure Data
              │
              ▼
       FastAPI REST API
              │
      ┌───────┼───────────────┐
      │       │               │
      ▼       ▼               ▼
   LightGBM  Hazard       Supabase
   Predictor Orchestrator  Service
      │       │               │
      │       │               └── PostgreSQL
      │       │
      │       └───────────┐
      │                   ▼
      │             Featherless AI
      │                   │
      └──────────┬────────┘
                 ▼
          Structured Results
                 │
                 ▼
        Dashboard / Resident UI
```

------------------------------------------------------------------------

# 🧩 Tech Stack

  Technology                    Purpose
  ----------------------------- ---------------------------------
  **Next.js + React**           Frontend
  **Leaflet / React Leaflet**   Interactive maps
  **Tailwind CSS**              UI styling
  **Lucide React**              UI icons
  **FastAPI**                   REST API
  **LightGBM**                  Flood susceptibility prediction
  **Scikit-learn**              ML utilities
  **Pandas / NumPy**            Data processing
  **Featherless AI**            Emergency advisory generation
  **Supabase / PostgreSQL**     Persistence
  **Pytest**                    Testing

------------------------------------------------------------------------

# 🔌 API

Core backend endpoints include:

  Method   Endpoint             Purpose
  -------- -------------------- --------------------------------
  `GET`    `/health`            Service/model health
  `POST`   `/predict`           Single-location prediction
  `POST`   `/predict/batch`     Batch spatial predictions
  `GET`    `/ffs/snapshot`      Hydrological snapshot
  `GET`    `/ffs/grid`          Regional observation grid
  `POST`   `/evaluate-hazard`   Compound hazard evaluation
  `POST`   `/alerts/generate`   Generate emergency advisory
  `GET`    `/alerts`            Retrieve recent alerts
  `GET`    `/infrastructure`    Retrieve nearby infrastructure

------------------------------------------------------------------------

# 📊 Prediction Pipeline

``` text
1. Receive location / environmental inputs
                 ↓
2. Collect relevant hydrological signals
                 ↓
3. Prepare spatial feature vector
                 ↓
4. Run LightGBM inference
                 ↓
5. Calculate flood susceptibility
                 ↓
6. Determine risk tier
                 ↓
7. Intersect risk with infrastructure
                 ↓
8. Generate structured hazard assessment
                 ↓
9. Send relevant context to Featherless AI
                 ↓
10. Generate human-readable advisory
                 ↓
11. Persist prediction / alert
                 ↓
12. Display result on map + dashboard
```

------------------------------------------------------------------------

# 🧪 Validation Philosophy

Flood prediction is a difficult modelling problem.

FloodCast does **not** position a simple threshold-based calculation as
a complete hydrological simulation.

The intended validation workflow is:

``` text
Historical Flood Event
        │
        ▼
Historical Environmental Data
        │
        ▼
FloodCast Prediction
        │
        ▼
Predicted Flood Extent
        │
        ├──────────────┐
        ▼              ▼
Actual Event      Prediction
Extent            Extent
        │              │
        └──────┬───────┘
               ▼
       Accuracy Evaluation
```

The MVP focuses on validating the system against a known historical
event before expanding toward continuous live forecasting.

------------------------------------------------------------------------

# 🏆 Hackathon Demo Flow

### 01 --- Select an Area

Search for a location such as:

``` text
Gachibowli, Hyderabad
```

### 02 --- Analyze

FloodCast processes the location through the prediction pipeline.

### 03 --- Observe the Risk

The dashboard presents:

-   Susceptibility score
-   Risk tier
-   Geographic location
-   Hydrological context
-   Prediction information

### 04 --- Inspect the Map

The predicted risk is visualized geographically.

### 05 --- Evaluate Infrastructure

The system checks whether critical infrastructure is exposed.

### 06 --- Generate AI Advisory

Featherless AI converts the structured hazard information into an
emergency-oriented advisory.

### 07 --- Explain the Decision

Instead of only showing:

``` text
Risk = HIGH
```

FloodCast attempts to answer:

``` text
Why is the area at risk?
What could be affected?
What should people do?
```

------------------------------------------------------------------------

# 🌆 Current Focus

FloodCast is being developed with **urban flood-risk prediction in
Hyderabad, India** as the primary demonstration context.

The MVP is intentionally scoped to avoid attempting a full physics-based
hydrodynamic simulation during a hackathon.

Instead, the architecture focuses on:

-   ML-based susceptibility prediction
-   Spatial analysis
-   Historical validation
-   Infrastructure-aware hazard assessment
-   AI-assisted emergency communication

------------------------------------------------------------------------

# 🚀 Roadmap

## Phase 1 --- Core Prediction Engine

-   [x] LightGBM prediction pipeline
-   [x] Spatial prediction API
-   [x] Batch prediction support
-   [x] Model health/status reporting

## Phase 2 --- Geospatial Intelligence

-   [x] Interactive map
-   [x] Infrastructure visualization
-   [x] Hydrological data layer
-   [x] Location-based analysis

## Phase 3 --- AI Emergency Intelligence

-   [x] Featherless AI integration
-   [x] Structured hazard → advisory pipeline
-   [x] Emergency recommendations
-   [x] Alert persistence

## Phase 4 --- Historical Validation

-   [ ] Integrate selected historical flood event
-   [ ] Replay historical environmental conditions
-   [ ] Compare predicted vs observed flood extent
-   [ ] Calculate validation metrics
-   [ ] Visualize prediction error

## Phase 5 --- Live Flood Intelligence

-   [ ] Live rainfall feeds
-   [ ] Live river-gauge feeds
-   [ ] Automated prediction refresh
-   [ ] Real-time risk map
-   [ ] Street-level alerts
-   [ ] SMS / messaging integration

## Phase 6 --- Scalable Disaster Intelligence

-   [ ] Multi-city deployment
-   [ ] Multi-hazard modelling
-   [ ] Citizen flood reports
-   [ ] Satellite-derived flood extent
-   [ ] Evacuation route optimization
-   [ ] Resource allocation for emergency responders

------------------------------------------------------------------------

# 🔐 Configuration

FloodCast uses environment variables for external services and
credentials.

### Backend

Create:

``` text
backend/.env
```

from:

``` text
backend/.env.example
```

Configure:

``` env
FEATHERLESS_API_KEY="your-key"
SUPABASE_URL="your-url"
SUPABASE_SERVICE_KEY="your-key"
```

Optional/configurable values include:

``` env
FEATHERLESS_BASE_URL="https://api.featherless.ai/v1"
FEATHERLESS_MODEL="meta-llama/Meta-Llama-3.1-8B-Instruct"
MODEL_PATH="backend/models/flood_lgbm_model.txt"
```

### Frontend

Create the frontend environment file from:

``` text
frontend/.env.example
```

**Never commit real API keys or service credentials.**

------------------------------------------------------------------------

# ⚙️ Local Development

## Prerequisites

-   Node.js
-   npm
-   Python 3.10+
-   Git

## 1. Clone

``` bash
git clone <repository-url>
cd hackware-flood-engine
```

## 2. Backend

``` bash
cd backend
python3 -m venv .venv
```

### Linux / macOS

``` bash
source .venv/bin/activate
```

### Windows

``` powershell
.venv\Scriptsctivate
```

Install dependencies:

``` bash
pip install -r requirements.txt
```

Configure environment variables and run:

``` bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger API documentation:

``` text
http://localhost:8000/docs
```

## 3. Frontend

Open another terminal:

``` bash
cd frontend
npm install
npm run dev
```

The development server will print the local frontend address.

------------------------------------------------------------------------

# 🧪 Testing

Run backend tests:

``` bash
PYTHONPATH=backend pytest backend/tests
```

The repository also includes end-to-end backend testing infrastructure.

------------------------------------------------------------------------

# 📁 Repository Structure

``` text
hackware-flood-engine/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── ml_predictor.py
│   │   ├── ffs_collector.py
│   │   ├── alert_orchestrator.py
│   │   ├── featherless_agent.py
│   │   └── supabase_service.py
│   ├── models/
│   │   └── flood_lgbm_model.txt
│   ├── data/
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── data/
│   │   └── lib/
│   ├── public/
│   ├── package.json
│   └── .env.example
│
├── supabase/
│   ├── schema.sql
│   └── seed_infrastructure.sql
│
├── .github/
│   └── workflows/
│
├── run.sh
└── README.md
```

------------------------------------------------------------------------

# 🧱 Design Principles

### 1. Prediction First

The ML model determines environmental risk.

### 2. AI Where It Adds Value

LLMs are used for communication and advisory generation, not as a
replacement for the numerical prediction engine.

### 3. Spatial by Default

Flood risk is inherently geographic. Predictions should be
understandable in their spatial context.

### 4. Actionable Intelligence

A risk score alone is not enough.

The system should help answer:

> **What is at risk, why is it at risk, and what should happen next?**

### 5. Honest Modelling

FloodCast is a decision-support prototype, not a replacement for
official emergency-management systems or physics-based hydrological
modelling.

Predictions should be validated against observed flood events before
being treated as operational forecasts.

------------------------------------------------------------------------

# 🔮 Future Vision

FloodCast can evolve from a hackathon prototype into a broader **urban
disaster intelligence platform**.

``` text
Live Weather
     +
River Gauges
     +
Terrain
     +
Satellite Imagery
     +
Historical Flood Events
     +
IoT / Sensor Data
     +
Citizen Reports
     ↓
┌─────────────────────────────┐
│      FLOODCAST ENGINE       │
│                             │
│ ML + Spatial Intelligence   │
│ + Hazard Orchestration      │
└──────────────┬──────────────┘
               ↓
       Hyperlocal Risk Map
               ↓
    ┌──────────┼──────────┐
    ↓          ↓          ↓
Residents   Authorities  Responders
    ↓          ↓          ↓
 Alerts     Decisions   Resources
```

The long-term goal is not simply to **predict flooding**.

It is to help communities and emergency teams **act before flooding
becomes a disaster.**

------------------------------------------------------------------------

# ⚠️ Disclaimer

FloodCast is a research and hackathon prototype intended for
experimentation and decision-support demonstration.

It should not be used as the sole basis for evacuation, emergency
response, or other safety-critical decisions.

Official warnings and instructions from relevant disaster-management
authorities should always take precedence.

------------------------------------------------------------------------

# 👥 Built For

**Hackathon Project --- HackWave**

Built with:

**Machine Learning · Geospatial Intelligence · FastAPI · Next.js ·
LightGBM · Featherless AI · Supabase**

------------------------------------------------------------------------

# 🌊 FloodCast

### **From city-wide warnings to street-level intelligence.**
