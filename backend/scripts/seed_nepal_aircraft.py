#!/usr/bin/env python3
"""
Nepal Registered Aircraft & Junction Seeding Script
Reads Nepal-aricraft-dataset.csv, seeds the `nepal_aircraft` table in Supabase,
ensures STOL and helicopter specifications exist in `aircraft_specifications`,
and generates verified links in the junction table `nepal_aircraft_specifications`.
"""

import sys
import os
import csv
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Set

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import get_settings
from app.services.supabase.client import get_supabase_admin_client, get_supabase_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Essential specifications for Nepal fleet not present in generic aircraft_df.xls
NEPAL_ADDITIONAL_SPECS = [
    {
        "model": "DHC-6-400 Twin Otter",
        "icao_type": "DHC6",
        "category": "commuter",
        "engine_type": "turboprop",
        "engine_model": "PT6A-34",
        "powerplant": "Pratt & Whitney Canada PT6A-34",
        "number_of_engines": 2,
        "n_engine": 2,
        "passenger_capacity": 19,
        "oew_kg": 3121.0,
        "owe": 3121.0,
        "mtow_kg": 5670.0,
        "mtow": 5670.0,
        "mlw_kg": 5579.0,
        "mlw": 5579.0,
        "fuel_capacity_liters": 1446.0,
        "max_fuel": 1150.0,
        "cruise_speed_kts": 150,
        "max_speed_kts": 182,
        "cruise_altitude": 25000.0,
        "nominal_range_nm": 775,
        "approach_speed_kts": 75,
        "takeoff_field_length_m": 366,
        "landing_field_length_m": 320,
        "fuselage_width": 1.750,
        "wing_span": 19.810,
        "wing_area": 39.020,
        "wing_position": "high",
        "total_length": 15.770,
        "total_height": 5.940,
        "thruster_type": "propeller",
        "energy_type": "kerosene",
        "engine_position": "wing",
        "max_power": 559.0
    },
    {
        "model": "Let L-410 Turbolet",
        "icao_type": "L410",
        "category": "commuter",
        "engine_type": "turboprop",
        "engine_model": "GE H80-200",
        "powerplant": "General Electric H80-200",
        "number_of_engines": 2,
        "n_engine": 2,
        "passenger_capacity": 19,
        "oew_kg": 4050.0,
        "owe": 4050.0,
        "mtow_kg": 6600.0,
        "mtow": 6600.0,
        "mlw_kg": 6400.0,
        "mlw": 6400.0,
        "fuel_capacity_liters": 1625.0,
        "max_fuel": 1300.0,
        "cruise_speed_kts": 200,
        "max_speed_kts": 224,
        "cruise_altitude": 20000.0,
        "nominal_range_nm": 810,
        "approach_speed_kts": 82,
        "takeoff_field_length_m": 500,
        "landing_field_length_m": 480,
        "fuselage_width": 1.920,
        "wing_span": 19.980,
        "wing_area": 35.180,
        "wing_position": "high",
        "total_length": 14.490,
        "total_height": 5.830,
        "thruster_type": "propeller",
        "energy_type": "kerosene",
        "engine_position": "wing",
        "max_power": 597.0
    },
    {
        "model": "Airbus Helicopters H125 / AS350 B3",
        "icao_type": "AS50",
        "category": "helicopter",
        "engine_type": "turboshaft",
        "engine_model": "Safran Arriel 2D",
        "powerplant": "Safran Arriel 2D",
        "number_of_engines": 1,
        "n_engine": 1,
        "passenger_capacity": 6,
        "oew_kg": 1318.0,
        "owe": 1318.0,
        "mtow_kg": 2250.0,
        "mtow": 2250.0,
        "mlw_kg": 2250.0,
        "mlw": 2250.0,
        "fuel_capacity_liters": 540.0,
        "max_fuel": 426.0,
        "cruise_speed_kts": 133,
        "max_speed_kts": 155,
        "cruise_altitude": 23000.0,
        "nominal_range_nm": 340,
        "approach_speed_kts": 60,
        "takeoff_field_length_m": 0,
        "landing_field_length_m": 0,
        "fuselage_width": 1.870,
        "wing_span": 10.690,
        "rotor_diameter": 10.690,
        "total_length": 12.940,
        "total_height": 3.340,
        "thruster_type": "rotor",
        "energy_type": "kerosene",
        "engine_position": "fuselage",
        "max_power": 632.0
    },
    {
        "model": "Bell 407GXP",
        "icao_type": "B407",
        "category": "helicopter",
        "engine_type": "turboshaft",
        "engine_model": "Rolls-Royce 250-C47B/8",
        "powerplant": "Rolls-Royce 250-C47B/8",
        "number_of_engines": 1,
        "n_engine": 1,
        "passenger_capacity": 6,
        "oew_kg": 1221.0,
        "owe": 1221.0,
        "mtow_kg": 2381.0,
        "mtow": 2381.0,
        "mlw_kg": 2381.0,
        "mlw": 2381.0,
        "fuel_capacity_liters": 492.0,
        "max_fuel": 388.0,
        "cruise_speed_kts": 133,
        "max_speed_kts": 140,
        "cruise_altitude": 18000.0,
        "nominal_range_nm": 324,
        "approach_speed_kts": 60,
        "takeoff_field_length_m": 0,
        "landing_field_length_m": 0,
        "fuselage_width": 1.500,
        "wing_span": 10.670,
        "rotor_diameter": 10.670,
        "total_length": 12.700,
        "total_height": 3.560,
        "thruster_type": "rotor",
        "energy_type": "kerosene",
        "engine_position": "fuselage",
        "max_power": 606.0
    },
    {
        "model": "Bell 505 Jet Ranger X",
        "icao_type": "B505",
        "category": "helicopter",
        "engine_type": "turboshaft",
        "engine_model": "Safran Arrius 2R",
        "powerplant": "Safran Arrius 2R",
        "number_of_engines": 1,
        "n_engine": 1,
        "passenger_capacity": 4,
        "oew_kg": 991.0,
        "owe": 991.0,
        "mtow_kg": 1669.0,
        "mtow": 1669.0,
        "mlw_kg": 1669.0,
        "mlw": 1669.0,
        "fuel_capacity_liters": 322.0,
        "max_fuel": 254.0,
        "cruise_speed_kts": 125,
        "max_speed_kts": 135,
        "cruise_altitude": 18610.0,
        "nominal_range_nm": 333,
        "approach_speed_kts": 55,
        "takeoff_field_length_m": 0,
        "landing_field_length_m": 0,
        "fuselage_width": 1.400,
        "wing_span": 11.280,
        "rotor_diameter": 11.280,
        "total_length": 12.930,
        "total_height": 3.250,
        "thruster_type": "rotor",
        "energy_type": "kerosene",
        "engine_position": "fuselage",
        "max_power": 377.0
    },
    {
        "model": "Leonardo AW139",
        "icao_type": "A139",
        "category": "helicopter",
        "engine_type": "turboshaft",
        "engine_model": "PT6C-67C",
        "powerplant": "Pratt & Whitney Canada PT6C-67C",
        "number_of_engines": 2,
        "n_engine": 2,
        "passenger_capacity": 15,
        "oew_kg": 3622.0,
        "owe": 3622.0,
        "mtow_kg": 6400.0,
        "mtow": 6400.0,
        "mlw_kg": 6400.0,
        "mlw": 6400.0,
        "fuel_capacity_liters": 2088.0,
        "max_fuel": 1645.0,
        "cruise_speed_kts": 165,
        "max_speed_kts": 167,
        "cruise_altitude": 20000.0,
        "nominal_range_nm": 573,
        "approach_speed_kts": 65,
        "takeoff_field_length_m": 0,
        "landing_field_length_m": 0,
        "fuselage_width": 2.260,
        "wing_span": 13.800,
        "rotor_diameter": 13.800,
        "total_length": 16.660,
        "total_height": 4.980,
        "thruster_type": "rotor",
        "energy_type": "kerosene",
        "engine_position": "fuselage",
        "max_power": 1142.0
    }
]

