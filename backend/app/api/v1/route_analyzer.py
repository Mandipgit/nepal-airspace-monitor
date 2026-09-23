"""
Route Aircraft Analyzer API Endpoints
Provides endpoints for calculating route distance, runway compatibility, flight time,
and analytical suitability for aircraft operating within Nepal airspace.
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status

from app.schemas.route_analyzer import (
    RouteAircraftAnalysisRequest,
    RouteAircraftAnalysisResponse,
    RouteInformationResponse
)
from app.services.route_analyzer import route_analyzer_service

router = APIRouter(prefix="/route-analyzer", tags=["Route Aircraft Analyzer"])


@router.post(
    "/analyze",
    response_model=RouteAircraftAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze Aircraft Suitability on Nepal Routes",
    description="""
Analyze whether selected aircraft specifications are suitable for a specified departure → destination route within Nepal.

### Purpose & Scope
This analyzer performs a deterministic engineering comparison based on static aircraft performance models
and published airport/runway datasets.

> **Scope Note**: This feature is strictly restricted to **airports located within Nepal** (e.g. `VNKT`, `VNPK`, `VNBW`, `VNLK`).
> Non-Nepalese airports will be rejected with an HTTP 400 Bad Request.

### Calculations Performed:
1. **Haversine Distance**: Great-circle distance in kilometers between origin and destination coordinates.
2. **Longest Destination Runway**: Selects the longest available destination runway in meters ($1\\text{ ft} = 0.3048\\text{ m}$).
3. **Ground Speed**: Evaluates effective cruise ground speed considering wind ($V_{\\text{ground}} = V_{\\text{cruise}} - V_{\\text{wind}}$).
4. **Estimated Flight Time**: Sum of cruise time and descent time phases in minutes.
5. **Range Margin**: Aircraft nominal range minus route distance (km).
6. **Runway Margins**: Destination runway length minus takeoff field length (TOFL) and landing field length (LFL) in meters.
7. **Calculated Suitability**: `within_calculated_limits` if range, TOFL, and LFL margins are $\\ge 0$ and speed is valid.

### Meteorological Wind Convention:
- **Positive (+)**: Headwind in km/h (reduces ground speed, increases flight time).
- **Negative (-)**: Tailwind in km/h (increases ground speed, decreases flight time).
- **Zero (0)**: Calm wind.

### Important Aviation Disclaimer:
This is an approximate mathematical comparison model. It is **NOT** an airline dispatch system, operational flight plan,
certified performance calculation, or substitute for aircraft Flight Manuals (AFM/POH) or NOTAMs.
    """,
    responses={
        200: {
            "description": "Comparative suitability analysis successfully generated.",
            "model": RouteAircraftAnalysisResponse
        },
        400: {
            "description": "Validation error (e.g. airport outside Nepal, identical departure and destination, or missing runway data)."
        },
        404: {
            "description": "Departure or destination airport not found in the database."
        },
        422: {
            "description": "Pydantic request payload schema validation failure."
        }
    }
)
async def analyze_route_aircraft(
    request: RouteAircraftAnalysisRequest
) -> RouteAircraftAnalysisResponse:
    """
    Execute route comparison analysis for one route and multiple aircraft.
    """
    return await route_analyzer_service.analyze_route(request)


@router.get(
    "/route",
    response_model=RouteInformationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Route Distance, Departure Runway, and Destination Runway",
    description="""
Route and runway inspection endpoint for frontend map rendering and pre-flight planning.

### Flexible Airport Search:
Supports entering any identifier or name:
- **ICAO code**: e.g. `VNKT`, `VNPK`, `VNLK`, `VNBW`
- **IATA code**: e.g. `KTM`, `PKR`, `LUA`, `BWA`, `BIR`
- **Airport name**: e.g. `Tribhuvan`, `Pokhara`, `Tenzing-Hillary`, `Gautam Buddha`
- **City / Municipality**: e.g. `Kathmandu`, `Pokhara`, `Lukla`, `Bhairahawa`

### Runway Information Returned:
Fetches detailed physical runway dimensions and threshold records directly from the database `runways` table
for both **departure** and **destination** airports.
    """,
    responses={
        200: {
            "description": "Route and runway information successfully retrieved.",
            "model": RouteInformationResponse
        },
        400: {
            "description": "Validation error (e.g. airport outside Nepal or identical departure and destination)."
        },
        404: {
            "description": "Airport identifier or name not found."
        }
    }
)
async def get_route_information(
    departure_ident: Optional[str] = Query(None, min_length=2, max_length=100, description="Departure airport ICAO, IATA, or airport name (e.g. 'VNKT', 'KTM', 'Kathmandu')"),
    destination_ident: Optional[str] = Query(None, min_length=2, max_length=100, description="Destination airport ICAO, IATA, or airport name (e.g. 'VNPK', 'PKR', 'Pokhara')"),
    departure: Optional[str] = Query(None, min_length=2, max_length=100, description="Alias for departure airport"),
    destination: Optional[str] = Query(None, min_length=2, max_length=100, description="Alias for destination airport")
) -> RouteInformationResponse:
    """
    Retrieve route coordinates, distance, and detailed physical runway specifications for both airports.
    """
    dep_query = departure or departure_ident
    dest_query = destination or destination_ident

    if not dep_query or not dest_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both departure and destination airport identifiers or names must be provided."
        )

    return await route_analyzer_service.get_route_info(
        departure_query=dep_query,
        destination_query=dest_query
    )
