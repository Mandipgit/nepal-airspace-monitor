#!/usr/bin/env python3
"""
OpenSky Network Nepal Live Coverage Probe
Part of Nepal Flight Tracker - Phase 1 Experimentation

Queries the OpenSky Network states API over the Nepal bounding box:
- lamin: 26.34, lomin: 80.05, lamax: 30.45, lomax: 88.20
Measures latency, data completeness, airport proximity, and carrier identification.
Zero external dependencies (uses standard library urllib).
"""

import sys
import json
import time
import math
from datetime import datetime, timezone
import urllib.request
import urllib.error

# Nepal Geographical Bounding Box
BBOX = {
    "lamin": 26.34,
    "lomin": 80.05,
    "lamax": 30.45,
    "lomax": 88.20
}

# Key Airports in Nepal for Proximity Check (lat, lon, ICAO, Name)
AIRPORTS = [
    {"icao": "VNKT", "iata": "KTM", "name": "Kathmandu (Tribhuvan)", "lat": 27.6966, "lon": 85.3591},
    {"icao": "VNPK", "iata": "PKR", "name": "Pokhara International", "lat": 28.2009, "lon": 83.9821},
    {"icao": "VNBW", "iata": "BWA", "name": "Bhairahawa (Gautam Buddha)", "lat": 27.5056, "lon": 83.4161},
    {"icao": "VNLK", "iata": "LUA", "name": "Lukla (Tenzing-Hillary)", "lat": 27.6869, "lon": 86.7297},
    {"icao": "VNVT", "iata": "BIR", "name": "Biratnagar", "lat": 26.4816, "lon": 87.2644},
    {"icao": "VNNG", "iata": "KEP", "name": "Nepalgunj", "lat": 28.1054, "lon": 81.6669},
]

# Known Nepalese Airline ICAO Prefixes
NEPAL_AIRLINES = {
    "RNA": "Nepal Airlines",
    "NYT": "Yeti Airlines",
    "BHA": "Buddha Air",
    "SHA": "Shree Airlines",
    "TRA": "Tara Air",
    "SMT": "Summit Air",
    "GBL": "Guna Airlines",
    "HRA": "Himalaya Airlines"
}