# Typecode cross-reference mapping to target specifications
TYPECODE_TO_SPEC_RULES = {
    "AT75": {"codes": ["AT75"], "models": ["ATR72-500Basic", "ATR72-500IncreasedWeight", "ATR 72-500"]},
    "AT43": {"codes": ["AT43"], "models": ["ATR42-320Basic", "ATR42-320IncreasedWeight", "ATR 42-320"]},
    "DH8D": {"codes": ["DH4", "DH8D"], "models": ["BombardierQ400", "Dash 8 Q400"]},
    "JS41": {"codes": ["J41", "JS41"], "models": ["Jetstream41"]},
    "CRJ2": {"codes": ["CR2", "CRJ2"], "models": ["BombardierCRJ200", "BombardierCRJ200ER", "BombardierCRJ200LR"]},
    "CRJ7": {"codes": ["CR7", "CRJ7"], "models": ["BombardierCRJ700", "BombardierCRJ700ER"]},
    "A320": {"codes": ["320", "A320"], "models": ["A320-200", "A320-200neo"]},
    "A319": {"codes": ["319", "A319"], "models": ["A319-100"]},
    "A332": {"codes": ["332", "A332"], "models": ["A330-200"]},
    "B752": {"codes": ["752", "B752"], "models": ["757-200"]},
    "B190": {"codes": ["BE1", "B190"], "models": ["Beech1900D", "Beech1900C"]},
    "D228": {"codes": ["D28", "D228"], "models": ["Dornier228-212", "HALDornier228-201"]},
    "D28D": {"codes": ["D28", "D28D"], "models": ["Dornier228-212"]},
    "DHC6": {"codes": ["DHC6"], "models": ["DHC-6-400 Twin Otter", "DHC-6 Twin Otter"]},
    "L410": {"codes": ["L410"], "models": ["Let L-410 Turbolet"]},
    "AS50": {"codes": ["AS50"], "models": ["Airbus Helicopters H125 / AS350 B3", "Airbus Helicopters H125"]},
    "B407": {"codes": ["B407"], "models": ["Bell 407GXP"]},
    "B505": {"codes": ["B505"], "models": ["Bell 505 Jet Ranger X"]},
    "A139": {"codes": ["A139"], "models": ["Leonardo AW139"]},
}

