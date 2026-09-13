#!/usr/bin/env python3
"""
Inspect raw aviation datasets
"""

import csv
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "raw"

def inspect_airports():
    path = DATA_DIR / "airports.xls"
    with open(path, mode="r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        total = 0
        np_airports = []
        for row in reader:
            total += 1
            if row.get("iso_country") == "NP":
                np_airports.append(row)
                
    print(f"Airports Total: {total}")
    print(f"Nepal (NP) Airports: {len(np_airports)}")
    print("Sample Nepal Airports:")
    for a in np_airports[:8]:
        iata = a.get("iata_code") or "N/A"
        print(f"  * {a.get('ident'):<6} [{iata:<3}] {a.get('name'):<40} ({a.get('type')}) - Elev: {a.get('elevation_ft')} ft")

def inspect_runways():
    path = DATA_DIR / "airport_runway_clean.xls"
    with open(path, mode="r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        total = 0
        np_runways = []
        for row in reader:
            total += 1
            ident = row.get("airport_ident") or ""
            if ident.startswith("VN") or row.get("iso_country") == "NP":
                np_runways.append(row)
                
    print(f"\nRunways Total: {total}")
    print(f"Nepal Runways (VN* / iso_country=NP): {len(np_runways)}")
    print("Sample Nepal Runways:")
    for r in np_runways[:8]:
        ident = r.get("airport_ident")
        le = r.get("le_ident") or "?"
        he = r.get("he_ident") or "?"
        length = r.get("length_ft") or "?"
        width = r.get("width_ft") or "?"
        surf = r.get("surface") or "?"
        print(f"  * Airport: {ident:<6} Runway: {le}/{he} Length: {length}x{width} ft, Surface: {surf}")

def inspect_aircraft():
    path = DATA_DIR / "aircraft_df.xls"
    with open(path, mode="r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        
    print(f"\nAircraft Models Total: {len(rows)}")
    categories = set(r.get("airplane_type") for r in rows)
    print(f"Categories: {categories}")
    print("Sample Aircraft Specifications:")
    for ac in rows[:8]:
        print(f"  * {ac.get('name'):<25} Type: {ac.get('airplane_type'):<12} IATA/Code: {ac.get('iata_code'):<6} Engines: {ac.get('n_engine')}x {ac.get('engine_type')} MTOW: {ac.get('mtow')} kg, Pax: {ac.get('n_pax')}")

if __name__ == "__main__":
    inspect_airports()
    inspect_runways()
    inspect_aircraft()
