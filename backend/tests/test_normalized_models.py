"""
Unit Tests for Normalized Flight Domain Models
"""

import unittest
from datetime import datetime, timezone
from backend.app.models.flight import (
    FlightPosition,
    FlightIdentification,
    NormalizedFlight,
    FlightCollectionResponse
)

class NormalizedFlightModelsTestCase(unittest.TestCase):
    def test_flight_position_conversions(self):
        """Test computed aviation unit conversions (m -> ft, m/s -> kts, m/s -> fpm)."""
        pos = FlightPosition(
            latitude=27.7,
            longitude=85.3,
            altitude_baro_m=3048.0,  # ~10,000 ft
            groundspeed_mps=102.88,  # ~200 kts
            vertical_rate_mps=5.08,  # ~1,000 fpm
            heading_deg=90.0,
            on_ground=False
        )
        
        self.assertEqual(pos.altitude_baro_ft, 10000)
        self.assertEqual(pos.groundspeed_kts, 200)
        self.assertEqual(pos.vertical_rate_fpm, 1000)

    def test_flight_position_null_safety(self):
        """Ensure position model gracefully returns None for missing telemetry without errors."""
        pos = FlightPosition(
            latitude=None,
            longitude=None,
            altitude_baro_m=None,
            groundspeed_mps=None,
            vertical_rate_mps=None
        )
        self.assertIsNone(pos.altitude_baro_ft)
        self.assertIsNone(pos.groundspeed_kts)
        self.assertIsNone(pos.vertical_rate_fpm)

    def test_normalized_flight_creation(self):
        """Test complete NormalizedFlight model instantiation and serialization."""
        flight = NormalizedFlight(
            id="opensky_70a8ee",
            provider="opensky",
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
                altitude_baro_m=5455.9,
                groundspeed_mps=122.4,
                heading_deg=280.0,
                on_ground=False
            )
        )
        self.assertEqual(flight.id, "opensky_70a8ee")
        self.assertEqual(flight.identification.operator_name, "Buddha Air")
        self.assertTrue(flight.identification.is_nepal_registered)
        self.assertEqual(flight.position.altitude_baro_ft, 17900)
        self.assertEqual(flight.position.groundspeed_kts, 238)

    def test_flight_collection_response(self):
        """Test API envelope response serialization."""
        res = FlightCollectionResponse(
            total=1,
            timestamp=datetime.now(timezone.utc),
            cached=False,
            cache_age_seconds=0.0,
            flights=[]
        )
        self.assertEqual(res.total, 1)
        self.assertFalse(res.cached)

if __name__ == "__main__":
    unittest.main()