def haversine_km(lat1, lon1, lat2, lon2):
    """Compute distance in km between two GPS coordinates."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c

def probe_opensky():
    url = (
        f"https://opensky-network.org/api/states/all"
        f"?lamin={BBOX['lamin']}&lomin={BBOX['lomin']}&lamax={BBOX['lamax']}&lomax={BBOX['lomax']}"
    )
    
    headers = {
        "User-Agent": "NepalFlightTracker-Probe/1.0 (academic-research-probe)"
    }
    
    print("=" * 80)
    print("NEPAL FLIGHT TRACKER - OPENSKY NETWORK EMPIRICAL PROBE")
    print(f"Target Bounding Box: Lat [{BBOX['lamin']}, {BBOX['lamax']}], Lon [{BBOX['lomin']}, {BBOX['lomax']}]")
    print(f"Request URL: {url}")
    print(f"Execution Time: {datetime.now(timezone.utc).isoformat()} (UTC)")
    print("=" * 80)
    
    req = urllib.request.Request(url, headers=headers)
    
    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            elapsed_ms = (time.time() - start_time) * 1000
            status_code = resp.status
            resp_headers = dict(resp.headers)
            body = resp.read().decode('utf-8')
            data = json.loads(body)
    except urllib.error.HTTPError as e:
        elapsed_ms = (time.time() - start_time) * 1000
        error_body = ""
        try:
            error_body = e.read().decode('utf-8', errors='ignore')
        except Exception:
            pass
        print(f"\n[!] HTTP Error: {e.code} - {e.reason} (in {elapsed_ms:.1f}ms)")
        print(f"[!] Response Headers: {dict(e.headers)}")
        if error_body:
            print(f"[!] Server response: {error_body}")
        if e.code == 429:
            print("[!] Rate limit exceeded on OpenSky Network.")
        elif e.code == 403:
            print("[!] Access forbidden. Review policy and headers.")
        sys.exit(1)
    except urllib.error.URLError as e:
        elapsed_ms = (time.time() - start_time) * 1000
        print(f"\n[!] Network Connection Error: {e.reason} (in {elapsed_ms:.1f}ms)")
        sys.exit(1)
        
    print(f"\n[+] HTTP Status: {status_code} OK (Response Latency: {elapsed_ms:.1f} ms)")
    
    # Check rate limit headers if provided by OpenSky
    rate_headers = {k: v for k, v in resp_headers.items() if "rate" in k.lower() or "limit" in k.lower()}
    if rate_headers:
        print(f"[+] Rate limit headers: {rate_headers}")
        
    opensky_time = data.get("time")
    states = data.get("states") or []
    
    if opensky_time:
        server_dt = datetime.fromtimestamp(opensky_time, timezone.utc)
        print(f"[+] OpenSky Server Snapshot Time: {server_dt.isoformat()} (UTC)")
        
    total_aircraft = len(states)
    print(f"\n[+] Total Aircraft Returned in Bounding Box: {total_aircraft}")
    
    if total_aircraft == 0:
        print("\n[-] No aircraft currently detected in the specified bounding box.")
        print("    This could indicate low traffic, receiver coverage gap, or off-peak hours.")
        return

    # Parse and inspect fields
    field_counts = {
        "callsign": 0,
        "position": 0,
        "baro_altitude": 0,
        "geo_altitude": 0,
        "velocity": 0,
        "heading": 0,
        "vertical_rate": 0,
        "on_ground": 0,
        "squawk": 0
    }
    
    parsed_flights = []
    
    for s in states:
        # OpenSky state array mapping
        icao24 = s[0]
        callsign = (s[1] or "").strip()
        origin_country = s[2]
        time_pos = s[3]
        last_contact = s[4]
        lon = s[5]
        lat = s[6]
        baro_alt = s[7]
        on_ground = bool(s[8])
        velocity = s[9]
        heading = s[10]
        vert_rate = s[11]
        geo_alt = s[13]
        squawk = s[14]
        
        if callsign: field_counts["callsign"] += 1
        if lat is not None and lon is not None: field_counts["position"] += 1
        if baro_alt is not None: field_counts["baro_altitude"] += 1
        if geo_alt is not None: field_counts["geo_altitude"] += 1
        if velocity is not None: field_counts["velocity"] += 1
        if heading is not None: field_counts["heading"] += 1
        if vert_rate is not None: field_counts["vertical_rate"] += 1
        if on_ground: field_counts["on_ground"] += 1
        if squawk: field_counts["squawk"] += 1
        
        # Check closest airport
        closest_apt = None
        closest_dist = 999999.0
        if lat is not None and lon is not None:
            for apt in AIRPORTS:
                d = haversine_km(lat, lon, apt["lat"], apt["lon"])
                if d < closest_dist:
                    closest_dist = d
                    closest_apt = apt
                    
        # Identify operator
        operator = None
        for prefix, name in NEPAL_AIRLINES.items():
            if callsign.startswith(prefix):
                operator = name
                break
                
        parsed_flights.append({
            "icao24": icao24,
            "callsign": callsign or "<NONE>",
            "origin_country": origin_country,
            "lat": lat,
            "lon": lon,
            "baro_alt_m": baro_alt,
            "baro_alt_ft": round(baro_alt * 3.28084) if baro_alt is not None else None,
            "velocity_mps": velocity,
            "velocity_kts": round(velocity * 1.94384) if velocity is not None else None,
            "heading": round(heading) if heading is not None else None,
            "on_ground": on_ground,
            "squawk": squawk,
            "operator": operator or origin_country,
            "closest_airport": f"{closest_apt['iata']} ({closest_dist:.1f} km)" if closest_apt else "N/A"
        })

    # Summary of field completeness
    print("\n" + "-" * 50)
    print("FIELD COMPLETENESS ANALYSIS")
    print("-" * 50)
    for field, count in field_counts.items():
        pct = (count / total_aircraft) * 100
        print(f"  * {field:<16}: {count:>3} / {total_aircraft:<3} ({pct:>5.1f}%)")
        
    # Table of live aircraft
    print("\n" + "=" * 115)
    print(f"{'ICAO24':<8} {'CALLSIGN':<10} {'OPERATOR/COUNTRY':<20} {'ALT (FT)':<10} {'SPD (KT)':<10} {'HDG':<6} {'GND':<6} {'LAT':<9} {'LON':<9} {'NEAREST APT'}")
    print("=" * 115)
    for f in parsed_flights:
        alt_str = str(f['baro_alt_ft']) if f['baro_alt_ft'] is not None else "N/A"
        spd_str = str(f['velocity_kts']) if f['velocity_kts'] is not None else "N/A"
        hdg_str = str(f['heading']) if f['heading'] is not None else "N/A"
        lat_str = f"{f['lat']:.4f}" if f['lat'] is not None else "N/A"
        lon_str = f"{f['lon']:.4f}" if f['lon'] is not None else "N/A"
        gnd_str = "YES" if f['on_ground'] else "NO"
        
        print(f"{f['icao24']:<8} {f['callsign']:<10} {f['operator'][:19]:<20} {alt_str:<10} {spd_str:<10} {hdg_str:<6} {gnd_str:<6} {lat_str:<9} {lon_str:<9} {f['closest_airport']}")
    print("=" * 115)

if __name__ == "__main__":
    probe_opensky()