def clean_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip().strip("'\"")
    if not s or s.lower() in ("null", "none", ""):
        return None
    return s

def clean_date(val: Any) -> Optional[str]:
    s = clean_str(val)
    if not s:
        return None
    # If starts with 1970-01-01 or placeholder, keep or nullify if invalid
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return None

def clean_timestamp(val: Any) -> Optional[str]:
    s = clean_str(val)
    if not s:
        return None
    # e.g. 2019-02-12 17:07:06
    if len(s) >= 19 and s[4] == "-" and s[7] == "-":
        return s[:19].replace(" ", "T") + "Z"
    return None

def clean_bool(val: Any) -> bool:
    if val is None:
        return False
    s = str(val).strip().lower()
    return s in ("1", "true", "t", "yes", "y")

def find_csv_file() -> Path:
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "Nepal-aricraft-dataset.csv",
        Path(__file__).resolve().parent.parent / "Nepal-aricraft-dataset.csv",
        Path("Nepal-aricraft-dataset.csv").resolve(),
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError("Nepal-aricraft-dataset.csv not found in workspace.")

def parse_nepal_csv() -> List[Dict[str, Any]]:
    csv_path = find_csv_file()
    records = []
    with open(csv_path, mode="r", encoding="utf-8", errors="ignore") as f:
        r = csv.reader(f)
        raw_header = next(r)
        header = [c.strip().strip("'\"") for c in raw_header]
        # Clean potential typo: country' -> country
        header = ["country" if c == "country'" else c for c in header]

        for line_num, row in enumerate(r, 2):
            if not row or not any(row):
                continue
            item = {}
            for i, val in enumerate(row):
                if i < len(header):
                    col = header[i]
                    item[col] = val.strip().strip("'\"")

            icao24 = clean_str(item.get("icao24"))
            if not icao24:
                continue

            cleaned_row = {
                "icao24": icao24.lower(),
                "registration": clean_str(item.get("registration")),
                "typecode": clean_str(item.get("typecode")),
                "model": clean_str(item.get("model")),
                "manufacturer_name": clean_str(item.get("manufacturerName")),
                "manufacturer_icao": clean_str(item.get("manufacturerIcao")),
                "operator": clean_str(item.get("operator")),
                "operator_callsign": clean_str(item.get("operatorCallsign")),
                "operator_icao": clean_str(item.get("operatorIcao")),
                "operator_iata": clean_str(item.get("operatorIata")),
                "owner": clean_str(item.get("owner")),
                "serial_number": clean_str(item.get("serialNumber")),
                "icao_aircraft_class": clean_str(item.get("icaoAircraftClass")),
                "category_description": clean_str(item.get("categoryDescription")),
                "country": clean_str(item.get("country")) or "Nepal",
                "engines": clean_str(item.get("engines")),
                "built_year": clean_str(item.get("built")),
                "first_flight_date": clean_date(item.get("firstFlightDate")),
                "first_seen": clean_timestamp(item.get("firstSeen")),
                "recorded_timestamp": clean_timestamp(item.get("timestamp")),
                "registered_date": clean_date(item.get("registered")),
                "reg_until": clean_date(item.get("regUntil")),
                "status": clean_str(item.get("status")),
                "modes": clean_bool(item.get("modes")),
                "adsb": clean_bool(item.get("adsb")),
                "acars": clean_bool(item.get("acars")),
                "vdl": clean_bool(item.get("vdl")),
                "notes": clean_str(item.get("notes")),
                "sel_cal": clean_str(item.get("selCal")),
                "line_number": clean_str(item.get("lineNumber")),
                "prev_reg": clean_str(item.get("prevReg")),
                "next_reg": clean_str(item.get("nextReg")),
            }
            records.append(cleaned_row)

    logger.info(f"Parsed {len(records)} aircraft records from {csv_path.name}")
    return records

