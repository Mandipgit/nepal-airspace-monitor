"""
Aviation Reference Data Repository
Queries airports, runways, aircraft specifications, and airlines from Supabase PostgreSQL.
Provides resilient in-memory fallbacks if remote database encounters RLS policies or network latency.
"""

import logging
from typing import Optional, List, Dict, Any
from app.services.supabase.client import get_supabase_client
from app.schemas.airport import (
    AirportSummarySchema,
    AirportDetailSchema,
    AirportListResponse,
    RunwaySchema
)
from app.schemas.aircraft import (
    AircraftSpecificationSchema,
    AircraftSpecificationListResponse,
    NepalAircraftSchema,
    NepalAircraftSpecificationJunctionSchema,
    NepalAircraftDetailSchema,
    NepalAircraftListResponse,
)

logger = logging.getLogger(__name__)

FALLBACK_NEPAL_AIRPORTS: List[Dict[str, Any]] = [
    {
        "ident": "VNKT",
        "type": "large_airport",
        "name": "Tribhuvan International Airport",
        "latitude_deg": 27.6966,
        "longitude_deg": 85.3591,
        "elevation_ft": 4390,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-BA",
        "municipality": "Kathmandu",
        "scheduled_service": True,
        "gps_code": "VNKT",
        "iata_code": "KTM",
        "local_code": "KTM"
    },
    {
        "ident": "VNPK",
        "type": "medium_airport",
        "name": "Pokhara International Airport",
        "latitude_deg": 28.2009,
        "longitude_deg": 83.9821,
        "elevation_ft": 2712,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-GA",
        "municipality": "Pokhara",
        "scheduled_service": True,
        "gps_code": "VNPK",
        "iata_code": "PKR",
        "local_code": "PKR"
    },
    {
        "ident": "VNBW",
        "type": "medium_airport",
        "name": "Gautam Buddha International Airport",
        "latitude_deg": 27.5056,
        "longitude_deg": 83.4161,
        "elevation_ft": 358,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-LU",
        "municipality": "Siddharthanagar (Bhairahawa)",
        "scheduled_service": True,
        "gps_code": "VNBW",
        "iata_code": "BWA",
        "local_code": "BWA"
    },
    {
        "ident": "VNLK",
        "type": "small_airport",
        "name": "Tenzing-Hillary Airport",
        "latitude_deg": 27.6869,
        "longitude_deg": 86.7297,
        "elevation_ft": 9334,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-SA",
        "municipality": "Lukla",
        "scheduled_service": True,
        "gps_code": "VNLK",
        "iata_code": "LUA",
        "local_code": "LUA"
    },
    {
        "ident": "VNVT",
        "type": "medium_airport",
        "name": "Biratnagar Airport",
        "latitude_deg": 26.4816,
        "longitude_deg": 87.2644,
        "elevation_ft": 236,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-KO",
        "municipality": "Biratnagar",
        "scheduled_service": True,
        "gps_code": "VNVT",
        "iata_code": "BIR",
        "local_code": "BIR"
    },
    {
        "ident": "VNNG",
        "type": "medium_airport",
        "name": "Nepalgunj Airport",
        "latitude_deg": 28.1054,
        "longitude_deg": 81.6669,
        "elevation_ft": 540,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-BH",
        "municipality": "Nepalgunj",
        "scheduled_service": True,
        "gps_code": "VNNG",
        "iata_code": "KEP",
        "local_code": "KEP"
    },
    {
        "ident": "VNCG",
        "type": "medium_airport",
        "name": "Chandragadhi / Bhadrapur Airport",
        "latitude_deg": 26.5708,
        "longitude_deg": 88.0792,
        "elevation_ft": 300,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-ME",
        "municipality": "Bhadrapur",
        "scheduled_service": True,
        "gps_code": "VNCG",
        "iata_code": "BDP",
        "local_code": "BDP"
    },
    {
        "ident": "VNDH",
        "type": "medium_airport",
        "name": "Dhangadhi Airport",
        "latitude_deg": 28.7534,
        "longitude_deg": 80.5826,
        "elevation_ft": 690,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-SE",
        "municipality": "Dhangadhi",
        "scheduled_service": True,
        "gps_code": "VNDH",
        "iata_code": "DHI",
        "local_code": "DHI"
    },
    {
        "ident": "VNJP",
        "type": "small_airport",
        "name": "Janakpur Airport",
        "latitude_deg": 26.7052,
        "longitude_deg": 85.9238,
        "elevation_ft": 256,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-JA",
        "municipality": "Janakpur",
        "scheduled_service": True,
        "gps_code": "VNJP",
        "iata_code": "JKR",
        "local_code": "JKR"
    },
    {
        "ident": "VNSI",
        "type": "small_airport",
        "name": "Simara Airport",
        "latitude_deg": 27.1610,
        "longitude_deg": 84.9815,
        "elevation_ft": 450,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-NA",
        "municipality": "Pipara Simara",
        "scheduled_service": True,
        "gps_code": "VNSI",
        "iata_code": "SIF",
        "local_code": "SIF"
    },
    {
        "ident": "VNJS",
        "type": "small_airport",
        "name": "Jomsom Airport",
        "latitude_deg": 28.7842,
        "longitude_deg": 83.7225,
        "elevation_ft": 8976,
        "continent": "AS",
        "iso_country": "NP",
        "iso_region": "NP-DH",
        "municipality": "Jomsom",
        "scheduled_service": True,
        "gps_code": "VNJS",
        "iata_code": "JMO",
        "local_code": "JMO"
    },
]

