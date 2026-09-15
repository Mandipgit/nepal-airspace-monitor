# Nepal Airspace Monitor & Flight Tracker: System Architecture

## 1. System Overview

Nepal Airspace Monitor is a high-reliability, provider-independent real-time aviation tracking platform specifically engineered for the Kathmandu Flight Information Region (VNKT FIR) and surrounding South Asian / Himalayan flight corridors.

The system is architected to solve the unique challenges of mountain aviation monitoring:
- High-elevation terrain and specialized STOL (Short Take-Off and Landing) flight networks (Lukla, Jomsom, Simikot).
- Distinct domestic carrier fleets (Buddha Air, Yeti Airlines, Shree Airlines, Nepal Airlines, Tara Air, Summit Air).
- Commercial international air routes transiting or terminating in Kathmandu (Tribhuvan International) and Pokhara International.
- Robust provider fallback mechanisms ensuring uninterrupted tracking even when third-party ADS-B API quotas expire.

---

## 2. High-Level Architecture Diagram

```text
               ┌─────────────────────────────────────────────────────────┐
               │                  External Data Providers                │
               │  ┌───────────────────────┐   ┌───────────────────────┐  │
               │  │  OpenSky Network ADS-B│   │ FlightAware AeroAPI   │  │
               │  │  (OAuth2 & Rest API)  │   │ (Future Adapter Layer)│  │
               │  └───────────┬───────────┘   └───────────┬───────────┘  │
               └──────────────┼───────────────────────────┼──────────────┘
                              │                           │
                              ▼                           ▼
               ┌─────────────────────────────────────────────────────────┐
               │               FastAPI Application Service               │
               │                                                         │
               │  ┌───────────────────────────────────────────────────┐  │
               │  │             Provider Normalization Layer          │  │
               │  │  (Converts state vectors to NormalizedFlight model│  │
               │  └─────────────────────┬─────────────────────────────┘  │
               │                        │                                │
               │  ┌─────────────────────▼─────────────────────────────┐  │
               │  │           TTL Cache & Quota Management            │  │
               │  │  (Debounces requests to protect provider credits) │  │
               │  └─────────────────────┬─────────────────────────────┘  │
               │                        │                                │
               │  ┌─────────────────────▼─────────────────────────────┐  │
               │  │             Flight Enrichment Service             │  │
               │  │  - Airport Proximity (Haversine distance)         │  │
               │  │  - Route Resolution (Departure & Arrival)         │  │
               │  │  - Commercial Aircraft Specs (Seats, MTOW, Range) │  │
               │  └─────────┬───────────────────────────┬─────────────┘  │
               │            │                           │                │
               └────────────┼───────────────────────────┼────────────────┘
                            │                           │
            ┌───────────────▼─────────────┐             │
            │     Supabase PostgreSQL     │             │
            │  - Airports & Runways       │             │
            │  - Aircraft Specifications  │             │
            └─────────────────────────────┘             │
                                                        │ REST / JSON
                                                        ▼
               ┌─────────────────────────────────────────────────────────┐
               │               Next.js 16 (React 19) Frontend            │
               │                                                         │
               │  ┌───────────────────────┐   ┌───────────────────────┐  │
               │  │     MapLibre GL JS    │   │  Flight Dossier &     │  │
               │  │ - OpenFreeMap Vector  │   │  Telemetry Drawer     │  │
               │  │ - Kathmandu FIR Bound │   │ - Route Card (KTM-PKR)│  │
               │  │ - Category Icons      │   │ - Avionics Kinematics │  │
               │  │ - Live Knots & FL     │   │ - Passenger Capacity  │  │
               │  └───────────────────────┘   └───────────────────────┘  │
               └─────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow & Domain Models

### 3.1 Normalized Flight Model (`NormalizedFlight`)
The application defines a canonical data model independent of provider formats:

* **`FlightIdentification`**:
  - `icao24`: 24-bit hex transponder address.
  - `callsign`: Radiotelephony callsign (e.g. `BHA282`, `RNA205`, `IGO6125`).
  - `registration`: Tail registration (e.g. `9N-AMF`).
  - `is_nepal_registered`: Boolean identifying Nepalese registration (ICAO `70a8..` allocation, `9N` prefix, or Nepal operator).
  - `operator_icao` / `operator_name`: Operator metadata.
* **`FlightPosition`**:
  - `latitude`, `longitude`: WGS-84 decimal coordinates.
  - `altitude_baro_m` & `altitude_baro_ft`: Altitude in meters and feet.
  - `groundspeed_mps` & `groundspeed_kts`: Groundspeed in m/s and knots.
  - `heading_deg`: True track heading ($0^\circ-360^\circ$).
  - `vertical_rate_mps` & `vertical_rate_fpm`: Climb/descent rate.
* **`FlightRoute`**:
  - `origin_icao`, `origin_iata`, `origin_name`: Departure airport details.
  - `destination_icao`, `destination_iata`, `destination_name`: Arrival airport details.
* **`AircraftSpec`**:
  - Commercial passenger capacity, MTOW, engine type, cruise speed, and nominal range.

---

## 4. Frontend Map & Visualization Engine

1. **Vector Tile Base Map**: Powered by MapLibre GL JS and OpenFreeMap, supporting four distinct themes:
   - `OpenFreeMap Liberty` (Default clean topographical view)
   - `OpenFreeMap Dark` (Night operations radar)
   - `OpenFreeMap Positron` (Minimalist high-contrast light)
   - `OpenFreeMap Bright` (Vibrant daytime aviation map)
2. **Airspace Framing**: Fixed strict bounding box locked to the Kathmandu FIR corridor ($25.80^\circ\text{N}-30.65^\circ\text{N}, 79.80^\circ\text{E}-88.50^\circ\text{E}$), preventing disorientation and unnecessary out-of-boundary tile loading.
3. **FlightRadar24-Style Aircraft Silhouettes**: Custom high-DPI canvas glyphs generated dynamically for each aircraft class:
   - `turboprop`: Straight wings with twin engine nacelles and T-tail (ATR 72, Dash 8, Twin Otter).
   - `regional`: Swept wings with rear pod-mounted turbofans (CRJ-200/700, ERJ).
   - `narrowbody`: Swept wings with underwing twin turbofans (Airbus A320/A321, Boeing 737).
   - `widebody`: Heavy intercontinental wingspan with high-bypass turbofans (Airbus A330/A350, Boeing 777/787).
   - `helicopter`: Rotorcraft bubble with spinning rotor disc and tail rotor.
4. **Color Taxonomy**:
   - **Green**: Nepal-registered aircraft (`9N-...`, Buddha Air, Yeti, Shree, Nepal Airlines, Tara, Summit).
   - **Yellow**: Foreign/international transit airliners.
   - **Clean Red**: Currently selected aircraft.

---

## 5. Security & Deployment

- **API Secrets**: All provider tokens (`OPENSKY_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) are kept on the server side and excluded from client bundles.
- **CORS Configuration**: FastAPI `CORSMiddleware` strictly limits origin domains based on `ALLOWED_ORIGINS`.
- **Zero Hardcoding**: All spatial distances, knots speeds, and flight levels are computed dynamically from real ADS-B transponder telemetry.
