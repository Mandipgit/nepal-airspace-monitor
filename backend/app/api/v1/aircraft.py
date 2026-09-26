"""
Aircraft Specifications API Endpoints
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status

from app.schemas.aircraft import (
    AircraftSpecificationSchema,
    AircraftSpecificationListResponse,
    NepalAircraftDetailSchema,
    NepalAircraftListResponse,
)
from app.services.supabase.aviation_repository import aviation_repo

router = APIRouter(prefix="/aircraft", tags=["Aircraft Specifications"])

@router.get("/nepal/fleet", response_model=NepalAircraftListResponse)
async def list_nepal_fleet(
    query: Optional[str] = Query(None, description="Search by registration (e.g. 9N-AIH), model, or icao24"),
    operator: Optional[str] = Query(None, description="Filter by carrier name or ICAO code (e.g. Buddha Air, BHA)"),
    typecode: Optional[str] = Query(None, description="Filter by ICAO typecode (e.g. AT75, DH8D, A320, DHC6)"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination")
):
    """
    List Nepal registered civil aircraft with linked specifications from the junction table.
    """
    return await aviation_repo.list_nepal_aircraft(
        query=query,
        operator=operator,
        typecode=typecode,
        limit=limit,
        offset=offset
    )

@router.get("/nepal/{identifier}", response_model=NepalAircraftDetailSchema)
async def get_nepal_aircraft_detail(identifier: str):
    """
    Retrieve single Nepal registered aircraft by registration (e.g. '9N-AOH') or Mode-S icao24 ('70a8e5'),
    including its engineering and performance specifications linked via the junction table.
    """
    aircraft = await aviation_repo.get_nepal_aircraft(identifier)
    if not aircraft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nepal registered aircraft for '{identifier}' not found."
        )
    return aircraft

@router.get("", response_model=AircraftSpecificationListResponse)
async def list_aircraft_specifications(
    query: Optional[str] = Query(None, description="Search by aircraft model or engine type"),
    category: Optional[str] = Query(None, description="Filter by category: regional, commuter, short_medium, business, general, long_range"),
    limit: int = Query(50, ge=1, le=500, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination")
):
    """
    Search and list aircraft specifications from the database.
    """
    return await aviation_repo.search_aircraft_specs(
        query=query,
        category=category,
        limit=limit,
        offset=offset
    )

@router.get("/{identifier}", response_model=AircraftSpecificationSchema)
async def get_aircraft_specification(identifier: str):
    """
    Retrieve performance characteristics, MTOW, passenger capacity, and speed specs
    by aircraft model name, ICAO type code, or Nepal registration mark / Mode-S hex.
    """
    # 1. Direct match by aircraft model name or ICAO type code
    spec = await aviation_repo.get_aircraft_spec(identifier)
    if spec:
        return spec

    # 2. Check if identifier is a Nepal aircraft registration (e.g. 9N-AOH) or Mode-S hex (e.g. 70a8e5)
    clean_id = identifier.strip().upper()
    nepal_ac = await aviation_repo.get_nepal_aircraft(clean_id)
    if nepal_ac and nepal_ac.specification:
        return nepal_ac.specification

    # 3. Check if identifier is a Mode-S hex for a non-Nepal aircraft via ADS-B DB
    hex_clean = identifier.strip().lower()
    if len(hex_clean) == 6 and all(c in "0123456789abcdef" for c in hex_clean):
        from app.services.enrichment import enrichment_service
        adsb_meta = await enrichment_service.fetch_single_aircraft_meta(hex_clean)
        if adsb_meta:
            type_code = adsb_meta.get("icao_type") or adsb_meta.get("type")
            if type_code:
                spec = await aviation_repo.get_aircraft_spec(type_code)
                if spec:
                    return spec

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Aircraft specification for '{identifier}' not found."
    )

