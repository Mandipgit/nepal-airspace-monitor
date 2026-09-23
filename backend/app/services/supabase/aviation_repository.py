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
    AircraftSpecificationListResponse
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
        "cruise_speed_kts": 276,
        "max_speed_kts": 285,
        "nominal_range_nm": 825,
        "approach_speed_kts": 115,
        "takeoff_field_length_m": 1220,
        "landing_field_length_m": 1050
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

    def _get_client(self):
        return get_supabase_client()

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
                                local_code=row.get("local_code")
                            ))
                        except Exception:
                            continue
            except Exception as e:
                logger.warning(f"Could not parse offline airports.xls: {e}")

        if not loaded:
            loaded = [AirportSummarySchema(**a) for a in FALLBACK_NEPAL_AIRPORTS]

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
        """Lazy load aircraft specifications from local data/raw/aircraft_df.xls or static fallback."""
        if self._fallback_aircraft_specs is not None:
            return self._fallback_aircraft_specs

        ac_file = self._get_raw_data_dir() / "aircraft_df.xls"
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

                            loaded.append(AircraftSpecificationSchema(
                                    id=idx,
                                    model=model_name,
                                    icao_type=row.get("iata_code") or row.get("airplane_type") or "GEN",
                                    category=row.get("airplane_type") or "commercial",
                                    engine_type=row.get("engine_type"),
                                    engine_model=row.get("powerplant"),
                                    number_of_engines=int(float(row["n_engine"])) if row.get("n_engine") else 2,
                                    passenger_capacity=int(float(row["n_pax"])) if row.get("n_pax") else None,
                                    oew_kg=float(row["owe"]) if row.get("owe") else None,
                                    mtow_kg=float(row["mtow"]) if row.get("mtow") else None,
                                    mlw_kg=float(row["mlw"]) if row.get("mlw") else None,
                                    cruise_speed_kts=cruise_kts,
                                    max_speed_kts=max_kts,
                                    nominal_range_nm=int(float(row["nominal_range"])) if row.get("nominal_range") else None,
                                    approach_speed_kts=int(float(row["approach_speed"]) / 1.852) if row.get("approach_speed") else None,
                                    takeoff_field_length_m=int(float(row["tofl"])) if row.get("tofl") else None,
                                    landing_field_length_m=int(float(row["lfl"])) if row.get("lfl") else None
                                ))
                        except Exception:
                            continue
            except Exception as e:
                logger.warning(f"Could not parse offline aircraft_df.xls: {e}")

        if not loaded:
            loaded = [AircraftSpecificationSchema(**s) for s in FALLBACK_AIRCRAFT_SPECS]

        self._fallback_aircraft_specs = loaded
        return self._fallback_aircraft_specs

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
                "ident, type, name, latitude_deg, longitude_deg, elevation_ft, continent, iso_country, iso_region, municipality, scheduled_service, gps_code, iata_code, local_code",
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

            airports = [AirportSummarySchema(**item) for item in res.data]
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
                apt_data = apt_res.data[0]
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
                detail = AirportDetailSchema(**apt.model_dump(), runways=runways)
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

        try:
            client = self._get_client()
            res = client.table("aircraft_specifications").select("*").or_(f"model.ilike.%{key}%,icao_type.eq.{key}").limit(1).execute()
            if res.data:
                spec = AircraftSpecificationSchema(**res.data[0])
                self._aircraft_cache[key] = spec
                return spec
        except Exception as e:
            logger.debug(f"Supabase get_aircraft_spec lookup failed for {key}: {e}")

        # Fallback check against offline catalog
        specs = self._load_fallback_aircraft_specs()
        clean_key = re.sub(r"[^A-Z0-9]", "", key)

        for s in specs:
            clean_model = re.sub(r"[^A-Z0-9]", "", s.model.upper())
            clean_icao = re.sub(r"[^A-Z0-9]", "", (s.icao_type or "").upper())
            if (clean_key and clean_key in clean_model) or (clean_icao and (clean_key in clean_icao or clean_icao in clean_key)):
                self._aircraft_cache[key] = s
                return s

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

            specs = [AircraftSpecificationSchema(**item) for item in res.data]
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


aviation_repo = AviationRepository()
