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
  * Bounding Box Area: ~33.5 sq° (Cost: 2 credits per query on OpenSky tier)
* **Test Tool**: `backend/scripts/test_opensky_live.py`

## 3. Empirical Observations

### Run #1 (2026-09-12 10:08:27 UTC / 15:53:27 NPT)
* **HTTP Status**: 200 OK
* **Response Latency**: 867.0 ms
* **Remaining Anonymous Credits**: 398 / 400
* **Total Aircraft Detected**: 11
* **Field Completeness**:
  * `callsign`: 11 / 11 (100.0%)
  * `position` (`lat`, `lon`): 11 / 11 (100.0%)
  * `baro_altitude`: 11 / 11 (100.0%)
  * `geo_altitude`: 11 / 11 (100.0%)
  * `velocity`: 11 / 11 (100.0%)
  * `heading`: 11 / 11 (100.0%)
  * `vertical_rate`: 11 / 11 (100.0%)
  * `on_ground`: 0 / 11 (0.0% - all airborne)
  * `squawk`: 3 / 11 (27.3%)

### Run #2 (2026-09-12 10:08:38 UTC / 15:53:38 NPT - 11s later)
* **HTTP Status**: 200 OK
* **Response Latency**: 844.2 ms
* **Remaining Anonymous Credits**: 396 / 400 (confirming 2 credits deducted per query)
* **Total Aircraft Detected**: 11
* **Observed Movement**:
  * `SHA826` (Shree Airlines): Descending towards KTM (10,200 ft -> 10,100 ft, HDG 70°)
  * `BBC372` (Biman Bangladesh): Climbing out from KTM (15,050 ft -> 15,400 ft, HDG 127°)
  * `BHA137` (Buddha Air): Cruising near PKR (17,825 ft -> 17,900 ft, HDG 280°)

### Sample Live State Vectors Captured
```text
===================================================================================================================
ICAO24   CALLSIGN   OPERATOR/COUNTRY     ALT (FT)   SPD (KT)   HDG    GND    LAT       LON       NEAREST APT
===================================================================================================================
801645   AIC6FW     India                35000      453        96     NO     26.7446   84.2718   BWA (119.7 km)
80160b   IGO5207    India                38000      457        310    NO     26.4092   81.3623   KEP (191.0 km)
80161c   AXB1825    India                34550      462        116    NO     27.0246   80.2958   KEP (180.9 km)
801699   AXB1038    India                38000      466        284    NO     26.9772   83.0766   BWA (67.7 km)
8015c9   IGO6378    India                35050      462        98     NO     26.7482   80.9594   KEP (166.3 km)
702067   BBC372     Bangladesh           15050      355        127    NO     27.5901   85.5450   KTM (21.8 km)
800588   AIC219     India                34650      447        84     NO     27.0325   83.5370   BWA (53.9 km)
70a8ee   BHA137     Buddha Air           17825      239        278    NO     27.9958   83.9536   PKR (23.0 km)
70a8e7   SHA225     Shree Airlines       18500      326        285    NO     28.4441   82.0383   KEP (52.4 km)
70a8e9   SHA826     Shree Airlines       10200      259        84     NO     27.7627   84.9332   KTM (42.6 km)
8018c7   IGO2417    India                36000      472        282    NO     27.3160   81.6687   KEP (87.8 km)
===================================================================================================================
```

---

## 4. Key Findings & Architectural Impact

1. **Domestic Fleet Visibility Confirmed**:
   - Both **Buddha Air** (`BHA137`) and **Shree Airlines** (`SHA225`, `SHA826`) were actively received and tracked by OpenSky receivers near Pokhara (`PKR`), Nepalgunj (`KEP`), and Kathmandu (`KTM`).
   - Buddha Air ICAO code is `BHA` (not `BUD`).
2. **Nepalese Registration Block Identified**:
   - All Nepalese aircraft shared the distinct ICAO 24-bit transponder address prefix `70a8..` (e.g. `70a8ee`, `70a8e7`, `70a8e9`).
   - This provides a direct, highly reliable heuristic to identify Nepalese registered aircraft (`9N-xxx`) even if the callsign format varies.
3. **High Field Completeness**:
   - For detected airborne targets, position (`lat`, `lon`), barometric altitude, geometric altitude, velocity, and heading (`true_track`) showed **100% completeness**.
   - `squawk` was sparse (27.3%), and `on_ground` was false for all airborne targets.
4. **Credit Consumption Rate**:
   - Our bounding box area is ~33.5 sq°, which OpenSky charges **2 credits** per query against the anonymous allowance of 400 credits/day.
   - 400 credits / 2 credits per query = **200 allowed anonymous queries per 24 hours**.
   - **Architectural Imperative**: FastAPI *must* cache responses with a strict TTL (e.g. 10–15 seconds minimum) and debounce polling. A single client polling directly would exhaust daily quota in under 40 minutes without backend caching. Authenticated credentials (4,000 daily credits) should be recommended for production.
5. **Cross-Border Traffic Context**:
   - Of 11 detected aircraft, 4 were operating within Nepalese airspace/domestic routes, and 7 were high-altitude overflights (FL340-FL380) along the Indian border corridor.
   - The normalized flight schema should allow filtering by `in_nepal_airspace` or viewing the entire regional approach corridor.
