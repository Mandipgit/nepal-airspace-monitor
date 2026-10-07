"""
Central API v1 Router
Aggregates sub-routers for flights, airports, aircraft, and health.
"""

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.api.v1.health import router as health_router
from app.api.v1.flights import router as flights_router
from app.api.v1.airports import router as airports_router
from app.api.v1.aircraft import router as aircraft_router
from app.api.v1.auth import router as auth_router
from app.api.v1.route_analyzer import router as route_analyzer_router
from app.api.v1.icao import router as icao_router

api_v1_router = APIRouter()
# Public endpoints
api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(airports_router)
api_v1_router.include_router(icao_router)

# Protected endpoints - Require active JWT authentication
api_v1_router.include_router(flights_router, dependencies=[Depends(get_current_user)])
api_v1_router.include_router(aircraft_router, dependencies=[Depends(get_current_user)])
api_v1_router.include_router(route_analyzer_router, dependencies=[Depends(get_current_user)])


