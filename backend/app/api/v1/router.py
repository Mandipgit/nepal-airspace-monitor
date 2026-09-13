"""
Central API v1 Router
Aggregates sub-routers for flights, airports, aircraft, and health.
"""

# pyrefly: ignore [missing-import]
from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.flights import router as flights_router
from app.api.v1.airports import router as airports_router
from app.api.v1.aircraft import router as aircraft_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router)
api_v1_router.include_router(flights_router)
api_v1_router.include_router(airports_router)
api_v1_router.include_router(aircraft_router)
