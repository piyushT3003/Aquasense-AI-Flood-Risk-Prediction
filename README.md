# 🌊 AquaSense: AI-Powered Urban Flood Risk Intelligence for Bengaluru

<p align="center">
  <img src="https://img.shields.io/badge/Live%20Demo-Vercel%20Deployed-00F0FF?style=for-the-badge&logo=vercel&logoColor=black" alt="Vercel Deployment" />
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python Version" />
  <img src="https://img.shields.io/badge/FastAPI-0.110%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-19%20%7C%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React & TS" />
  <img src="https://img.shields.io/badge/ML-XGBoost%20%2B%20TreeSHAP-FF6600?style=for-the-badge&logo=xgboost&logoColor=white" alt="XGBoost" />
  <img src="https://img.shields.io/badge/3D%20Globe-Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/GenAI-Google%20Gemini%202.5-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini" />
</p>

<p align="center">
  <b>Predict. Monitor. Respond.</b><br>
  A hyper-local, physics-informed AI early warning platform projecting flash flood risks across 18 high-vulnerability BBMP corridors in Bengaluru up to 48 hours in advance.
</p>

<p align="center">
  🌐 <b>Production Deployment:</b> <a href="https://aquasense-ai-flood-risk-prediction.vercel.app/"><b>https://aquasense-ai-flood-risk-prediction.vercel.app/</b></a>
</p>

---

## 📌 Executive Summary & Problem Context

Bengaluru, India’s Silicon Valley, suffers recurring catastrophic urban flooding during intense monsoon cloudbursts. Rapid urbanization, loss of interconnected wetland chains, and constriction of arterial storm-water drains (*Raja Kaluves*) lead to systemic drainage paralysis across critical tech corridors (Outer Ring Road, Bellandur, Silk Board, Ecospace, and Koramangala).

**AquaSense** bridges the gap between raw meteorological forecasts and actionable urban response:
- **Calibrated Machine Learning:** Combines 14 hydrologically engineered features into a monotonically constrained **XGBoost** model calibrated with Isotonic Regression.
- **48-Hour Forward Horizon:** Forecasts flood probabilities at 1-hour increments for all 18 BBMP pilot zones.
- **Explainable Decisions (XAI):** Real-time **TreeSHAP** attribution revealing the primary hydrological drivers behind every alert.
- **Dual Live/Simulation Operation:** Automatically synchronizes with live meteorological data from **Open-Meteo** (calm baseline with zero false positives) while providing an instant **Storm Deluge Simulator** for emergency dispatch drills.
- **Bilingual Alert Dispatch:** Delivers role-tailored alerts for Disaster Management Officers alongside verified citizen safety advisories in both **English and Kannada (ಕನ್ನಡ)**.

---

## 🚀 Live Demo & Key Links

