#!/usr/bin/env python3
"""
Supabase Dataset Seeding Pipeline
Loads Aircraft Specifications, Airports, and Runways into Supabase PostgreSQL.
Idempotent and resilient with batch processing and type sanitization.
"""

import sys
import os
import csv
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Set

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import get_settings
from app.services.supabase.client import get_supabase_admin_client

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "raw"

# Regional target countries for airport ingestion:
# Nepal (NP), South Asian neighbors, Middle East hubs, and East/SE Asian flight corridors
TARGET_COUNTRIES: Set[str] = {
    "NP",  # Nepal (100% loaded)
    "IN",  # India
    "BD",  # Bangladesh
    "BT",  # Bhutan
    "CN",  # China / Tibet
    "PK",  # Pakistan
    "LK",  # Sri Lanka
    "MV",  # Maldives
    "AE",  # United Arab Emirates (Dubai, Abu Dhabi, Sharjah)
    "QA",  # Qatar (Doha)
    "OM",  # Oman (Muscat)
    "SA",  # Saudi Arabia (Riyadh, Jeddah, Dammam)
    "KW",  # Kuwait
    "TH",  # Thailand (Bangkok)
    "MY",  # Malaysia (Kuala Lumpur)
    "SG",  # Singapore
    "JP",  # Japan (Tokyo)
    "KR",  # South Korea (Seoul)
    "TR",  # Turkey (Istanbul)
}

def to_int(val: Any) -> Optional[int]:
    """Safely convert string/float representation to int or None."""
    if val is None:
        return None
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ("null", "none", "unknown", "?"):
        return None
    try:
        return int(round(float(val_str)))
    except (ValueError, TypeError):
        return None

def to_float(val: Any) -> Optional[float]:
    """Safely convert string representation to float or None."""
    if val is None:
        return None
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ("null", "none", "unknown", "?"):
        return None
    try:
        return float(val_str)
    except (ValueError, TypeError):
        return None

def to_bool(val: Any) -> bool:
    """Safely convert string/int representation to boolean."""
    if val is None:
        return False
    val_str = str(val).strip().lower()
    return val_str in ("1", "true", "yes", "y", "t")

def clean_str(val: Any, max_len: Optional[int] = None) -> Optional[str]:
    """Clean string, strip whitespace, and optionally truncate."""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("null", "none"):
        return None
    if max_len is not None and len(s) > max_len:
        s = s[:max_len]
    return s

