"""
Airports and Runways API Endpoints
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status

from app.schemas.airport import (
    AirportSummarySchema,
    AirportDetailSchema,
    AirportListResponse
)
from app.services.supabase.aviation_repository import aviation_repo

router = APIRouter(prefix="/airports", tags=["Airports & Runways"])

@router.get("", response_model=AirportListResponse)
async def list_airports(
    query: Optional[str] = Query(None, description="Search by airport name, ICAO ident, IATA code, or city"),
    country: Optional[str] = Query(None, description="Filter by ISO 2-letter country code (e.g. 'NP', 'IN')"),
    scheduled_only: bool = Query(False, description="Filter only airports with scheduled commercial airline service"),
    limit: int = Query(50, ge=1, le=250, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination")
):
    """
    Search and list airports from the database.
    Defaults to returning commercial/regional airports.
    """
    return await aviation_repo.get_airports(
        country=country,
        query=query,
        scheduled_only=scheduled_only,
        limit=limit,
        offset=offset
    )

@router.get("/nepal", response_model=AirportListResponse)
async def get_nepal_airports():
    """
    Retrieve all airports, airstrips, and heliports in Nepal.
    """
    return await aviation_repo.get_nepal_airports()

@router.get("/{ident}", response_model=AirportDetailSchema)
async def get_airport_details(ident: str):
    """
    Retrieve detailed airport information including physical runways, surface types, and threshold headings.
    """
    airport = await aviation_repo.get_airport_by_ident(ident)
    if not airport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Airport with identifier '{ident.upper()}' not found."
        )
    return airport