| Resource | URL |
|---|---|
| 🌐 **Production Web Application** | **[https://aquasense-ai-flood-risk-prediction.vercel.app/](https://aquasense-ai-flood-risk-prediction.vercel.app/)** |
| 💻 **GitHub Repository** | **[https://github.com/piyushT3003/Aquasense-AI-Flood-Risk-Prediction](https://github.com/piyushT3003/Aquasense-AI-Flood-Risk-Prediction)** |
| 📡 **Live Telemetry Provider** | Open-Meteo Meteorological API (`12.9716° N, 77.5946° E`) |
| 🤖 **AI Model Service** | Google Gemini 2.5 Flash / Grounded Hydrological Heuristics |

---

## 🌟 Core Innovations & Highlights

### 1. 🌍 3D Geospatial Earth & Satellite Visualization
- **Interactive Three.js 3D Globe:** Perfectly centered, responsive 3D globe displaying Bengaluru's geographic coordinate vector, orbital telemetry rings, and live risk-colored status beacons.
- **3D Terrain Satellite Digital Twin (MapLibre GL):** High-resolution Esri satellite imagery draped on AWS elevation terrain. Zones extrude vertically into 3D danger columns proportional to predicted flood severity.
- **2D GIS Topological Map (Leaflet):** Layered visualization of Bengaluru’s primary lake basins (Bellandur, Varthur, Agara), primary storm-water drains (*SWD Raja Kaluves*), and vulnerable infrastructure.

### 2. ⚡ Real-Time Live Weather Ingestion (Open-Meteo API)
- Connects directly to the live meteorological grid for Bengaluru without requiring proprietary hardware or paid API tokens.
- Telemetry auto-refreshes every 5 minutes: ambient temperature, humidity, current precipitation, weather codes, 48-hour past deluge curve, and 48-hour future forecast.
- **Calm Baseline Guarantee:** When current weather is dry/nominal, the entire city operates under green status with zero false alerts projected.

### 3. 🌧️ Interactive Cloudburst Simulator ("Run the storm demo")
- One-click trigger simulating an incoming extreme monsoon cloudburst (55–80 mm/h deluge).
- Watch water levels rise, drain freeboards collapse, and early warning threat radar light up 4 to 6 hours before peak ground ponding.
- Instantly switch back to the live feed anytime with **"Return to live data"**.

### 4. 🧠 Grounded Decision Support with Gemini 2.5 Flash
- Integrated contextual RAG assistant tailored for Disaster Management Officers and Citizens.
- Grounded strictly in live sensor telemetry, drain capacities, and model predictions to prevent hallucination.
- Bring your own Gemini API key or let the built-in deterministic heuristic fallback guide you.

---

## 🏛️ System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               REAL-TIME DATA INGESTION                 │
                    │   • Open-Meteo API (Live Bengaluru 12.97°N, 77.59°E)   │
                    │   • 54 Simulated Ground Sensors (Rain, Radar, Soil)    │
                    │   • BBMP GIS Boundaries & Raja Kaluve Hydrography      │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │              DATA QUALITY & CLEANING PIPELINE          │
                    │   • Spike Gate Filter (eliminates transient sensor noise)│
                    │   • Stuck Gauge Detection & Zero-Clamping              │
                    │   • Forward-fill temporal gap imputation               │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │         14-FEATURE HYDROLOGICAL VECTOR ENGINE          │
                    │   • 1h / 3h / 6h / 24h / 72h Antecedent Rainfall       │
                    │   • Terrain Slope, Elevation, Impervious Surface Ratio │
                    │   • Soil Saturation Index & Lake Proximity Vector      │
                    │   • Drain Capacity Index learned from recession rates  │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │        CALIBRATED XGBOOST RISK PREDICTION MODEL        │
                    │   • Monotone constraints on rainfall & water levels    │
                    │   • Isotonic Regression calibration for true probs     │
                    │   • TreeSHAP real-time explainability attribution      │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │         EARLY WARNING RADAR & ACTION DISPATCH          │
                    │   • Risk Tiering: LOW (<2%) | MED (2-12%) | HIGH | SEV │
                    │   • 48-Hour Horizon Projection Heatmaps                │
                    │   • SDRF Pump Dispatch Plans & Ward Routing            │
                    │   • Citizen Advisories in English & Kannada (ಕನ್ನಡ)    │
                    │   • Gemini 2.5 Flash Conversational Decision Copilot   │
                    └────────────────────────────────────────────────────────┘
```

---

## 📊 14 Hydrological Features & ML Methodology

| Feature Name | Description | Monotone Constraint |
|---|---|:---:|
| `rainfall_1h_mm` | Current 1-hour rainfall accumulation from telemetry | **+1 (Increasing)** |
| `rainfall_3h_mm` | 3-hour moving rainfall volume | **+1 (Increasing)** |
| `rainfall_6h_mm` | 6-hour moving rainfall volume | **+1 (Increasing)** |
| `rainfall_24h_mm` | 24-hour antecedent rainfall (soil saturation memory) | **+1 (Increasing)** |
| `rainfall_72h_mm` | 72-hour macro catchment deluge volume | **+1 (Increasing)** |
| `drain_water_level_m` | Primary SWD sensor water depth | **+1 (Increasing)** |
| `drain_capacity_index` | Effective discharge headroom learned from recession rates | **-1 (Decreasing)** |
| `soil_saturation_pct` | Topsoil moisture index (TDR probe reading) | **+1 (Increasing)** |
| `elevation_m` | Digital Elevation Model (DEM) ground altitude | **-1 (Decreasing)** |
| `terrain_slope_deg` | Average corridor gradient (flat basins accumulate ponding) | **-1 (Decreasing)** |
| `impervious_ratio` | Urban concrete / paved density ratio (0.0 to 1.0) | **+1 (Increasing)** |
| `lake_proximity_m` | Distance to nearest primary retention lake | **-1 (Decreasing)** |
| `critical_infra_count`| Hospitals, tech parks, metro stations in corridor | Neutral |
| `historical_flood_freq`| Documented BBMP waterlogging frequency over past 5 years | **+1 (Increasing)** |

### Model Benchmark & Validation

| Architecture | ROC-AUC | PR-AUC (Priority Metric) | Recall @ HIGH Alert | Lead Time |
|---|:---:|:---:|:---:|:---:|
| Empirical Rule-of-Thumb Baseline | 0.846 | 0.390 | 55.0% | ~2.5 Hours |
| Baseline XGBoost (12 features) | 0.833 | 0.430 | 58.0% | ~4.0 Hours |
| **AquaSense Calibrated XGBoost (14 features)** | **0.841** | **0.462** | **66.4%** | **5.5 to 7.0 Hours** |

> [!NOTE]
> Floods are statistically rare events in urban monitoring (~0.5% of zone-hours). **PR-AUC** (Precision-Recall Area Under Curve) is the definitive statistical score over ROC-AUC. AquaSense delivers a **66% recall** at high-alert thresholds with a median lead time of **6 hours before onset**, validated against the historic September 2022 Bengaluru deluge backtest.

---

## 🗺️ Monitored BBMP Corridors (18 Pilot Zones)

AquaSense actively tracks 18 critical flood corridors across Bengaluru:

1. **Bellandur Basin** (Ward 150) — Mahadevapura
2. **Silk Board Junction** (Ward 174) — BTM Layout
3. **Koramangala 4th Block** (Ward 151) — South Zone
4. **Outer Ring Road - Ecospace** (Ward 150) — Mahadevapura
5. **Rainbow Drive Layout** (Ward 149) — Sarjapur Road
6. **HSR Layout Sector 6** (Ward 174) — Bommanahalli
7. **Hebbal Flyover Arterial** (Ward 7) — Yelahanka
8. **Varthur Lake Channel** (Ward 149) — Mahadevapura
9. **Manyata Tech Park Underpass** (Ward 6) — Byatarayanapura
10. **Nagawara Lake Spillway** (Ward 24) — East Zone
11. **Bilekahalli Underpass** (Ward 188) — Bannerghatta Road
12. **Kadubeesanahalli Underpass** (Ward 150) — Marathahalli
13. **Marathahalli Bridge Basin** (Ward 85) — East Zone
14. **Domlur Inner Ring Road** (Ward 112) — Shantinagar
15. **Nayandahalli Junction** (Ward 131) — Mysore Road
16. **Ejipura Main Road** (Ward 148) — Koramangala
17. **Kengeri Satellite Town** (Ward 159) — RR Nagar
18. **Mahadevapura Ring Road** (Ward 82) — Mahadevapura

---

## 🖥️ Application Features & Pages

| Page | Key Capabilities |
|---|---|
| **Overview** | Interactive 3D WebGL Earth Globe, real-time telemetry KPI cards, live weather ticker, 48-hour citywide risk outlook, verification accuracy metrics. |
| **3D Satellite View** | MapLibre GL 3D satellite digital twin with extruded terrain, live risk-pillar heights, pulsing radar rings, and zone drilldown. |
| **Live Zones & Sensors** | Real-time readings across 54 physical/virtual sensors (Rain gauges, ultrasonic water radars, TDR soil probes), battery health, anomaly flags. |
| **GIS Risk Map** | 2D Leaflet cartographic map displaying BBMP ward boundaries, storm water drains (*Raja Kaluves*), lake retention bodies, and fly-to navigation. |
| **48h Forecast** | 6-horizon projection cards (`NOW`, `+3H`, `+6H`, `+12H`, `+24H`, `+48H`), zone-by-zone hourly risk heatmap, precipitation trajectory. |
| **What-If Simulator** | Interactive hydrological scenario sandbox: modify rainfall intensity (mm/h), storm duration, drain desilting percentage (+20%), and lake fill level to simulate hydraulic runoff live. |
| **Model & Validation** | Full transparency audit: baseline vs tuned XGBoost curves, TreeSHAP feature importance rankings, isotonic calibration plots, and the September 2022 historical backtest report. |
| **Alerts & Threats** | Comprehensive lifecycle triage: `ACKNOWLEDGE`, `ESCALATE`, `RESOLVE` workflows. Dual-language advisory output in English & Kannada. |
| **AI Assistant** | Conversational intelligence powered by Google Gemini 2.5 Flash, grounded in live city telemetry and hydraulic models. |
| **Data Sources** | Instant toggle between **Live Open-Meteo Feed** and **Simulation Deluge Engine**, data quality health, spike gate audit log. |

---

## 👥 Role-Based Access Control (RBAC)

AquaSense provides distinct viewing paradigms switchable in the top navigation bar:

- **👑 Administrator:** Full platform control, simulator parameters, sensor provisioning, and model diagnostics.
- **🛡️ Disaster Management Officer (DMO):** Focuses on early warning triggers, pump dispatch advisories, SDRF mobilization, and alert escalation.
- **🚜 Field Team / BBMP Ward Engineers:** Actionable routing to overflowing drains, lake spillways, and underpasses requiring immediate desilting or barrier deployment.
- **🏡 Citizen:** Simplified, panic-free public dashboard. Displays local neighborhood risk, weather forecast, safety tips, and multilingual advisories; administrative storm controls and model internals are locked.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 8.3
- **Styling:** Tailwind CSS, Lucide Icons, Glassmorphism UI
- **3D Graphics & GIS:** Three.js, MapLibre GL, Leaflet, React-Leaflet
- **Deployment:** Vercel Global Edge Network

### Backend
- **Framework:** FastAPI (Python 3.10+)
- **Asynchronous Server:** Uvicorn, AnyIO
- **Machine Learning:** XGBoost, Scikit-Learn (Isotonic Regression), TreeSHAP
- **Hydrological Core:** Custom hydraulic ponding solver, Raja Kaluve drain recession model
- **External Feeds:** Open-Meteo REST API, Google Gemini Generative AI

---

## 💻 Local Setup & Development

### Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.10 or higher
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/piyushT3003/Aquasense-AI-Flood-Risk-Prediction.git
cd Aquasense-AI-Flood-Risk-Prediction
```

### 2. Fast Start Scripts
- **macOS / Linux:**
  ```bash
  bash start_aquasense.sh
  ```
- **Windows:**
  ```cmd
  start_aquasense.bat
  ```
*This automatically sets up Python virtual environment `.venv`, installs dependencies, trains the XGBoost model (~1 min), and launches frontend and backend concurrently.*

### 3. Manual Step-by-Step Setup

#### Backend Setup:
```bash
# Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Train model & generate calibration metadata
cd backend
python -m ml.train

# Launch FastAPI server
python -m uvicorn main:app --reload --port 8000
```
*API interactive documentation will be available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).*

#### Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```
*Frontend will be running at [http://127.0.0.1:5173](http://127.0.0.1:5173).*

### 4. Run Test Suite
```bash
# From project root:
pytest backend/test_api.py
```
*Verifies all 12 behavior and API contracts across prediction, simulation, alert lifecycle, and Open-Meteo ingestion.*

---

## 🌐 Deploying to Vercel

AquaSense is architected for zero-friction serverless deployment:

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Set the **Root Directory** to `frontend`.
4. Ensure the **Build Command** is `npm run build` and **Output Directory** is `dist`.
5. *(Optional)* Add your Gemini API key in Vercel Environment Variables:
   - `VITE_GEMINI_API_KEY`: Your Google AI Studio API key.
6. Click **Deploy**!

---

## 🔌 API Reference Summary

| Endpoint | Method | Description |
|---|:---:|---|
| `/api/zones` | `GET` | Returns 18 monitored flood corridors with live predictions & risk scores |
| `/api/threats` | `GET` | Active early-warning radar threats and 48h trajectories |
| `/api/alerts` | `GET` | Triggered high/severe alerts requiring action |
| `/api/alerts/{id}/acknowledge` | `POST` | Triage alert to `ACKNOWLEDGED` status |
| `/api/alerts/{id}/escalate` | `POST` | Escalate alert to `ESCALATED` status |
| `/api/alerts/{id}/resolve` | `POST` | Mark alert resolved |
| `/api/forecast` | `GET` | 48-hour zone risk matrix and horizon predictions |
| `/api/rainfall/timeline` | `GET` | Past 48h and future 48h city precipitation series |
| `/api/simulation/control` | `POST` | Trigger storm simulation, speed, pause, or reset |
| `/api/scenarios` | `POST` | Run What-If hydraulic scenario sandbox |
| `/api/model` | `GET` | Model metadata, feature contributions, and calibration stats |
| `/api/backtest/2022` | `GET` | Complete reconstruction and validation on the Sept 2022 deluge |
| `/api/data-source` | `POST` | Toggle between `open-meteo` live feed and `simulator` |
| `/api/ai/query` | `POST` | Query grounded Gemini AI decision copilot |

---



*Special thanks to Karnataka State Natural Disaster Monitoring Centre (KSNDMC) and Bruhat Bengaluru Mahanagara Palike (BBMP) for published urban drainage documentation and flood vulnerability reports.*

---

<p align="center">
  <sub>Developed with ❤️ for the resilient future of Bengaluru.</sub><br>
  <sub>Licensed under the MIT License.</sub>
</p>
