"""
Integration Tests for Flights API Endpoints
"""

import unittest
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.models.flight import (
    NormalizedFlight,
    FlightIdentification,
    FlightPosition
)
from backend.app.services.providers.base import BaseFlightProvider
from backend.app.services.flight_service import FlightService, flight_service
from backend.app.core.cache import flight_cache

class MockFlightProvider(BaseFlightProvider):
    """Mock provider returning fixed test flights."""
    def __init__(self):
        self.call_count = 0

    @property
    def name(self) -> str:
        return "mock_provider"

    async def get_live_flights(self, lamin, lomin, lamax, lomax):
        self.call_count += 1
        return [
            NormalizedFlight(
                id="mock_70a8ee",
                provider="mock_provider",
                identification=FlightIdentification(
                    icao24="70a8ee",
                    callsign="BHA137",
                    operator_icao="BHA",
                    operator_name="Buddha Air",
                    is_nepal_registered=True
                ),
                position=FlightPosition(
                    latitude=27.99,
                    longitude=83.94,
                    altitude_baro_m=5455.0,
                    groundspeed_mps=122.0,
                    heading_deg=280.0
                )
            ),
            NormalizedFlight(
                id="mock_801645",
                provider="mock_provider",
                identification=FlightIdentification(
                    icao24="801645",
                    callsign="AIC6FW",
                    operator_icao="AIC",
                    operator_name="Air India",
                    is_nepal_registered=False
                ),
                position=FlightPosition(
                    latitude=26.74,
                    longitude=84.27,
                    altitude_baro_m=10668.0,
                    groundspeed_mps=233.0,
                    heading_deg=96.0
                )
            )
        ]

class FlightsAPITestCase(unittest.TestCase):
    def setUp(self):
        self.mock_provider = MockFlightProvider()
        # Inject mock provider into global flight service
        flight_service.provider = self.mock_provider
        self.client = TestClient(app)

    def tearDown(self):
        # Clear cache between tests
        import asyncio
        asyncio.run(flight_cache.clear())

    def test_get_live_flights_and_caching(self):
        """Test GET /api/v1/flights/live returns normalized flights and caches second call."""
        # Call 1: Cache miss
        res1 = self.client.get("/api/v1/flights/live")
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertEqual(data1["total"], 2)
        self.assertFalse(data1["cached"])
        self.assertEqual(self.mock_provider.call_count, 1)

        # Call 2: Cache hit
        res2 = self.client.get("/api/v1/flights/live")
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertEqual(data2["total"], 2)
        self.assertTrue(data2["cached"])
        self.assertGreaterEqual(data2["cache_age_seconds"], 0.0)
        self.assertEqual(self.mock_provider.call_count, 1)  # Provider was NOT called again

    def test_nepal_only_filter(self):
        """Test nepal_only=true filters to only Nepalese registered aircraft."""
        res = self.client.get("/api/v1/flights/live?nepal_only=true")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["flights"][0]["identification"]["icao24"], "70a8ee")
        self.assertTrue(data["flights"][0]["identification"]["is_nepal_registered"])

    def test_get_flight_by_icao24_success(self):
        """Test GET /api/v1/flights/{icao24} returns target flight."""
        res = self.client.get("/api/v1/flights/70a8ee")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["identification"]["callsign"], "BHA137")
        self.assertEqual(data["identification"]["operator_name"], "Buddha Air")

    def test_get_flight_by_icao24_not_found(self):
        """Test GET /api/v1/flights/{icao24} returns 404 for unknown flight."""
        res = self.client.get("/api/v1/flights/ffffff")
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertIn("error", data)
        self.assertEqual(data["error"]["type"], "FlightNotFoundError")

    def test_get_cache_stats(self):
        """Test GET /api/v1/flights/cache/stats returns diagnostic cache metrics."""
        res = self.client.get("/api/v1/flights/cache/stats")
        self.assertEqual(res.status_code, 200)
        stats = res.json()
        self.assertIn("hits", stats)
        self.assertIn("misses", stats)
        self.assertIn("hit_ratio", stats)

if __name__ == "__main__":
    unittest.main()
