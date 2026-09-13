"""
Central API v1 Router
Aggregates sub-routers for flights, airports, aircraft, and health.
"""

from fastapi import APIRouter
from backend.app.api.v1.health import router as health_router
from backend.app.api.v1.flights import router as flights_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router)
api_v1_router.include_router(flights_router)