def seed_nepal_aircraft_pipeline(client=None) -> Dict[str, Any]:
    """
    Executes the seeding and linking pipeline:
    1. Seeds nepal_aircraft
    2. Ensures missing STOL/helicopter specs exist in aircraft_specifications
    3. Resolves and seeds junction records in nepal_aircraft_specifications
    """
    if client is None:
        client = get_supabase_admin_client()

    aircraft_rows = parse_nepal_csv()
    
    print("\n" + "=" * 70)
    print("NEPAL AIRCRAFT & SPECIFICATIONS JUNCTION SEEDING PIPELINE")
    print("=" * 70)

    # Step 1: Ensure missing Nepal-specific specs in aircraft_specifications
    print("\n[1] Ensuring Nepal STOL & helicopter specifications in aircraft_specifications...")
    added_specs = 0
    try:
        existing_specs_res = client.table("aircraft_specifications").select("id, model, icao_type").execute()
        existing_specs = existing_specs_res.data or []
        existing_icaos = {s["icao_type"].upper() for s in existing_specs if s.get("icao_type")}
        existing_models = {s["model"].lower() for s in existing_specs if s.get("model")}

        for spec in NEPAL_ADDITIONAL_SPECS:
            if spec["icao_type"].upper() not in existing_icaos and spec["model"].lower() not in existing_models:
                res = client.table("aircraft_specifications").insert(spec).execute()
                if res.data:
                    added_specs += 1
                    logger.info(f"  [+] Inserted spec: {spec['model']} [{spec['icao_type']}]")
        print(f"    Completed: {added_specs} additional specifications registered.")
    except Exception as e:
        logger.warning(f"    Note during specifications check: {e}")

    # Fetch updated specifications from Supabase
    all_specs_res = client.table("aircraft_specifications").select("id, model, icao_type").execute()
    all_specs = all_specs_res.data or []
    print(f"    Total active specifications in database: {len(all_specs)}")

    # Step 2: Seed nepal_aircraft table
    print("\n[2] Seeding nepal_aircraft table in Supabase...")
    batch_size = 50
    inserted_aircraft = 0
    for i in range(0, len(aircraft_rows), batch_size):
        batch = aircraft_rows[i:i + batch_size]
        res = client.table("nepal_aircraft").upsert(batch, on_conflict="icao24").execute()
        inserted_aircraft += len(res.data) if res.data else len(batch)
    print(f"    Successfully seeded {inserted_aircraft} records into 'nepal_aircraft'.")

    # Fetch seeded aircraft to obtain generated BIGINT IDs
    db_aircraft_res = client.table("nepal_aircraft").select("id, icao24, registration, typecode, model").execute()
    db_aircraft = db_aircraft_res.data or []

    # Step 3: Match and seed junction table nepal_aircraft_specifications
    print("\n[3] Generating junction links to aircraft_specifications...")
    junction_links = []
    matched_tails = set()

    for ac in db_aircraft:
        ac_id = ac["id"]
        tc = (ac.get("typecode") or "").strip().upper()
        reg = ac.get("registration") or "Unknown"

        rule = TYPECODE_TO_SPEC_RULES.get(tc)
        if not rule:
            continue

        matched_for_this_ac = []
        for s in all_specs:
            s_code = (s.get("icao_type") or "").strip().upper()
            s_model = (s.get("model") or "").strip()

            # Check ICAO or model match
            is_match = False
            match_method = "typecode_match"
            if s_code in [c.upper() for c in rule["codes"]]:
                is_match = True
                match_method = "exact_typecode" if s_code == tc else "iata_mapping"
            elif any(m.lower() in s_model.lower() for m in rule["models"]):
                is_match = True
                match_method = "model_variant"

            if is_match:
                matched_for_this_ac.append((s, match_method))

        for idx, (s, method) in enumerate(matched_for_this_ac):
            is_primary = (idx == 0)
            junction_links.append({
                "nepal_aircraft_id": ac_id,
                "specification_id": s["id"],
                "match_method": method,
                "match_confidence": 1.00,
                "is_primary": is_primary,
                "notes": f"Linked tail {reg} ({tc}) to spec {s.get('model')} [{s.get('icao_type')}]"
            })
            matched_tails.add(reg)

    print(f"    Matched {len(matched_tails)} distinct aircraft tails.")
    print(f"    Total junction pairings identified: {len(junction_links)}")

    # Insert junction links into Supabase in batches
    inserted_junctions = 0
    for i in range(0, len(junction_links), batch_size):
        batch = junction_links[i:i + batch_size]
        res = client.table("nepal_aircraft_specifications").upsert(
            batch,
            on_conflict="nepal_aircraft_id,specification_id"
        ).execute()
        inserted_junctions += len(res.data) if res.data else len(batch)

    print(f"    Successfully seeded {inserted_junctions} records into 'nepal_aircraft_specifications'.")
    print("=" * 70)
    print("SEEDING PIPELINE COMPLETED SUCCESSFULLY")
    print("=" * 70)

    return {
        "status": "success",
        "total_aircraft": len(aircraft_rows),
        "seeded_aircraft": inserted_aircraft,
        "matched_tails": len(matched_tails),
        "junction_links": inserted_junctions
    }

if __name__ == "__main__":
    try:
        res = seed_nepal_aircraft_pipeline()
        print(f"Result: {res}")
    except Exception as e:
        logger.error(f"Seeding pipeline encountered an error: {e}", exc_info=True)
        sys.exit(1)
