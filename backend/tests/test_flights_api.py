import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
# pyrefly: ignore [missing-import]
from starlette.testclient import TestClient

from app.main import app
from app.models.flight import (
    NormalizedFlight,
    FlightIdentification,
    FlightPosition,
    FlightRoute
)
from app.services.providers.base import BaseFlightProvider
from app.services.flight_service import FlightService, flight_service
from app.core.cache import flight_cache

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
                ),
                route=FlightRoute(
                    origin_icao="VIDP",
                    origin_iata="DEL",
                    origin_name="Indira Gandhi International",
                    destination_icao="VNKT",
                    destination_iata="KTM",
                    destination_name="Tribhuvan International"
                )
            )
        ]

class FlightsAPITestCase(unittest.TestCase):
    def setUp(self):
        self.mock_provider = MockFlightProvider()
        # Inject mock provider into global flight service
        flight_service.provider = self.mock_provider
        self.client = TestClient(app)
        # Obtain valid authentication session
        reg_res = self.client.post("/api/v1/auth/register", json={
            "first_name": "Flight",
            "last_name": "Tester",
            "email": "flight_tester@example.com",
            "password": "Password123!"
        })
        if reg_res.status_code == 201:
            self.token = reg_res.json()["access_token"]
        else:
            login_res = self.client.post("/api/v1/auth/login", json={
                "email": "flight_tester@example.com",
                "password": "Password123!"
            })
            self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        # Clear cache and track persistence buffer between tests
        import asyncio
        asyncio.run(flight_cache.clear())
        flight_service._track_store.clear()
        flight_service._trajectory_store.clear()
        flight_service._trajectory_metadata.clear()
        flight_service._trajectory_last_seen.clear()

    def test_unauthenticated_request_rejected(self):
        """Test GET /api/v1/flights/live without token returns 401 Unauthorized."""
        res = self.client.get("/api/v1/flights/live")
        self.assertEqual(res.status_code, 401)

    def test_get_live_flights_and_caching(self):
        """Test GET /api/v1/flights/live returns normalized flights and caches second call when authenticated."""
        # Call 1: Cache miss
        res1 = self.client.get("/api/v1/flights/live", headers=self.headers)
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertEqual(data1["total"], 2)
        self.assertFalse(data1["cached"])
        self.assertEqual(self.mock_provider.call_count, 1)

        # Call 2: Cache hit
        res2 = self.client.get("/api/v1/flights/live", headers=self.headers)
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertEqual(data2["total"], 2)
        self.assertTrue(data2["cached"])
        self.assertGreaterEqual(data2["cache_age_seconds"], 0.0)
        self.assertEqual(self.mock_provider.call_count, 1)  # Provider was NOT called again

    def test_nepal_only_filter(self):
        """Test nepal_only=true filters to only Nepalese registered aircraft."""
        res = self.client.get("/api/v1/flights/live?nepal_only=true", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["flights"][0]["identification"]["icao24"], "70a8ee")
        self.assertTrue(data["flights"][0]["identification"]["is_nepal_registered"])

    def test_get_flight_by_icao24_success(self):
        """Test GET /api/v1/flights/{icao24} returns target flight."""
        res = self.client.get("/api/v1/flights/70a8ee", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["identification"]["callsign"], "BHA137")
        self.assertEqual(data["identification"]["operator_name"], "Buddha Air")

    def test_get_flight_by_icao24_not_found(self):
        """Test GET /api/v1/flights/{icao24} returns 404 for unknown flight."""
        res = self.client.get("/api/v1/flights/ffffff", headers=self.headers)
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertIn("error", data)
        self.assertEqual(data["error"]["type"], "FlightNotFoundError")

    def test_get_flight_trajectory(self):
        """Test GET /api/v1/flights/{icao24}/trajectory returns breadcrumb trail."""
        # Prime the flights cache so trajectory has data
        self.client.get("/api/v1/flights/live", headers=self.headers)
        res = self.client.get("/api/v1/flights/70a8ee/trajectory", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["icao24"], "70a8ee")
        self.assertEqual(data["callsign"], "BHA137")
        self.assertGreaterEqual(data["total_points"], 1)
        # Latest point in chronological order is current aircraft position
        last_pt = data["points"][-1]
        self.assertEqual(last_pt["latitude"], 27.99)
    def test_nepal_context_filter_excludes_unrelated_flight_outside_nepal(self):
        """Test that foreign flights outside Nepal without Nepal origin/destination are excluded."""
        # Add an Indian domestic flight flying Lucknow -> Patna (outside Nepal)
        unrelated_flight = NormalizedFlight(
            id="mock_801999",
            provider="mock_provider",
            identification=FlightIdentification(
                icao24="801999",
                callsign="IGO612",
                operator_icao="IGO",
                operator_name="IndiGo",
                is_nepal_registered=False
            ),
            position=FlightPosition(
                latitude=26.20,
                longitude=83.50,
                altitude_baro_m=8000.0,
                groundspeed_mps=210.0,
                heading_deg=110.0
            ),
            route=FlightRoute(
                origin_icao="VILK",
                origin_iata="LKO",
                destination_icao="VEPT",
                destination_iata="PAT"
            )
        )
        async def mock_unrelated(*args, **kwargs):
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
                unrelated_flight
            ]
        self.mock_provider.get_live_flights = mock_unrelated
        res = self.client.get("/api/v1/flights/live?force_refresh=true", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        callsigns = [f["identification"]["callsign"] for f in data["flights"]]
        self.assertIn("BHA137", callsigns)
        self.assertNotIn("IGO612", callsigns)

    def test_overflight_transit_inside_nepal_boundary_included(self):
        """Test that foreign overflight flights entering Nepal boundary are included even without Nepal origin/dest."""
        transit_flight = NormalizedFlight(
            id="mock_802000",
            provider="mock_provider",
            identification=FlightIdentification(
                icao24="802000",
                callsign="THA319",
                operator_icao="THA",
                operator_name="Thai Airways",
                is_nepal_registered=False
            ),
            position=FlightPosition(
                latitude=27.6966,  # Inside Kathmandu / Nepal FIR
                longitude=85.3591,
                altitude_baro_m=11000.0,
                groundspeed_mps=240.0,
                heading_deg=280.0
            ),
            route=FlightRoute(
                origin_icao="VTBS",
                origin_iata="BKK",
                destination_icao="VIDP",
                destination_iata="DEL"
            )
        )
        async def mock_transit(*args, **kwargs):
            return [transit_flight]
        self.mock_provider.get_live_flights = mock_transit
        res = self.client.get("/api/v1/flights/live?force_refresh=true", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["flights"][0]["identification"]["callsign"], "THA319")

    def test_vns_varanasi_flight_excluded_from_nepal_corridors_mode(self):
        """Test that flight AXB1828 between VNS (Varanasi) and DEL (Delhi) is NOT considered a Nepal flight."""
        from app.services.nepal_airspace import is_nepal_airport, should_display_flight_in_nepal_context

        # Verify airport code classification: VNS is Indian IATA (Varanasi), not Nepalese
        self.assertFalse(is_nepal_airport("VNS"))
        self.assertFalse(is_nepal_airport("DEL"))
        self.assertFalse(is_nepal_airport("VIDP"))
        self.assertFalse(is_nepal_airport("VIBN"))
        self.assertTrue(is_nepal_airport("VNKT"))
        self.assertTrue(is_nepal_airport("KTM"))
        self.assertTrue(is_nepal_airport("VNPK"))
        self.assertTrue(is_nepal_airport("PKR"))

        vns_flight = NormalizedFlight(
            id="mock_80161c",
            provider="mock_provider",
            identification=FlightIdentification(
                icao24="80161c",
                callsign="AXB1828",
                operator_icao="AXB",
                operator_name="Air India Express",
                origin_country="India",
                is_nepal_registered=False
            ),
            position=FlightPosition(
                latitude=27.6210,
                longitude=79.7546,  # Uttar Pradesh, India (outside Nepal boundary)
                altitude_baro_m=9754.0,
                groundspeed_mps=231.0,
                heading_deg=310.0
            ),
            route=FlightRoute(
                origin_icao="VIBN",
                origin_iata="VNS",
                origin_name="Lal Bahadur Shastri",
                destination_icao="VIDP",
                destination_iata="DEL",
                destination_name="Indira Gandhi Intl"
            )
        )

        self.assertFalse(should_display_flight_in_nepal_context(vns_flight))

        async def mock_vns(*args, **kwargs):
            return [vns_flight]
        self.mock_provider.get_live_flights = mock_vns

        # In Nepal Corridors mode (nepal_context_only=True): AXB1828 should be excluded
        res_nepal = self.client.get("/api/v1/flights/live?nepal_context_only=true&force_refresh=true", headers=self.headers)
        self.assertEqual(res_nepal.status_code, 200)
        self.assertEqual(res_nepal.json()["total"], 0)

        # In All Traffic mode (nepal_context_only=False): AXB1828 should be included
        res_all = self.client.get("/api/v1/flights/live?nepal_context_only=false&force_refresh=true", headers=self.headers)
        self.assertEqual(res_all.status_code, 200)
        self.assertEqual(res_all.json()["total"], 1)
        self.assertEqual(res_all.json()["flights"][0]["identification"]["callsign"], "AXB1828")

if __name__ == "__main__":
    unittest.main()