FALLBACK_AIRCRAFT_SPECS: List[Dict[str, Any]] = [
    {
        "id": 1,
        "model": "Airbus A320-200neo",
        "icao_type": "A20N",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM LEAP-1A",
        "number_of_engines": 2,
        "passenger_capacity": 180,
        "oew_kg": 44300.0,
        "mtow_kg": 79000.0,
        "mlw_kg": 67400.0,
        "fuel_capacity_liters": 26730.0,
        "cruise_speed_kts": 450,
        "max_speed_kts": 470,
        "nominal_range_nm": 3500,
        "approach_speed_kts": 135,
        "takeoff_field_length_m": 1950,
        "landing_field_length_m": 1500
    },
    {
        "id": 2,
        "model": "Boeing 737-800",
        "icao_type": "B738",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM56-7B",
        "number_of_engines": 2,
        "passenger_capacity": 186,
        "oew_kg": 41413.0,
        "mtow_kg": 79010.0,
        "mlw_kg": 66360.0,
        "fuel_capacity_liters": 26020.0,
        "cruise_speed_kts": 453,
        "max_speed_kts": 475,
        "nominal_range_nm": 2935,
        "approach_speed_kts": 142,
        "takeoff_field_length_m": 2300,
        "landing_field_length_m": 1400
    },
    {
        "id": 3,
        "model": "ATR 72-500",
        "icao_type": "AT72",
        "category": "regional",
        "engine_type": "turboprop",
        "engine_model": "PW127F",
        "number_of_engines": 2,
        "passenger_capacity": 72,
        "oew_kg": 13311.0,
        "mtow_kg": 22800.0,
        "mlw_kg": 22350.0,
        "fuel_capacity_liters": 6400.0,
        "cruise_speed_kts": 276,
        "max_speed_kts": 285,
        "nominal_range_nm": 825,
        "approach_speed_kts": 115,
        "takeoff_field_length_m": 1220,
        "landing_field_length_m": 1050
    },
    {
        "id": 4,
        "model": "Airbus A321-200",
        "icao_type": "A321",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM56-5B / V2500",
        "number_of_engines": 2,
        "passenger_capacity": 220,
        "oew_kg": 48500.0,
        "mtow_kg": 93500.0,
        "mlw_kg": 77800.0,
        "fuel_capacity_liters": 29680.0,
        "cruise_speed_kts": 454,
        "max_speed_kts": 473,
        "nominal_range_nm": 3200,
        "approach_speed_kts": 138,
        "takeoff_field_length_m": 2180,
        "landing_field_length_m": 1580
    },
    {
        "id": 5,
        "model": "Airbus A320-200",
        "icao_type": "A320",
        "category": "commercial",
        "engine_type": "turbofan",
        "engine_model": "CFM56-5B / IAE V2500",
        "number_of_engines": 2,
        "passenger_capacity": 180,
        "oew_kg": 42600.0,
        "mtow_kg": 78000.0,
        "mlw_kg": 66000.0,
        "fuel_capacity_liters": 24210.0,
        "cruise_speed_kts": 447,
        "max_speed_kts": 470,
        "nominal_range_nm": 3300,
        "approach_speed_kts": 135,
        "takeoff_field_length_m": 2090,
        "landing_field_length_m": 1530
    },
    {
        "id": 6,
        "model": "ATR 42-500",
        "icao_type": "AT45",
        "category": "regional",
        "engine_type": "turboprop",
        "engine_model": "PW127E",
        "number_of_engines": 2,
        "passenger_capacity": 48,
        "oew_kg": 11250.0,
        "mtow_kg": 18600.0,
        "mlw_kg": 18300.0,
        "fuel_capacity_liters": 5700.0,
        "cruise_speed_kts": 285,
        "max_speed_kts": 300,
        "nominal_range_nm": 715,
        "approach_speed_kts": 110,
        "takeoff_field_length_m": 1165,
        "landing_field_length_m": 1025
    },
    {
        "id": 7,
        "model": "De Havilland Dash 8 Q400",
        "icao_type": "DH8D",
        "category": "regional",
        "engine_type": "turboprop",
        "engine_model": "PW150A",
        "number_of_engines": 2,
        "passenger_capacity": 78,
        "oew_kg": 17819.0,
        "mtow_kg": 29257.0,
        "mlw_kg": 28009.0,
        "fuel_capacity_liters": 6526.0,
        "cruise_speed_kts": 360,
        "max_speed_kts": 367,
        "nominal_range_nm": 1100,
        "approach_speed_kts": 125,
        "takeoff_field_length_m": 1402,
        "landing_field_length_m": 1280
    },
    {
        "id": 8,
        "model": "DHC-6 Twin Otter",
        "icao_type": "DHC6",
        "category": "commuter",
        "engine_type": "turboprop",
        "engine_model": "PT6A-27",
        "number_of_engines": 2,
        "passenger_capacity": 19,
        "oew_kg": 3363.0,
        "mtow_kg": 5670.0,
        "mlw_kg": 5579.0,
        "fuel_capacity_liters": 1446.0,
        "cruise_speed_kts": 150,
        "max_speed_kts": 180,
        "nominal_range_nm": 775,
        "approach_speed_kts": 75,
        "takeoff_field_length_m": 366,
        "landing_field_length_m": 320
    },
    {
        "id": 9,
        "model": "Let L-410 Turbolet",
        "icao_type": "L410",
        "category": "commuter",
        "engine_type": "turboprop",
        "engine_model": "GE H80-200",
        "number_of_engines": 2,
        "passenger_capacity": 19,
        "oew_kg": 4050.0,
        "mtow_kg": 6600.0,
        "mlw_kg": 6400.0,
        "fuel_capacity_liters": 1625.0,
        "cruise_speed_kts": 200,
        "max_speed_kts": 224,
        "nominal_range_nm": 810,
        "approach_speed_kts": 82,
        "takeoff_field_length_m": 500,
        "landing_field_length_m": 480
    },
    {
        "id": 10,
        "model": "Airbus Helicopters H125 / AS350 B3",
        "icao_type": "AS50",
        "category": "helicopter",
        "engine_type": "turboshaft",
        "engine_model": "Safran Arriel 2D",
        "number_of_engines": 1,
        "passenger_capacity": 6,
        "oew_kg": 1318.0,
        "mtow_kg": 2250.0,
        "mlw_kg": 2250.0,
        "fuel_capacity_liters": 540.0,
        "cruise_speed_kts": 133,
        "max_speed_kts": 155,
        "nominal_range_nm": 340,
        "approach_speed_kts": 60,
        "takeoff_field_length_m": 0,
        "landing_field_length_m": 0
    },
    {
        "id": 11,
        "model": "Bell 407GXP",
        "icao_type": "B407",
        "category": "helicopter",
        "engine_type": "turboshaft",
        "engine_model": "Rolls-Royce 250-C47B/8",
        "number_of_engines": 1,
        "passenger_capacity": 6,
        "oew_kg": 1221.0,
        "mtow_kg": 2381.0,
        "mlw_kg": 2381.0,
        "fuel_capacity_liters": 492.0,
        "cruise_speed_kts": 133,
        "max_speed_kts": 140,
        "nominal_range_nm": 324,
        "approach_speed_kts": 60,
        "takeoff_field_length_m": 0,
        "landing_field_length_m": 0
    },
    {
        "id": 12,
        "model": "Bell 505 Jet Ranger X",
        "icao_type": "B505",
        "category": "helicopter",
        "engine_type": "turboshaft",
        "engine_model": "Safran Arrius 2R",
        "number_of_engines": 1,
        "passenger_capacity": 4,
        "oew_kg": 991.0,
        "mtow_kg": 1669.0,
        "mlw_kg": 1669.0,
        "fuel_capacity_liters": 322.0,
        "cruise_speed_kts": 125,
        "max_speed_kts": 135,
        "nominal_range_nm": 333,
        "approach_speed_kts": 55,
        "takeoff_field_length_m": 0,
        "landing_field_length_m": 0
    },
    {
        "id": 13,
        "model": "Leonardo AW139",
        "icao_type": "A139",
        "category": "helicopter",
        "engine_type": "turboshaft",
        "engine_model": "Pratt & Whitney Canada PT6C-67C",
        "number_of_engines": 2,
        "passenger_capacity": 15,
        "oew_kg": 3622.0,
        "mtow_kg": 6400.0,
        "mlw_kg": 6400.0,
        "fuel_capacity_liters": 2088.0,
        "cruise_speed_kts": 165,
        "max_speed_kts": 167,
        "nominal_range_nm": 573,
        "approach_speed_kts": 65,
        "takeoff_field_length_m": 0,
        "landing_field_length_m": 0
    }
]