def seed_aircraft_specifications(client, force: bool = False) -> int:
    """Parse and seed aircraft_specifications table."""
    path = DATA_DIR / "aircraft_df.xls"
    if not path.exists():
        root_path = Path(__file__).resolve().parent.parent.parent / "aircraft_df.xls"
        if root_path.exists():
            path = root_path
        else:
            print(f"[!] File not found: {path}")
            return 0

    print("\n" + "=" * 70)
    print("1. SEEDING AIRCRAFT SPECIFICATIONS")
    print("=" * 70)

    # Detect all currently existing columns in database to safely insert
    db_columns = set()
    try:
        sample_res = client.table("aircraft_specifications").select("*").limit(1).execute()
        if sample_res.data:
            db_columns = set(sample_res.data[0].keys())
            print(f"[+] Detected {len(db_columns)} columns in Supabase aircraft_specifications table.")
            if "wing_span" not in db_columns or "landing_field_length_m" not in db_columns:
                print("[!] Note: Some new dimension/propulsion columns not yet in database schema.")
                print("    Run data/schemas/03_add_all_aircraft_specifications_columns.sql in Supabase SQL editor to create all columns.")
    except Exception as e:
        print(f"[!] Note on schema check: {e}")

    rows = []
    with open(path, mode="r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for r in reader:
            raw_code = (r.get("iata_code") or "").strip()
            # Map 'unknown' or empty code to 'UNK' to conform to VARCHAR(4)
            icao_type = "UNK" if (not raw_code or raw_code.lower() == "unknown") else raw_code[:4]
            
            # Speed in knots (source speeds are in km/h, check for Mach if < 2.0)
            cruise_kmh = to_float(r.get("cruise_speed_kmh") or r.get("cruise_speed"))
            if cruise_kmh and 0 < cruise_kmh < 2.0:
                cruise_kmh = cruise_kmh * 1062.0
            cruise_kts = round(cruise_kmh / 1.852) if cruise_kmh else None

            max_kmh = to_float(r.get("max_speed_kmh") or r.get("max_speed"))
            if max_kmh and 0 < max_kmh < 2.0:
                max_kmh = max_kmh * 1062.0
            max_kts = round(max_kmh / 1.852) if max_kmh else None

            # Nominal range: km -> nm
            nominal_range_km = to_float(r.get("nominal_range"))
            range_nm = round(nominal_range_km / 1.852) if nominal_range_km else None

            # Approach speed: km/h -> kts IAS
            approach_kmh = to_float(r.get("approach_speed"))
            approach_kts = round(approach_kmh / 1.852) if approach_kmh else None

            full_row = {
                "model": clean_str(r.get("name")),
                "icao_type": icao_type,
                "category": clean_str(r.get("airplane_type")),
                "engine_type": clean_str(r.get("engine_type")),
                "engine_model": clean_str(r.get("powerplant")),
                "powerplant": clean_str(r.get("powerplant")),
                "number_of_engines": to_int(r.get("n_engine")) or 2,
                "n_engine": to_int(r.get("n_engine")) or 2,
                "passenger_capacity": to_int(r.get("n_pax")),
                "oew_kg": to_float(r.get("owe")),
                "owe": to_float(r.get("owe")),
                "mtow_kg": to_float(r.get("mtow")),
                "mtow": to_float(r.get("mtow")),
                "mlw_kg": to_float(r.get("mlw")),
                "mlw": to_float(r.get("mlw")),
                "fuel_capacity_liters": to_float(r.get("max_fuel")),
                "max_fuel": to_float(r.get("max_fuel")),
                "cruise_speed_kts": cruise_kts,
                "max_speed_kts": max_kts,
                "cruise_altitude": to_float(r.get("cruise_altitude")),
                "nominal_range_nm": range_nm,
                "approach_speed_kts": approach_kts,
                "takeoff_field_length_m": to_int(r.get("tofl")),
                "landing_field_length_m": to_int(r.get("lfl")),
                # Airframe Dimensions & Aerodynamics (m, deg, m2)
                "fuselage_width": to_float(r.get("fuselage_width")),
                "wing_span": to_float(r.get("wing_span")),
                "wing_sweep25": to_float(r.get("wing_sweep25")),
                "wing_area": to_float(r.get("wing_area")),
                "wing_position": clean_str(r.get("wing_position")),
                "htp_area": to_float(r.get("htp_area")),
                "vtp_area": to_float(r.get("vtp_area")),
                "total_length": to_float(r.get("total_length")),
                "total_height": to_float(r.get("total_height")),
                # Propulsion & Engine Details
                "engine_y_arm": to_float(r.get("engine_y_arm")),
                "thruster_type": clean_str(r.get("thruster_type")),
                "bpr": to_float(r.get("bpr")),
                "energy_type": clean_str(r.get("energy_type")),
                "engine_position": clean_str(r.get("engine_position")),
                "rotor_diameter": to_float(r.get("rotor_diameter")),
                "max_power": to_float(r.get("max_power")),
                "max_power_2": to_float(r.get("max_power_2")),
                "max_thrust": to_float(r.get("max_thrust"))
            }

            if db_columns:
                row_data = {k: v for k, v in full_row.items() if k in db_columns}
            else:
                row_data = full_row

            rows.append(row_data)

    total_records = len(rows)
    print(f"Parsed {total_records} aircraft specification records from {path.name}.")

    if not force:
        try:
            existing = client.table("aircraft_specifications").select("id", count="exact").limit(1).execute()
            # If already seeded and not force, check if approach_speed_kts needs updating
            check_sample = client.table("aircraft_specifications").select("approach_speed_kts").eq("model", "ATR72-500Basic").limit(1).execute()
            if check_sample.data and (check_sample.data[0].get("approach_speed_kts") or 0) > 150:
                print("[!] Detected outdated/unconverted approach speed data in database. Updating...")
                force = True
            elif (existing.count or 0) >= total_records:
                print(f"[+] Aircraft specifications already seeded ({existing.count} records). Skipping insertion.")
                return existing.count
        except Exception:
            pass

    # Clear existing specifications to maintain clean idempotency
    try:
        client.table("aircraft_specifications").delete().neq("id", 0).execute()
        print("Cleared existing aircraft_specifications records.")
    except Exception as e:
        print(f"Note on table reset: {e}")

    # Batch insert in chunks of 100
    batch_size = 100
    inserted = 0
    for i in range(0, total_records, batch_size):
        batch = rows[i:i + batch_size]
        res = client.table("aircraft_specifications").insert(batch).execute()
        inserted += len(res.data)
        print(f"  Inserted batch {i // batch_size + 1}: {inserted} / {total_records} records...")

    print(f"[+] Successfully seeded {inserted} aircraft specification models.")
    return inserted

def seed_airports(client) -> Set[str]:
    """Parse and seed airports table with Nepal, regional, and global hubs."""
    path = DATA_DIR / "airports.xls"
    if not path.exists():
        print(f"[!] File not found: {path}")
        return set()

    print("\n" + "=" * 70)
    print("2. SEEDING AIRPORTS (Nepal, South Asia Corridor & Global Hubs)")
    print("=" * 70)

    targeted_rows = []
    with open(path, mode="r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for r in reader:
            country = clean_str(r.get("iso_country"))
            apt_type = clean_str(r.get("type"))
            ident = clean_str(r.get("ident"))

            if not ident:
                continue

            # Prioritize Nepal (100%), regional flight corridor, and large international hubs
            if country in TARGET_COUNTRIES or apt_type == "large_airport":
                iata = clean_str(r.get("iata_code"), max_len=3)
                scheduled = to_bool(r.get("scheduled_service"))

                targeted_rows.append({
                    "ident": ident,
                    "type": apt_type,
                    "name": clean_str(r.get("name")),
                    "latitude_deg": to_float(r.get("latitude_deg")) or 0.0,
                    "longitude_deg": to_float(r.get("longitude_deg")) or 0.0,
                    "elevation_ft": to_int(r.get("elevation_ft")),
                    "continent": clean_str(r.get("continent")),
                    "iso_country": country,
                    "iso_region": clean_str(r.get("iso_region")),
                    "municipality": clean_str(r.get("municipality")),
                    "scheduled_service": scheduled,
                    "gps_code": clean_str(r.get("gps_code")),
                    "iata_code": iata,
                    "local_code": clean_str(r.get("local_code")),
                    "home_link": clean_str(r.get("home_link")),
                    "wikipedia_link": clean_str(r.get("wikipedia_link")),
                    "keywords": clean_str(r.get("keywords"))
                })

    total_records = len(targeted_rows)
    nepal_count = sum(1 for a in targeted_rows if a["iso_country"] == "NP")
    print(f"Filtered {total_records} targeted airports (including {nepal_count} Nepalese airports).")

    try:
        existing = client.table("airports").select("ident", count="exact").limit(1).execute()
        if (existing.count or 0) >= total_records:
            print(f"[+] Airports already seeded ({existing.count} records). Skipping upsert.")
            return {a["ident"] for a in targeted_rows}
    except Exception:
        pass

    # Batch upsert in chunks of 250
    batch_size = 250
    inserted_idents = set()
    for i in range(0, total_records, batch_size):
        batch = targeted_rows[i:i + batch_size]
        res = client.table("airports").upsert(batch, on_conflict="ident").execute()
        for item in res.data:
            inserted_idents.add(item["ident"])
        print(f"  Upserted batch {i // batch_size + 1}/{(total_records + batch_size - 1) // batch_size}: {len(inserted_idents)} airports indexed...")

    print(f"[+] Successfully seeded {len(inserted_idents)} airports.")
    return inserted_idents

def seed_runways(client, valid_airport_idents: Set[str]) -> int:
    """Parse and seed runways table for all airports present in the database."""
    path = DATA_DIR / "airport_runway_clean.xls"
    if not path.exists():
        print(f"[!] File not found: {path}")
        return 0

    print("\n" + "=" * 70)
    print("3. SEEDING RUNWAYS")
    print("=" * 70)

    runway_rows = []
    skipped_orphan_count = 0
    with open(path, mode="r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for r in reader:
            runway_id = to_int(r.get("id_x"))
            apt_ident = clean_str(r.get("airport_ident"))

            if not runway_id or not apt_ident:
                continue

            # Only insert runway if its airport exists in our airports table (satisfies FK constraint)
            if apt_ident not in valid_airport_idents:
                skipped_orphan_count += 1
                continue

            runway_rows.append({
                "id": runway_id,
                "airport_ref": to_int(r.get("airport_ref")),
                "airport_ident": apt_ident,
                "length_ft": to_int(r.get("length_ft")),
                "width_ft": to_int(r.get("width_ft")),
                "surface": clean_str(r.get("surface")),
                "lighted": to_bool(r.get("lighted")),
                "closed": to_bool(r.get("closed")),
                "le_ident": clean_str(r.get("le_ident")),
                "le_latitude_deg": to_float(r.get("le_latitude_deg")),
                "le_longitude_deg": to_float(r.get("le_longitude_deg")),
                "le_elevation_ft": to_int(r.get("le_elevation_ft")),
                "le_heading_degt": to_float(r.get("le_heading_degT")),
                "le_displaced_threshold_ft": to_int(r.get("le_displaced_threshold_ft")),
                "he_ident": clean_str(r.get("he_ident")),
                "he_latitude_deg": to_float(r.get("he_latitude_deg")),
                "he_longitude_deg": to_float(r.get("he_longitude_deg")),
                "he_elevation_ft": to_int(r.get("he_elevation_ft")),
                "he_heading_degt": to_float(r.get("he_heading_degT")),
                "he_displaced_threshold_ft": to_int(r.get("he_displaced_threshold_ft"))
            })

    total_records = len(runway_rows)
    print(f"Matched {total_records} runways for loaded airports (Skipped {skipped_orphan_count} outside target airports).")

    # Batch upsert in chunks of 250
    batch_size = 250
    inserted = 0
    for i in range(0, total_records, batch_size):
        batch = runway_rows[i:i + batch_size]
        res = client.table("runways").upsert(batch, on_conflict="id").execute()
        inserted += len(res.data)
        print(f"  Upserted batch {i // batch_size + 1}/{(total_records + batch_size - 1) // batch_size}: {inserted} / {total_records} runways...")

    print(f"[+] Successfully seeded {inserted} runways.")
    return inserted

def main():
    print("=" * 70)
    print("NEPAL FLIGHT TRACKER - AVIATION DATASET SEEDING")
    print("=" * 70)
    start_time = time.time()

    admin_client = get_supabase_admin_client()

    aircraft_only = "--aircraft" in sys.argv or "--aircraft-only" in sys.argv
    force_flag = "--force" in sys.argv or "-f" in sys.argv

    # 1. Aircraft Specifications
    aircraft_count = seed_aircraft_specifications(admin_client, force=force_flag)

    if aircraft_only:
        elapsed = time.time() - start_time
        print("\n" + "=" * 70)
        print("AIRCRAFT SPECIFICATIONS SEEDING COMPLETE IN {:.1f} SECONDS".format(elapsed))
        print(f"  * Aircraft Models Seeded : {aircraft_count}")
        print("=" * 70)
        return

    # 2. Airports
    valid_airport_idents = seed_airports(admin_client)

    # 3. Runways (Foreign-keyed to airports)
    runway_count = seed_runways(admin_client, valid_airport_idents)

    # 4. Nepal Registered Aircraft & Specifications Junction
    nepal_aircraft_result = None
    try:
        from scripts.seed_nepal_aircraft import seed_nepal_aircraft_pipeline
        nepal_aircraft_result = seed_nepal_aircraft_pipeline(admin_client)
    except Exception as e:
        print(f"[!] Note: Nepal aircraft seeding skipped or encountered: {e}")

    elapsed = time.time() - start_time
    print("\n" + "=" * 70)
    print("SEEDING COMPLETE IN {:.1f} SECONDS".format(elapsed))
    print(f"  * Aircraft Models Seeded : {aircraft_count}")
    print(f"  * Airports Seeded        : {len(valid_airport_idents)}")
    print(f"  * Runways Seeded         : {runway_count}")
    if nepal_aircraft_result:
        print(f"  * Nepal Aircraft Seeded  : {nepal_aircraft_result.get('seeded_aircraft', 0)}")
        print(f"  * Junction Links Created : {nepal_aircraft_result.get('junction_links', 0)}")
    print("=" * 70)

if __name__ == "__main__":
    main()
