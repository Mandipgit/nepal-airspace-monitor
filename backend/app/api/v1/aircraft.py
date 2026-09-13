"""
Aircraft Specifications API Endpoints
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status

from app.schemas.aircraft import (
    AircraftSpecificationSchema,
    AircraftSpecificationListResponse
)
from app.services.supabase.aviation_repository import aviation_repo

router = APIRouter(prefix="/aircraft", tags=["Aircraft Specifications"])

@router.get("", response_model=AircraftSpecificationListResponse)
async def list_aircraft_specifications(
    query: Optional[str] = Query(None, description="Search by aircraft model or engine type"),
    category: Optional[str] = Query(None, description="Filter by category: regional, commuter, short_medium, business, general, long_range"),
    limit: int = Query(50, ge=1, le=200, description="Max records to return"),
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
    by aircraft model name or ICAO type code.
    """
    spec = await aviation_repo.get_aircraft_spec(identifier)
    if not spec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aircraft specification for '{identifier}' not found."
        )
    return spec
