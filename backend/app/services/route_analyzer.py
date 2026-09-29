"""
Route Aircraft Analyzer Service
Performs deterministic suitability calculations for aircraft on routes within Nepal airspace.
Supports flexible airport lookups (ICAO, IATA, GPS/local code, city/municipality, or full name).
Fetches comprehensive detailed runway parameters for both departure and destination airports.
"""

import logging
from typing import List, Optional, Tuple
from fastapi import HTTPException, status

from app.services.enrichment import haversine_km
from app.services.supabase.aviation_repository import aviation_repo, AviationRepository
from app.schemas.airport import AirportDetailSchema, RunwaySchema
from app.schemas.aircraft import AircraftSpecificationSchema
from app.schemas.route_analyzer import (
    RouteAircraftAnalysisRequest,
    RouteAircraftAnalysisResponse,
    RouteInformationResponse,
    RouteInfo,
    AirportRoutePoint,
    AnalysisConditions,
    AirportRunwayAnalysisInfo,
    AircraftAnalysisResult
)

logger = logging.getLogger(__name__)

# Constants
FEET_TO_METERS = 0.3048
KNOTS_TO_KMH = 1.852
NAUTICAL_MILES_TO_KM = 1.852


class RouteAnalyzerService:
    """
    Core business logic and domain calculation service for aircraft route analysis.
    Completely decoupled from HTTP request/response handling.
    """

    def __init__(self, repo: Optional[AviationRepository] = None):
        self.repo = repo or aviation_repo

    def validate_nepal_airport(self, airport: AirportDetailSchema, role: str) -> None:
        """
        Ensure the airport is strictly within Nepal airspace.
        """
        is_nepal_country = (airport.iso_country or "").strip().upper() == "NP"
        is_nepal_ident = airport.ident.strip().upper().startswith("VN")

        if not (is_nepal_country or is_nepal_ident):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{role.capitalize()} airport '{airport.ident}' ({airport.name}) is outside Nepal airspace. "
                    "The Route Aircraft Analyzer is restricted strictly to airports within Nepal."
                )
            )

    async def get_and_validate_airports(
        self,
        departure_query: str,
        destination_query: str
    ) -> Tuple[AirportDetailSchema, AirportDetailSchema]:
        """
        Fetch and validate departure and destination airports in Nepal using flexible lookup
        (ICAO ident, IATA code, GPS/local code, municipality, or airport name).
        """
        dep_str = departure_query.strip()
        dest_str = destination_query.strip()

        if not dep_str or not dest_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both departure and destination airport identifiers or names must be provided."
            )

        departure = await self.repo.find_nepal_airport(dep_str)
        if not departure:
            # Check if it exists globally to provide an informative outside-Nepal error
            global_dep = await self.repo.get_airport_by_ident(dep_str.upper())
            if global_dep:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Departure airport '{dep_str}' ({global_dep.name}) is outside Nepal airspace. "
                        "The Route Aircraft Analyzer is restricted strictly to airports within Nepal."
                    )
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Departure airport '{dep_str}' not found."
            )

        destination = await self.repo.find_nepal_airport(dest_str)
        if not destination:
            global_dest = await self.repo.get_airport_by_ident(dest_str.upper())
            if global_dest:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Destination airport '{dest_str}' ({global_dest.name}) is outside Nepal airspace. "
                        "The Route Aircraft Analyzer is restricted strictly to airports within Nepal."
                    )
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Destination airport '{dest_str}' not found."
            )

        if departure.ident.upper() == destination.ident.upper():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Departure and destination airports must be different."
            )

        # Enforce Nepal context
        self.validate_nepal_airport(departure, "departure")
        self.validate_nepal_airport(destination, "destination")

        return departure, destination

    def select_airport_runway(
        self,
        airport: AirportDetailSchema,
        role: str = "destination"
    ) -> AirportRunwayAnalysisInfo:
        """
        Select the longest available runway and compile detailed runway characteristics
        from the physical runway records stored in the database.
        """
        if not airport.runways:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No runway data available for {role} airport '{airport.ident}'."
            )

        # Filter valid runways with positive length
        valid_runways = [
            rw for rw in airport.runways
            if rw.length_ft and rw.length_ft > 0 and not rw.closed
        ]
        if not valid_runways:
            valid_runways = [rw for rw in airport.runways if rw.length_ft and rw.length_ft > 0]

        if not valid_runways:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No runway data available for {role} airport '{airport.ident}'."
            )

        best_rw = max(valid_runways, key=lambda rw: rw.length_ft or 0)
        runway_length_m = round((best_rw.length_ft or 0) * FEET_TO_METERS, 1)
        runway_width_m = round((best_rw.width_ft or 0) * FEET_TO_METERS, 1) if best_rw.width_ft else None

        runway_ident = None
        if best_rw.le_ident and best_rw.he_ident:
            runway_ident = f"{best_rw.le_ident}/{best_rw.he_ident}"
        elif best_rw.le_ident:
            runway_ident = best_rw.le_ident

        return AirportRunwayAnalysisInfo(
            runway_length_m=runway_length_m,
            runway_length_ft=best_rw.length_ft,
            runway_width_m=runway_width_m,
            runway_width_ft=best_rw.width_ft,
            selection_method="longest_available",
            runway_ident=runway_ident,
            surface=best_rw.surface,
            lighted=best_rw.lighted,
            closed=best_rw.closed,
            le_ident=best_rw.le_ident,
            le_heading_degt=best_rw.le_heading_degt,
            le_elevation_ft=best_rw.le_elevation_ft,
            le_displaced_threshold_ft=best_rw.le_displaced_threshold_ft,
            he_ident=best_rw.he_ident,
            he_heading_degt=best_rw.he_heading_degt,
            he_elevation_ft=best_rw.he_elevation_ft,
            he_displaced_threshold_ft=best_rw.he_displaced_threshold_ft,
            all_runways=airport.runways
        )

    def calculate_aircraft_suitability(
        self,
        identifier: str,
        spec: AircraftSpecificationSchema,
        route_distance_km: float,
        departure_runway_length_m: float,
        destination_runway_length_m: float,
        wind_kmh: float,
        descent_distance_km: float
    ) -> AircraftAnalysisResult:
        """
        Evaluate route compatibility, margins, and estimated flight time for a single aircraft.
        Takeoff margin is calculated against departure runway length (departure_runway_length_m - TOFL).
        Landing margin is calculated against destination runway length (destination_runway_length_m - LFL).
        """
        # Convert speeds and ranges from specification units
        cruise_speed_kmh: Optional[float] = (
            round(spec.cruise_speed_kts * KNOTS_TO_KMH, 1)
            if spec.cruise_speed_kts is not None else None
        )
        approach_speed_kmh: Optional[float] = (
            round(spec.approach_speed_kts * KNOTS_TO_KMH, 1)
            if spec.approach_speed_kts is not None else None
        )
        nominal_range_km: Optional[float] = (
            round(spec.nominal_range_nm * NAUTICAL_MILES_TO_KM, 1)
            if spec.nominal_range_nm is not None else None
        )
        tofl_m: Optional[int] = spec.takeoff_field_length_m
        lfl_m: Optional[int] = spec.landing_field_length_m or spec.takeoff_field_length_m

        # Compute Margins
        range_margin_km: Optional[float] = (
            round(nominal_range_km - route_distance_km, 1)
            if nominal_range_km is not None else None
        )
        tofl_margin_m: Optional[float] = (
            round(departure_runway_length_m - tofl_m, 1)
            if tofl_m is not None else None
        )
        lfl_margin_m: Optional[float] = (
            round(destination_runway_length_m - lfl_m, 1)
            if lfl_m is not None else None
        )

        # Check for missing critical performance data
        if cruise_speed_kmh is None or approach_speed_kmh is None or nominal_range_km is None or tofl_m is None:
            missing_fields = []
            if cruise_speed_kmh is None:
                missing_fields.append("cruise speed")
            if approach_speed_kmh is None:
                missing_fields.append("approach speed")
            if nominal_range_km is None:
                missing_fields.append("nominal range")
            if tofl_m is None:
                missing_fields.append("takeoff field length")

            return AircraftAnalysisResult(
                aircraft_identifier=identifier,
                aircraft_name=spec.model,
                passenger_capacity=spec.passenger_capacity,
                cruise_speed_kmh=cruise_speed_kmh,
                approach_speed=approach_speed_kmh,
                nominal_range_km=nominal_range_km,
                estimated_flight_time_min=None,
                range_margin_km=range_margin_km,
                takeoff_runway_margin_m=tofl_margin_m,
                landing_runway_margin_m=lfl_margin_m,
                within_calculated_limits=False,
                analysis_status="missing_performance_data",
                notes=f"Missing critical performance specification(s): {', '.join(missing_fields)}."
            )

        # Ground speed calculation and safety validation
        ground_speed_kmh = cruise_speed_kmh - wind_kmh
        if ground_speed_kmh <= 0:
            return AircraftAnalysisResult(
                aircraft_identifier=identifier,
                aircraft_name=spec.model,
                passenger_capacity=spec.passenger_capacity,
                cruise_speed_kmh=cruise_speed_kmh,
                approach_speed=approach_speed_kmh,
                nominal_range_km=nominal_range_km,
                estimated_flight_time_min=None,
                range_margin_km=range_margin_km,
                takeoff_runway_margin_m=tofl_margin_m,
                landing_runway_margin_m=lfl_margin_m,
                within_calculated_limits=False,
                analysis_status="insufficient_ground_speed",
                notes=(
                    f"Calculated ground speed ({ground_speed_kmh:.1f} km/h) is zero or negative due to "
                    f"headwind ({wind_kmh:.1f} km/h) matching or exceeding cruise speed ({cruise_speed_kmh:.1f} km/h)."
                )
            )

        if approach_speed_kmh <= 0:
            return AircraftAnalysisResult(
                aircraft_identifier=identifier,
                aircraft_name=spec.model,
                passenger_capacity=spec.passenger_capacity,
                cruise_speed_kmh=cruise_speed_kmh,
                approach_speed=approach_speed_kmh,
                nominal_range_km=nominal_range_km,
                estimated_flight_time_min=None,
                range_margin_km=range_margin_km,
                takeoff_runway_margin_m=tofl_margin_m,
                landing_runway_margin_m=lfl_margin_m,
                within_calculated_limits=False,
                analysis_status="invalid_speed",
                notes="Approach speed specification is invalid (<= 0 km/h)."
            )

        # Flight time calculation
        cruise_distance = max(route_distance_km - descent_distance_km, 0.0)
        descent_distance = min(route_distance_km, descent_distance_km)

        cruise_time_hours = cruise_distance / ground_speed_kmh
        descent_time_hours = descent_distance / approach_speed_kmh
        flight_time_min = round((cruise_time_hours + descent_time_hours) * 60, 1)

        # Determine calculated limits
        range_ok = (range_margin_km is not None and range_margin_km >= 0)
        tofl_ok = (tofl_margin_m is not None and tofl_margin_m >= 0)
        lfl_ok = (lfl_margin_m is not None and lfl_margin_m >= 0)

        within_limits = range_ok and tofl_ok and lfl_ok

        limiting_factors = []
        if not range_ok and range_margin_km is not None:
            limiting_factors.append(f"Route distance ({route_distance_km:.1f} km) exceeds nominal range ({nominal_range_km:.1f} km) by {abs(range_margin_km):.1f} km")
        if not tofl_ok and tofl_margin_m is not None:
            limiting_factors.append(f"Departure runway ({departure_runway_length_m:.1f} m) is {abs(tofl_margin_m):.1f} m shorter than required TOFL ({tofl_m} m)")
        if not lfl_ok and lfl_margin_m is not None:
            limiting_factors.append(f"Destination runway ({destination_runway_length_m:.1f} m) is {abs(lfl_margin_m):.1f} m shorter than required LFL ({lfl_m} m)")

        notes = "; ".join(limiting_factors) if limiting_factors else None

        return AircraftAnalysisResult(
            aircraft_identifier=identifier,
            aircraft_name=spec.model,
            passenger_capacity=spec.passenger_capacity,
            cruise_speed_kmh=cruise_speed_kmh,
            approach_speed=approach_speed_kmh,
            nominal_range_km=nominal_range_km,
            estimated_flight_time_min=flight_time_min,
            range_margin_km=range_margin_km,
            takeoff_runway_margin_m=tofl_margin_m,
            landing_runway_margin_m=lfl_margin_m,
            within_calculated_limits=within_limits,
            analysis_status="within_calculated_limits" if within_limits else "outside_calculated_limits",
            notes=notes
        )

    async def get_route_info(
        self,
        departure_query: str,
        destination_query: str
    ) -> RouteInformationResponse:
        """
        Lightweight route inspection service returning route coordinates, distance,
        detailed departure runway, and detailed destination runway.
        """
        dep, dest = await self.get_and_validate_airports(departure_query, destination_query)
        distance_km = round(haversine_km(
            dep.latitude_deg, dep.longitude_deg,
            dest.latitude_deg, dest.longitude_deg
        ), 1)

        departure_runway = self.select_airport_runway(dep, "departure")
        destination_runway = self.select_airport_runway(dest, "destination")

        return RouteInformationResponse(
            route=RouteInfo(
                departure=AirportRoutePoint(
                    ident=dep.ident,
                    name=dep.name,
                    latitude=dep.latitude_deg,
                    longitude=dep.longitude_deg,
                    elevation_ft=dep.elevation_ft,
                    municipality=dep.municipality
                ),
                destination=AirportRoutePoint(
                    ident=dest.ident,
                    name=dest.name,
                    latitude=dest.latitude_deg,
                    longitude=dest.longitude_deg,
                    elevation_ft=dest.elevation_ft,
                    municipality=dest.municipality
                ),
                distance_km=distance_km
            ),
            departure_runway=departure_runway,
            destination_runway=destination_runway,
            departure_runways=dep.runways,
            destination_runways=dest.runways
        )

    async def analyze_route(
        self,
        request: RouteAircraftAnalysisRequest
    ) -> RouteAircraftAnalysisResponse:
        """
        Main analysis execution: validates airports using flexible search,
        retrieves detailed runways for both airports, fetches aircraft in bulk,
        and computes per-aircraft suitability metrics.
        """
        departure, destination = await self.get_and_validate_airports(
            request.departure_ident,
            request.destination_ident
        )

        distance_km = round(haversine_km(
            departure.latitude_deg, departure.longitude_deg,
            destination.latitude_deg, destination.longitude_deg
        ), 1)

        departure_runway = self.select_airport_runway(departure, "departure")
        destination_runway = self.select_airport_runway(destination, "destination")

        # Bulk fetch aircraft specifications
        matched_specs = await self.repo.get_aircraft_specs_bulk(request.aircraft_identifiers)

        results: List[AircraftAnalysisResult] = []
        missing_aircraft: List[str] = []

        for ident in request.aircraft_identifiers:
            spec = matched_specs.get(ident)
            if not spec:
                missing_aircraft.append(ident)
                continue

            result = self.calculate_aircraft_suitability(
                identifier=ident,
                spec=spec,
                route_distance_km=distance_km,
                departure_runway_length_m=departure_runway.runway_length_m,
                destination_runway_length_m=destination_runway.runway_length_m,
                wind_kmh=request.wind_kmh,
                descent_distance_km=request.descent_distance_km
            )
            results.append(result)

        return RouteAircraftAnalysisResponse(
            route=RouteInfo(
                departure=AirportRoutePoint(
                    ident=departure.ident,
                    name=departure.name,
                    latitude=departure.latitude_deg,
                    longitude=departure.longitude_deg,
                    elevation_ft=departure.elevation_ft,
                    municipality=departure.municipality
                ),
                destination=AirportRoutePoint(
                    ident=destination.ident,
                    name=destination.name,
                    latitude=destination.latitude_deg,
                    longitude=destination.longitude_deg,
                    elevation_ft=destination.elevation_ft,
                    municipality=destination.municipality
                ),
                distance_km=distance_km
            ),
            conditions=AnalysisConditions(
                wind_kmh=request.wind_kmh,
                descent_distance_km=request.descent_distance_km
            ),
            departure_runway=departure_runway,
            destination_runway=destination_runway,
            departure_runways=departure.runways,
            destination_runways=destination.runways,
            results=results,
            missing_aircraft=missing_aircraft
        )


route_analyzer_service = RouteAnalyzerService()