import csv
import re
from pathlib import Path

class AviationRepository:
    """Repository handling database lookups for airports, runways, and aircraft."""

    def __init__(self):
        self._airport_cache: Dict[str, AirportDetailSchema] = {}
        self._aircraft_cache: Dict[str, AircraftSpecificationSchema] = {}
        self._fallback_airports: Optional[List[AirportSummarySchema]] = None
        self._fallback_runways: Optional[Dict[str, List[RunwaySchema]]] = None
        self._fallback_aircraft_specs: Optional[List[AircraftSpecificationSchema]] = None
        self._fallback_nepal_aircraft: Optional[List[NepalAircraftDetailSchema]] = None
        self._image_map: Dict[str, str] = {}

        # Load manifest-based airport image mapping for instant resolution
        for candidate_manifest in [
            Path(__file__).resolve().parent.parent.parent.parent.parent / "airport-images" / "manifest.csv",
            Path("airport-images/manifest.csv").resolve(),
            Path("../airport-images/manifest.csv").resolve(),
        ]:
            if candidate_manifest.exists():
                try:
                    with open(candidate_manifest, mode="r", encoding="utf-8-sig") as mf:
                        for row in csv.DictReader(mf):
                            ident = (row.get("ident") or "").strip().upper()
                            loc_type = (row.get("type") or "airport").strip().lower()
                            if ident:
                                folder = "airports" if loc_type == "airport" else "heliports"
                                self._image_map[ident] = f"{folder}/{ident}.webp"
                    break
                except Exception as e:
                    logger.warning(f"Could not load airport-images/manifest.csv: {e}")

    def _get_client(self):
        return get_supabase_client()

    def _get_public_image_url(self, image_path: Optional[str]) -> Optional[str]:
        """Generate canonical public Supabase Storage URL for airport image."""
        if not image_path:
            return None
        from app.config import get_settings
        base_url = get_settings().get_canonical_supabase_url()
        if not base_url:
            return None
        clean_path = image_path.lstrip("/")
        return f"{base_url}/storage/v1/object/public/airport-images/{clean_path}"

    def _get_raw_data_dir(self) -> Path:
        for candidate in [
            Path(__file__).resolve().parent.parent.parent.parent.parent / "data" / "raw",
            Path(__file__).resolve().parent.parent.parent.parent / "data" / "raw",
            Path("data/raw").resolve(),
            Path("../data/raw").resolve(),
        ]:
            if candidate.exists():
                return candidate
        return Path(__file__).resolve().parent.parent.parent.parent.parent / "data" / "raw"

    def _load_fallback_airports(self) -> List[AirportSummarySchema]:
        """Lazy load airports from local data/raw/airports.xls or static fallback."""
        if self._fallback_airports is not None:
            return self._fallback_airports

        airports_file = self._get_raw_data_dir() / "airports.xls"
        loaded: List[AirportSummarySchema] = []
        if airports_file.exists():
            try:
                with open(airports_file, mode="r", encoding="utf-8", errors="ignore") as f:
                    for row in csv.DictReader(f):
                        try:
                            apt_ident = row["ident"].strip().upper()
                            img_path = row.get("image_path") or self._image_map.get(apt_ident)
                            loaded.append(AirportSummarySchema(
                                ident=row["ident"].strip(),
                                type=row.get("type"),
                                name=row.get("name") or row["ident"],
                                latitude_deg=float(row["latitude_deg"]) if row.get("latitude_deg") else 0.0,
                                longitude_deg=float(row["longitude_deg"]) if row.get("longitude_deg") else 0.0,
                                elevation_ft=int(float(row["elevation_ft"])) if row.get("elevation_ft") else None,
                                continent=row.get("continent"),
                                iso_country=row.get("iso_country"),
                                iso_region=row.get("iso_region"),
                                municipality=row.get("municipality"),
                                scheduled_service=str(row.get("scheduled_service", "")).lower() in ["yes", "true", "1"],
                                gps_code=row.get("gps_code"),
                                iata_code=row.get("iata_code"),
                                local_code=row.get("local_code"),
                                image_path=img_path,
                                image_url=self._get_public_image_url(img_path)
                            ))
                        except Exception:
                            continue
            except Exception as e:
                logger.warning(f"Could not parse offline airports.xls: {e}")

        if not loaded:
            loaded = []
            for a in FALLBACK_NEPAL_AIRPORTS:
                a_copy = dict(a)
                fb_ident = a_copy["ident"].upper()
                fb_img_path = self._image_map.get(fb_ident)
                a_copy["image_path"] = fb_img_path
                a_copy["image_url"] = self._get_public_image_url(fb_img_path)
                loaded.append(AirportSummarySchema(**a_copy))

        self._fallback_airports = loaded
        return self._fallback_airports

    def _load_fallback_runways(self) -> Dict[str, List[RunwaySchema]]:
        """Lazy load runways from local data/raw/airport_runway_clean.xls."""
        if self._fallback_runways is not None:
            return self._fallback_runways

        runways_file = self._get_raw_data_dir() / "airport_runway_clean.xls"
        runway_map: Dict[str, List[RunwaySchema]] = {}
        if runways_file.exists():
            try:
                with open(runways_file, mode="r", encoding="utf-8", errors="ignore") as f:
                    for idx, row in enumerate(csv.DictReader(f), 1):
                        ident = (row.get("airport_ident") or "").strip().upper()
                        if not ident:
                            continue
                        try:
                            l_ft = int(float(row["length_ft"])) if row.get("length_ft") else None
                            w_ft = int(float(row["width_ft"])) if row.get("width_ft") else None
                            l_m = float(row["runway_length_m"]) if row.get("runway_length_m") else (round(l_ft * 0.3048, 1) if l_ft else None)
                            w_m = round(w_ft * 0.3048, 1) if w_ft else None

                            rw = RunwaySchema(
                                id=idx,
                                airport_ident=ident,
                                length_ft=l_ft,
                                width_ft=w_ft,
                                length_m=l_m,
                                width_m=w_m,
                                surface=row.get("surface"),
                                lighted=str(row.get("lighted", "")).lower() in ["1", "true", "yes"],
                                closed=str(row.get("closed", "")).lower() in ["1", "true", "yes"],
                                le_ident=row.get("le_ident"),
                                le_latitude_deg=float(row["le_latitude_deg"]) if row.get("le_latitude_deg") else None,
                                le_longitude_deg=float(row["le_longitude_deg"]) if row.get("le_longitude_deg") else None,
                                le_elevation_ft=int(float(row["le_elevation_ft"])) if row.get("le_elevation_ft") else None,
                                le_heading_degt=float(row["le_heading_degT"]) if row.get("le_heading_degT") else None,
                                le_displaced_threshold_ft=int(float(row["le_displaced_threshold_ft"])) if row.get("le_displaced_threshold_ft") else None,
                                he_ident=row.get("he_ident"),
                                he_latitude_deg=float(row["he_latitude_deg"]) if row.get("he_latitude_deg") else None,
                                he_longitude_deg=float(row["he_longitude_deg"]) if row.get("he_longitude_deg") else None,
                                he_elevation_ft=int(float(row["he_elevation_ft"])) if row.get("he_elevation_ft") else None,
                                he_heading_degt=float(row["he_heading_degT"]) if row.get("he_heading_degT") else None,
                                he_displaced_threshold_ft=int(float(row["he_displaced_threshold_ft"])) if row.get("he_displaced_threshold_ft") else None
                            )
                            runway_map.setdefault(ident, []).append(rw)
                        except Exception:
                            continue
            except Exception as e:
                logger.warning(f"Could not parse offline airport_runway_clean.xls: {e}")

        # Ensure Tribhuvan (VNKT) has accurate international runway specifications
        if "VNKT" not in runway_map or not runway_map["VNKT"]:
            runway_map["VNKT"] = [
                RunwaySchema(
                    id=1,
                    airport_ident="VNKT",
                    length_ft=10991,
                    width_ft=148,
                    length_m=3350.1,
                    width_m=45.1,
                    surface="ASP",
                    lighted=True,
                    closed=False,
                    le_ident="02",
                    le_latitude_deg=27.6841,
                    le_longitude_deg=85.3567,
                    le_elevation_ft=4390,
                    le_heading_degt=21.0,
                    he_ident="20",
                    he_latitude_deg=27.7122,
                    he_longitude_deg=85.3683,
                    he_elevation_ft=4340,
                    he_heading_degt=201.0
                )
            ]

        self._fallback_runways = runway_map
        return self._fallback_runways

    def _load_fallback_aircraft_specs(self) -> List[AircraftSpecificationSchema]:
        """Lazy load aircraft specifications from local data/raw/aircraft_df.xls or root aircraft_df.xls or static fallback."""
        if self._fallback_aircraft_specs is not None:
            return self._fallback_aircraft_specs

        ac_file = self._get_raw_data_dir() / "aircraft_df.xls"
        if not ac_file.exists():
            root_file = Path(__file__).resolve().parent.parent.parent.parent.parent / "aircraft_df.xls"
            if root_file.exists():
                ac_file = root_file

        loaded: List[AircraftSpecificationSchema] = []
        if ac_file.exists():
            try:
                with open(ac_file, mode="r", encoding="utf-8", errors="ignore") as f:
                    for idx, row in enumerate(csv.DictReader(f), 1):
                        try:
                            model_name = row.get("name") or f"Model-{idx}"
                            raw_cruise = float(row.get("cruise_speed_kmh") or row.get("cruise_speed") or 0)
                            if 0 < raw_cruise < 2.0:
                                raw_cruise = raw_cruise * 1062.0
                            cruise_kts = int(raw_cruise / 1.852) if raw_cruise > 0 else None
                            max_speed_val = float(row.get("max_speed_kmh") or row.get("max_speed") or 0)
                            if 0 < max_speed_val < 2.0:
                                max_speed_val = max_speed_val * 1062.0
                            max_kts = int(max_speed_val / 1.852) if max_speed_val > 0 else None

                            nominal_km = float(row.get("nominal_range") or 0)
                            range_nm = round(nominal_km / 1.852) if nominal_km > 0 else None

                            app_kmh = float(row.get("approach_speed") or 0)
                            app_kts = round(app_kmh / 1.852) if app_kmh > 0 else None

                            # Dimensions (m, deg, m2)
                            f_width = float(row["fuselage_width"]) if row.get("fuselage_width") else None
                            w_span = float(row["wing_span"]) if row.get("wing_span") else None
                            w_sweep = float(row["wing_sweep25"]) if row.get("wing_sweep25") else None
                            w_area = float(row["wing_area"]) if row.get("wing_area") else None
                            w_pos = row.get("wing_position") or None
                            h_area = float(row["htp_area"]) if row.get("htp_area") else None
                            v_area = float(row["vtp_area"]) if row.get("vtp_area") else None
                            t_len = float(row["total_length"]) if row.get("total_length") else None
                            t_height = float(row["total_height"]) if row.get("total_height") else None

                            # Propulsion & Powerplant
                            thruster = row.get("thruster_type") or None
                            p_plant = row.get("powerplant") or None
                            bpr_val = float(row["bpr"]) if row.get("bpr") else None
                            e_type = row.get("energy_type") or None
                            e_pos = row.get("engine_position") or None
                            e_arm = float(row["engine_y_arm"]) if row.get("engine_y_arm") else None
                            r_diam = float(row["rotor_diameter"]) if row.get("rotor_diameter") else None
                            m_pow = float(row["max_power"]) if row.get("max_power") else None
                            m_pow2 = float(row["max_power_2"]) if row.get("max_power_2") else None
                            m_thrust = float(row["max_thrust"]) if row.get("max_thrust") else None

                            # Altitudes & weights
                            c_alt = float(row["cruise_altitude"]) if row.get("cruise_altitude") else None
                            owe_val = float(row["owe"]) if row.get("owe") else None
                            mtow_val = float(row["mtow"]) if row.get("mtow") else None
                            mlw_val = float(row["mlw"]) if row.get("mlw") else None
                            fuel_val = float(row["max_fuel"]) if row.get("max_fuel") else None
                            n_eng = int(float(row["n_engine"])) if row.get("n_engine") else 2

                            loaded.append(AircraftSpecificationSchema(
                                    id=idx,
                                    model=model_name,
                                    icao_type=row.get("iata_code") or row.get("airplane_type") or "GEN",
                                    category=row.get("airplane_type") or "commercial",
                                    engine_type=row.get("engine_type"),
                                    engine_model=p_plant,
                                    powerplant=p_plant,
                                    number_of_engines=n_eng,
                                    n_engine=n_eng,
                                    passenger_capacity=int(float(row["n_pax"])) if row.get("n_pax") else None,
                                    oew_kg=owe_val,
                                    owe=owe_val,
                                    mtow_kg=mtow_val,
                                    mtow=mtow_val,
                                    mlw_kg=mlw_val,
                                    mlw=mlw_val,
                                    fuel_capacity_liters=fuel_val,
                                    max_fuel=fuel_val,
                                    cruise_speed_kts=cruise_kts,
                                    max_speed_kts=max_kts,
                                    cruise_altitude=c_alt,
                                    nominal_range_nm=range_nm,
                                    approach_speed_kts=app_kts,
                                    takeoff_field_length_m=int(float(row["tofl"])) if row.get("tofl") else None,
                                    landing_field_length_m=int(float(row["lfl"])) if row.get("lfl") else None,
                                    fuselage_width=f_width,
                                    wing_span=w_span,
                                    wing_sweep25=w_sweep,
                                    wing_area=w_area,
                                    wing_position=w_pos,
                                    htp_area=h_area,
                                    vtp_area=v_area,
                                    total_length=t_len,
                                    total_height=t_height,
                                    thruster_type=thruster,
                                    bpr=bpr_val,
                                    energy_type=e_type,
                                    engine_position=e_pos,
                                    engine_y_arm=e_arm,
                                    rotor_diameter=r_diam,
                                    max_power=m_pow,
                                    max_power_2=m_pow2,
                                    max_thrust=m_thrust
                                ))
                        except Exception:
                            continue
            except Exception as e:
                logger.warning(f"Could not parse offline aircraft_df.xls: {e}")

        if not loaded:
            loaded = [AircraftSpecificationSchema(**s) for s in FALLBACK_AIRCRAFT_SPECS]
        else:
            # Ensure Nepal-specific fleet models (Twin Otter, L-410, H125, Bell, AW139) are present
            existing_icaos = {(s.icao_type or "").upper() for s in loaded}
            existing_models = {s.model.upper() for s in loaded}
            curr_id = len(loaded) + 1
            for fb in FALLBACK_AIRCRAFT_SPECS:
                fb_model = fb.get("model", "").upper()
                if fb_model not in existing_models:
                    fb_copy = dict(fb)
                    fb_copy["id"] = curr_id
                    curr_id += 1
                    loaded.append(AircraftSpecificationSchema(**fb_copy))
                    existing_models.add(fb_model)
                    if fb.get("icao_type"):
                        existing_icaos.add(fb["icao_type"].upper())

        self._fallback_aircraft_specs = loaded
        return self._fallback_aircraft_specs

    def _find_fallback_spec(self, identifier: str) -> Optional[AircraftSpecificationSchema]:
        """
        Find matching aircraft specification in catalog using prioritized multi-stage resolution:
        1. Exact case-insensitive model match
        2. Exact alphanumeric normalized model match (e.g. ATR72-500Basic vs ATR72500BASIC)
        3. Exact ICAO typecode match (e.g. AT72, DHC6, A20N)
        4. Model prefix / extension match (ranked by closest length)
        5. Substring model match (ranked by closest length)
        6. Token overlap match (e.g. DHC-6-400 Twin Otter vs DHC-6 Twin Otter)
        """
        specs = self._load_fallback_aircraft_specs()
        raw_key = identifier.strip()
        clean_key = re.sub(r"[^A-Z0-9]", "", raw_key.upper())
        if not clean_key:
            return None

        # Pass 1: Exact case-insensitive model match
        for s in specs:
            if s.model.strip().upper() == raw_key.upper():
                return s

        # Pass 2: Exact normalized clean model match
        for s in specs:
            clean_model = re.sub(r"[^A-Z0-9]", "", s.model.upper())
            if clean_model == clean_key:
                return s

        # Pass 3: Exact ICAO code match
        for s in specs:
            clean_icao = re.sub(r"[^A-Z0-9]", "", (s.icao_type or "").upper())
            if clean_icao and clean_icao == clean_key:
                return s

        # Pass 4: Model prefix / starts-with match
        prefix_cands = []
        for s in specs:
            clean_model = re.sub(r"[^A-Z0-9]", "", s.model.upper())
            if clean_model.startswith(clean_key) or clean_key.startswith(clean_model):
                prefix_cands.append((abs(len(clean_model) - len(clean_key)), s))
        if prefix_cands:
            prefix_cands.sort(key=lambda x: x[0])
            return prefix_cands[0][1]

        # Pass 5: Model substring containment
        sub_cands = []
        for s in specs:
            clean_model = re.sub(r"[^A-Z0-9]", "", s.model.upper())
            if clean_key in clean_model or clean_model in clean_key:
                sub_cands.append((abs(len(clean_model) - len(clean_key)), s))
        if sub_cands:
            sub_cands.sort(key=lambda x: x[0])
            return sub_cands[0][1]

        # Pass 6: Token overlap
        key_tokens = set(re.findall(r"[A-Z0-9]+", raw_key.upper()))
        token_cands = []
        for s in specs:
            model_tokens = set(re.findall(r"[A-Z0-9]+", s.model.upper()))
            overlap = key_tokens & model_tokens
            if overlap and (overlap == model_tokens or overlap == key_tokens or len(overlap) >= 2):
                token_cands.append((len(overlap), abs(len(s.model) - len(raw_key)), s))
        if token_cands:
            token_cands.sort(key=lambda x: (-x[0], x[1]))
            return token_cands[0][2]

        return None

    async def get_airports(
        self,
        country: Optional[str] = None,
        query: Optional[str] = None,
        scheduled_only: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> AirportListResponse:
        """Query airports with optional filtering by country, search string, or scheduled service."""
        try:
            client = self._get_client()
            builder = client.table("airports").select(
                "ident, type, name, latitude_deg, longitude_deg, elevation_ft, continent, iso_country, iso_region, municipality, scheduled_service, gps_code, iata_code, local_code, image_path",
                count="exact"
            )

            if country:
                builder = builder.eq("iso_country", country.upper())
            if scheduled_only:
                builder = builder.eq("scheduled_service", True)
            if query:
                q = f"%{query.strip()}%"
                builder = builder.or_(f"ident.ilike.{q},name.ilike.{q},iata_code.ilike.{q},municipality.ilike.{q}")

            builder = builder.order("scheduled_service", desc=True).order("name").range(offset, offset + limit - 1)
            res = builder.execute()

            airports = []
            for item in res.data:
                d = dict(item)
                img_path = d.get("image_path") or self._image_map.get((d.get("ident") or "").upper())
                d["image_path"] = img_path
                d["image_url"] = self._get_public_image_url(img_path)
                airports.append(AirportSummarySchema(**d))

            total = res.count if res.count is not None else len(airports)
            if airports:
                return AirportListResponse(total=total, airports=airports)
        except Exception as e:
            logger.debug(f"Supabase get_airports returned exception ({e}); using offline airport catalog.")

        # Fallback to local catalog
        catalog = self._load_fallback_airports()
        matched = []
        for apt in catalog:
            if country and (apt.iso_country or "").upper() != country.upper():
                continue
            if scheduled_only and not apt.scheduled_service:
                continue
            if query:
                q_clean = query.strip().upper()
                ident = (apt.ident or "").upper()
                name = (apt.name or "").upper()
                iata = (apt.iata_code or "").upper()
                if q_clean not in ident and q_clean not in name and q_clean not in iata:
                    continue
            matched.append(apt)

        total = len(matched)
        slice_result = matched[offset:offset + limit]
        return AirportListResponse(total=total, airports=slice_result)

    async def get_nepal_airports(self) -> AirportListResponse:
        """Retrieve all airports and heliports within Nepal."""
        return await self.get_airports(country="NP", limit=100)

    async def get_airport_by_ident(self, ident: str) -> Optional[AirportDetailSchema]:
        """Fetch detailed airport record including all physical runways."""
        target_ident = ident.upper().strip()

        # Check in-memory detail cache first
        if target_ident in self._airport_cache:
            return self._airport_cache[target_ident]

        try:
            client = self._get_client()
            apt_res = client.table("airports").select("*").eq("ident", target_ident).limit(1).execute()
            if apt_res.data:
                apt_data = dict(apt_res.data[0])
                img_path = apt_data.get("image_path") or self._image_map.get(target_ident)
                apt_data["image_path"] = img_path
                apt_data["image_url"] = self._get_public_image_url(img_path)

                runways_res = client.table("runways").select("*").eq("airport_ident", target_ident).order("length_ft", desc=True).execute()
                runways = [RunwaySchema(**r) for r in runways_res.data]
                detail = AirportDetailSchema(**apt_data, runways=runways)
                self._airport_cache[target_ident] = detail
                return detail
        except Exception as e:
            logger.debug(f"Supabase get_airport_by_ident failed for {target_ident}: {e}")

        # Fallback to offline airport catalog & runways
        catalog = self._load_fallback_airports()
        runway_map = self._load_fallback_runways()
        for apt in catalog:
            if apt.ident.upper() == target_ident:
                runways = runway_map.get(target_ident, [])
                if not runways:
                    runways = [
                        RunwaySchema(
                            id=1,
                            airport_ident=target_ident,
                            length_ft=10991 if target_ident == "VNKT" else (10000 if apt.type == "large_airport" else 4000),
                            width_ft=150,
                            surface="ASP",
                            lighted=True,
                            closed=False,
                            le_ident="02" if target_ident == "VNKT" else "01",
                            he_ident="20" if target_ident == "VNKT" else "19"
                        )
                    ]
                detail_dict = apt.model_dump()
                img_path = detail_dict.get("image_path") or self._image_map.get(target_ident)
                detail_dict["image_path"] = img_path
                detail_dict["image_url"] = self._get_public_image_url(img_path)
                detail = AirportDetailSchema(**detail_dict, runways=runways)
                self._airport_cache[target_ident] = detail
                return detail

        return None

    async def find_nepal_airport(self, query: str) -> Optional[AirportDetailSchema]:
        """
        Find an airport in Nepal by ICAO ident, IATA code, GPS/local code,
        municipality/city, or full airport name.
        """
        raw_q = query.strip()
        if not raw_q:
            return None
        q = raw_q.upper()

        # Direct in-memory cache hit if ident is already cached
        if q in self._airport_cache and (
            (self._airport_cache[q].iso_country or "").upper() == "NP" or
            self._airport_cache[q].ident.upper().startswith("VN")
        ):
            return self._airport_cache[q]

        # 1. Supabase attempt if configured and reachable
        try:
            client = self._get_client()
            res = client.table("airports").select("ident").eq("iso_country", "NP").or_(
                f"ident.eq.{q},iata_code.eq.{q},gps_code.eq.{q},local_code.eq.{q}"
            ).limit(1).execute()
            if res.data:
                return await self.get_airport_by_ident(res.data[0]["ident"])

            res_name = client.table("airports").select("ident").eq("iso_country", "NP").or_(
                f"name.ilike.%{raw_q}%,municipality.ilike.%{raw_q}%"
            ).order("scheduled_service", desc=True).limit(1).execute()
            if res_name.data:
                return await self.get_airport_by_ident(res_name.data[0]["ident"])
        except Exception as e:
            logger.debug(f"Supabase find_nepal_airport lookup fallback: {e}")

        # 2. Local offline Nepal catalog search
        catalog = self._load_fallback_airports()
        nepal_airports = [
            a for a in catalog 
            if (a.iso_country or "").upper() == "NP" or (a.ident or "").upper().startswith("VN")
        ]

        # Priority 1: Exact matches on ident, iata_code, gps_code, local_code
        for a in nepal_airports:
            if (a.ident or "").upper() == q:
                return await self.get_airport_by_ident(a.ident)
        for a in nepal_airports:
            if (a.iata_code or "").upper() == q:
                return await self.get_airport_by_ident(a.ident)
        for a in nepal_airports:
            if (a.gps_code or "").upper() == q or (a.local_code or "").upper() == q:
                return await self.get_airport_by_ident(a.ident)

        # Priority 2: Exact matches on name or municipality
        for a in nepal_airports:
            if (a.name or "").upper() == q:
                return await self.get_airport_by_ident(a.ident)
        for a in nepal_airports:
            if (a.municipality or "").upper() == q:
                return await self.get_airport_by_ident(a.ident)

        # Priority 3: Substring matches in name or municipality
        for a in nepal_airports:
            if q in (a.name or "").upper():
                return await self.get_airport_by_ident(a.ident)
        for a in nepal_airports:
            if a.municipality and q in a.municipality.upper():
                return await self.get_airport_by_ident(a.ident)

        # Priority 4: Distinctive word token match (e.g. "Tribhuvan", "Pokhara", "Lukla")
        tokens = [
            w for w in re.split(r"[^A-Z0-9]+", q)
            if len(w) >= 3 and w not in ["AIRPORT", "INTL", "INTERNATIONAL", "DOMESTIC", "THE"]
        ]
        if tokens:
            best_match = None
            best_score = 0
            for a in nepal_airports:
                name_upper = (a.name or "").upper()
                muni_upper = (a.municipality or "").upper()
                score = sum(1 for t in tokens if t in name_upper or t in muni_upper)
                if a.scheduled_service:
                    score += 0.5
                if score > best_score:
                    best_score = score
                    best_match = a
            if best_match and best_score >= 1:
                return await self.get_airport_by_ident(best_match.ident)

        return None

    async def get_aircraft_spec(self, identifier: str) -> Optional[AircraftSpecificationSchema]:
        """Fetch specifications by aircraft model name or ICAO type code."""
        key = identifier.upper().strip()
        if key in self._aircraft_cache:
            return self._aircraft_cache[key]

        # Check offline catalog first for instant zero-latency specification resolution
        fb_spec = self._find_fallback_spec(key)
        if fb_spec:
            self._aircraft_cache[key] = fb_spec
            return fb_spec

        try:
            client = self._get_client()
            res = client.table("aircraft_specifications").select("*").or_(f"model.ilike.%{key}%,icao_type.eq.{key}").limit(1).execute()
            if res.data:
                data = dict(res.data[0])
                fb = self._find_fallback_spec(data.get("model", "") or key)
                if fb:
                    for k, v in fb.model_dump().items():
                        if data.get(k) is None and v is not None:
                            data[k] = v
                spec = AircraftSpecificationSchema(**data)
                self._aircraft_cache[key] = spec
                return spec
        except Exception as e:
            logger.debug(f"Supabase get_aircraft_spec lookup failed for {key}: {e}")

        return None

    async def get_aircraft_specs_bulk(self, identifiers: List[str]) -> Dict[str, AircraftSpecificationSchema]:
        """Bulk fetch aircraft specifications by identifiers, caching and deduplicating queries."""
        results: Dict[str, AircraftSpecificationSchema] = {}
        missing_keys: List[str] = []

        for ident in identifiers:
            key = ident.strip()
            if not key:
                continue
            cache_key = key.upper()
            if cache_key in self._aircraft_cache:
                results[key] = self._aircraft_cache[cache_key]
            else:
                missing_keys.append(key)

        if not missing_keys:
            return results

        for key in missing_keys:
            spec = await self.get_aircraft_spec(key)
            if spec:
                results[key] = spec

        return results

    async def search_aircraft_specs(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> AircraftSpecificationListResponse:
        """Search aircraft specifications by query string or category."""
        try:
            client = self._get_client()
            builder = client.table("aircraft_specifications").select("*", count="exact")

            if category:
                builder = builder.eq("category", category.lower().strip())
            if query:
                q = f"%{query.strip()}%"
                builder = builder.or_(f"model.ilike.{q},icao_type.ilike.{q},engine_type.ilike.{q}")

            builder = builder.order("model").range(offset, offset + limit - 1)
            res = builder.execute()

            data_items = []
            for item in res.data:
                d = dict(item)
                fb = self._find_fallback_spec(d.get("model", "") or d.get("icao_type", ""))
                if fb:
                    for k, v in fb.model_dump().items():
                        if d.get(k) is None and v is not None:
                            d[k] = v
                data_items.append(d)

            specs = [AircraftSpecificationSchema(**item) for item in data_items]
            total = res.count if res.count is not None else len(specs)
            if specs:
                return AircraftSpecificationListResponse(total=total, specifications=specs)
        except Exception as e:
            logger.debug(f"Supabase search_aircraft_specs failed: {e}")

        # Fallback list from offline catalog
        specs = self._load_fallback_aircraft_specs()
        matched = []
        for s in specs:
            if category and (s.category or "").lower().strip() != category.lower().strip():
                continue
            if query:
                q_clean = query.strip().upper()
                if q_clean not in s.model.upper() and q_clean not in (s.icao_type or "").upper() and q_clean not in (s.engine_type or "").upper():
                    continue
            matched.append(s)

        total = len(matched)
        slice_result = matched[offset:offset + limit]
        return AircraftSpecificationListResponse(total=total, specifications=slice_result)

    def _load_fallback_nepal_aircraft(self) -> List[NepalAircraftDetailSchema]:
        """Lazy load Nepal registered aircraft from Nepal-aricraft-dataset.csv and resolve junction specifications."""
        if self._fallback_nepal_aircraft is not None:
            return self._fallback_nepal_aircraft

        csv_candidates = [
            Path(__file__).resolve().parent.parent.parent.parent.parent / "Nepal-aricraft-dataset.csv",
            Path(__file__).resolve().parent.parent.parent.parent / "Nepal-aricraft-dataset.csv",
            Path("Nepal-aricraft-dataset.csv").resolve(),
            Path("../Nepal-aricraft-dataset.csv").resolve(),
        ]
        csv_path = None
        for cand in csv_candidates:
            if cand.exists():
                csv_path = cand
                break

        if not csv_path:
            logger.warning("Nepal-aricraft-dataset.csv not found for offline fallback.")
            self._fallback_nepal_aircraft = []
            return self._fallback_nepal_aircraft

        all_specs = self._load_fallback_aircraft_specs()
        typecode_rules = {
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

        loaded = []
        try:
            with open(csv_path, mode="r", encoding="utf-8", errors="ignore") as f:
                r = csv.reader(f)
                raw_header = next(r)
                header = [c.strip().strip("'\"") for c in raw_header]
                header = ["country" if c == "country'" else c for c in header]

                for idx, row in enumerate(r, 1):
                    if not row or not any(row):
                        continue
                    item = {}
                    for i, val in enumerate(row):
                        if i < len(header):
                            item[header[i]] = val.strip().strip("'\"")

                    icao24 = (item.get("icao24") or "").strip().lower()
                    if not icao24:
                        continue

                    reg = item.get("registration") or None
                    tc = (item.get("typecode") or "").strip().upper() or None
                    model = item.get("model") or None
                    mfr_name = item.get("manufacturerName") or None
                    mfr_icao = item.get("manufacturerIcao") or None
                    op = item.get("operator") or None
                    op_callsign = item.get("operatorCallsign") or None
                    op_icao = item.get("operatorIcao") or None
                    op_iata = item.get("operatorIata") or None
                    owner = item.get("owner") or None
                    serial_no = item.get("serialNumber") or None
                    ac_class = item.get("icaoAircraftClass") or None
                    cat_desc = item.get("categoryDescription") or None
                    country = item.get("country") or "Nepal"
                    engines = item.get("engines") or None
                    built = item.get("built") or None
                    ff_date = item.get("firstFlightDate") or None
                    reg_date = item.get("registered") or None
                    reg_until = item.get("regUntil") or None
                    status = item.get("status") or None
                    modes = str(item.get("modes", "")).strip() in ("1", "true", "True")
                    adsb = str(item.get("adsb", "")).strip() in ("1", "true", "True")
                    acars = str(item.get("acars", "")).strip() in ("1", "true", "True")
                    vdl = str(item.get("vdl", "")).strip() in ("1", "true", "True")
                    notes = item.get("notes") or None
                    sel_cal = item.get("selCal") or None

                    matched_specs = []
                    junction_links = []
                    if tc and tc in typecode_rules:
                        rule = typecode_rules[tc]
                        # 1. Prioritize specified model variants
                        for target_m in rule["models"]:
                            for s in all_specs:
                                if s.model.lower() == target_m.lower() or target_m.lower() in s.model.lower():
                                    if s not in matched_specs:
                                        matched_specs.append(s)
                                        junction_links.append(NepalAircraftSpecificationJunctionSchema(
                                            id=len(junction_links) + 1,
                                            nepal_aircraft_id=idx,
                                            specification_id=s.id,
                                            match_method="exact_model" if s.model.lower() == target_m.lower() else "model_variant",
                                            match_confidence=1.00,
                                            is_primary=(len(matched_specs) == 1),
                                            notes=f"Linked {reg or icao24} ({tc}) to {s.model} [{s.icao_type}]"
                                        ))
                        # 2. Add other ICAO/IATA code matches if not already present
                        for target_c in rule["codes"]:
                            for s in all_specs:
                                if (s.icao_type or "").upper() == target_c.upper() and s not in matched_specs:
                                    matched_specs.append(s)
                                    junction_links.append(NepalAircraftSpecificationJunctionSchema(
                                        id=len(junction_links) + 1,
                                        nepal_aircraft_id=idx,
                                        specification_id=s.id,
                                        match_method="exact_typecode" if target_c.upper() == tc else "iata_mapping",
                                        match_confidence=0.95,
                                        is_primary=(len(matched_specs) == 1),
                                        notes=f"Linked {reg or icao24} ({tc}) to {s.model} [{s.icao_type}]"
                                    ))

                    primary_spec = matched_specs[0] if matched_specs else None

                    ac_detail = NepalAircraftDetailSchema(
                        id=idx,
                        icao24=icao24,
                        registration=reg,
                        typecode=tc,
                        model=model,
                        manufacturer_name=mfr_name,
                        manufacturer_icao=mfr_icao,
                        operator=op,
                        operator_callsign=op_callsign,
                        operator_icao=op_icao,
                        operator_iata=op_iata,
                        owner=owner,
                        serial_number=serial_no,
                        icao_aircraft_class=ac_class,
                        category_description=cat_desc,
                        country=country,
                        engines=engines,
                        built_year=built,
                        first_flight_date=ff_date,
                        registered_date=reg_date,
                        reg_until=reg_until,
                        status=status,
                        modes=modes,
                        adsb=adsb,
                        acars=acars,
                        vdl=vdl,
                        notes=notes,
                        sel_cal=sel_cal,
                        specification=primary_spec,
                        specifications=matched_specs,
                        junction_links=junction_links
                    )
                    loaded.append(ac_detail)
        except Exception as e:
            logger.warning(f"Error loading offline Nepal aircraft: {e}")

        self._fallback_nepal_aircraft = loaded
        return self._fallback_nepal_aircraft

    async def list_nepal_aircraft(
        self,
        query: Optional[str] = None,
        operator: Optional[str] = None,
        typecode: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> NepalAircraftListResponse:
        """Query Nepal registered fleet and linked specifications from Supabase with offline fallback."""
        try:
            client = self._get_client()
            builder = client.table("nepal_aircraft").select(
                "*, nepal_aircraft_specifications(*, aircraft_specifications(*))",
                count="exact"
            )
            if operator:
                op_clean = operator.strip()
                builder = builder.or_(f"operator.ilike.%{op_clean}%,operator_icao.ilike.%{op_clean}%")
            if typecode:
                builder = builder.eq("typecode", typecode.strip().upper())
            if query:
                q = f"%{query.strip()}%"
                builder = builder.or_(f"registration.ilike.{q},model.ilike.{q},operator.ilike.{q},icao24.ilike.{q}")

            builder = builder.order("registration").range(offset, offset + limit - 1)
            res = builder.execute()

            if res.data:
                results = []
                for item in res.data:
                    d = dict(item)
                    raw_junctions = d.pop("nepal_aircraft_specifications", []) or []
                    specs = []
                    j_schemas = []
                    primary_spec = None
                    for j in raw_junctions:
                        spec_raw = j.get("aircraft_specifications")
                        if spec_raw:
                            spec_obj = AircraftSpecificationSchema(**spec_raw)
                            specs.append(spec_obj)
                            if j.get("is_primary") and not primary_spec:
                                primary_spec = spec_obj
                        j_schemas.append(NepalAircraftSpecificationJunctionSchema(
                            id=j.get("id"),
                            nepal_aircraft_id=j.get("nepal_aircraft_id"),
                            specification_id=j.get("specification_id"),
                            match_method=j.get("match_method", "exact_typecode"),
                            match_confidence=float(j.get("match_confidence", 1.0)),
                            is_primary=bool(j.get("is_primary", True)),
                            notes=j.get("notes")
                        ))
                    if not primary_spec and specs:
                        primary_spec = specs[0]
                    d["specification"] = primary_spec
                    d["specifications"] = specs
                    d["junction_links"] = j_schemas
                    results.append(NepalAircraftDetailSchema(**d))

                total = res.count if res.count is not None else len(results)
                return NepalAircraftListResponse(total=total, aircraft=results)
        except Exception as e:
            logger.debug(f"Supabase list_nepal_aircraft failed, falling back to offline: {e}")

        # Fallback offline filtering
        all_ac = self._load_fallback_nepal_aircraft()
        filtered = []
        for ac in all_ac:
            if operator:
                op_clean = operator.strip().upper()
                if op_clean not in (ac.operator or "").upper() and op_clean not in (ac.operator_icao or "").upper():
                    continue
            if typecode and (ac.typecode or "").upper() != typecode.strip().upper():
                continue
            if query:
                q = query.strip().upper()
                if (
                    q not in (ac.registration or "").upper()
                    and q not in (ac.model or "").upper()
                    and q not in (ac.operator or "").upper()
                    and q not in ac.icao24.upper()
                ):
                    continue
            filtered.append(ac)

        total = len(filtered)
        paged = filtered[offset:offset + limit]
        return NepalAircraftListResponse(total=total, aircraft=paged)

    async def get_nepal_aircraft(self, identifier: str) -> Optional[NepalAircraftDetailSchema]:
        """Fetch a single Nepal registered aircraft by registration or icao24 with linked specifications."""
        key = identifier.strip().upper()

        # Check offline catalog first for instant zero-latency Nepal aircraft resolution
        for ac in self._load_fallback_nepal_aircraft():
            if (ac.registration or "").upper() == key or (ac.icao24 or "").upper() == key:
                return ac

        try:
            client = self._get_client()
            res = client.table("nepal_aircraft").select(
                "*, nepal_aircraft_specifications(*, aircraft_specifications(*))"
            ).or_(f"registration.ilike.{key},icao24.ilike.{key}").limit(1).execute()

            if res.data:
                d = dict(res.data[0])
                raw_junctions = d.pop("nepal_aircraft_specifications", []) or []
                specs = []
                j_schemas = []
                primary_spec = None
                for j in raw_junctions:
                    spec_raw = j.get("aircraft_specifications")
                    if spec_raw:
                        spec_obj = AircraftSpecificationSchema(**spec_raw)
                        specs.append(spec_obj)
                        if j.get("is_primary") and not primary_spec:
                            primary_spec = spec_obj
                    j_schemas.append(NepalAircraftSpecificationJunctionSchema(
                        id=j.get("id"),
                        nepal_aircraft_id=j.get("nepal_aircraft_id"),
                        specification_id=j.get("specification_id"),
                        match_method=j.get("match_method", "exact_typecode"),
                        match_confidence=float(j.get("match_confidence", 1.0)),
                        is_primary=bool(j.get("is_primary", True)),
                        notes=j.get("notes")
                    ))
                if not primary_spec and specs:
                    primary_spec = specs[0]
                d["specification"] = primary_spec
                d["specifications"] = specs
                d["junction_links"] = j_schemas
                return NepalAircraftDetailSchema(**d)
        except Exception as e:
            logger.debug(f"Supabase get_nepal_aircraft lookup failed for {key}: {e}")

        return None


aviation_repo = AviationRepository()
