# OpenSky Network Nepal Experiment Log

## 1. Objective
Empirically evaluate OpenSky Network REST API (`https://opensky-network.org/api/states/all`) coverage, latency, data fidelity, and field availability over Nepal prior to frontend or API construction.

## 2. Experimental Parameters
* **Target Region**: Nepal Airspace & surrounding approach vectors
* **Bounding Box**:
  * Minimum Latitude (`lamin`): `26.34`
  * Minimum Longitude (`lomin`): `80.05`
  * Maximum Latitude (`lamax`): `30.45`
  * Maximum Longitude (`lomax`): `88.20`
* **Test Tool**: `backend/scripts/test_opensky_live.py`

## 3. Observations & Run Results

*(Will be populated with actual measurements during Phase 1 probe execution)*

| Run # | Timestamp (UTC / Local) | Total Aircraft | In Nepal Polygon (Est.) | Callsign Populated % | Altitude Populated % | Groundspeed Populated % | On Ground Count | Response Latency (ms) | HTTP Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | | | | | | | | | |

## 4. Key Findings & Architecture Impact
* *Coverage notes on domestic carriers (Buddha Air, Yeti Airlines, Shree Airlines, Tara Air, Nepal Airlines)*
* *Coverage notes on international traffic at Tribhuvan International Airport (VNKT)*
* *High-altitude overflights vs. low-altitude valley traffic*
* *Observed rate-limiting behavior or headers*
