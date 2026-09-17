"""
Unit Tests for Flight Data Enrichment Service
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
from app.models.flight import (
    NormalizedFlight,
    FlightIdentification,
    FlightPosition
)
from app.services.enrichment import enrichment_service, haversine_km

class FlightEnrichmentTestCase(unittest.IsolatedAsyncioTestCase):
    def test_haversine_distance(self):
        """Test distance between Kathmandu (VNKT) and Pokhara (VNPK) ~146 km."""
        ktm_lat, ktm_lon = 27.6966, 85.3591
        pkr_lat, pkr_lon = 28.2009, 83.9821
        d = haversine_km(ktm_lat, ktm_lon, pkr_lat, pkr_lon)
        self.assertAlmostEqual(d, 146.0, delta=10.0)

    async def test_enrich_buddha_air_flight(self):
        """Test enrichment of Buddha Air flight: sets nearest airport and ATR 72 specs."""
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
                latitude=27.9958,
                longitude=83.9536,
                altitude_baro_m=5433.0,
                groundspeed_mps=122.9,
                heading_deg=278.0
            )
        )

        enriched = await enrichment_service.enrich_flight(flight)
        
        # 1. Airport proximity check (near Pokhara)
        self.assertIsNotNone(enriched.nearest_airport)
        self.assertIn("PKR", enriched.nearest_airport)
        self.assertIsNotNone(enriched.nearest_airport_distance_km)
        self.assertLess(enriched.nearest_airport_distance_km, 50.0)

        # 2. Aircraft spec check (ATR 72)
        self.assertIsNotNone(enriched.aircraft_spec)
        self.assertIn("ATR", enriched.aircraft_spec["model"])
        self.assertEqual(enriched.aircraft_spec["engine_type"], "turboprop")

    async def test_unrecognized_flight_does_not_invent_specs(self):
        """Test that unknown operator does not fabricate aircraft specs."""
        flight = NormalizedFlight(
            id="opensky_ffffff",
            provider="opensky",
            identification=FlightIdentification(
                icao24="ffffff",
                callsign="UNKNOWN99",
                operator_icao=None
            ),
            position=FlightPosition(
                latitude=27.0,
                longitude=85.0
            )
        )

        enriched = await enrichment_service.enrich_flight(flight)
        self.assertIsNone(enriched.aircraft_spec)

    async def test_aic211_delhi_to_kathmandu(self):
        """Test Air India AIC211 is correctly resolved as DEL -> KTM (not KTM -> DEL)."""
        flight = NormalizedFlight(
            id="opensky_800589",
            provider="opensky",
            identification=FlightIdentification(
                icao24="800589",
                callsign="AIC211",
                operator_icao="AIC",
                operator_name="Air India",
                is_nepal_registered=False
            ),
            position=FlightPosition(
                latitude=27.4541,
                longitude=85.2492,
                altitude_baro_m=3223.0,
                heading_deg=22.0
            )
        )

        enriched = await enrichment_service.enrich_flight(flight)
        self.assertIsNotNone(enriched.route)
        self.assertEqual(enriched.route.origin_iata, "DEL")
        self.assertEqual(enriched.route.destination_iata, "KTM")

    async def test_bha960_bhadrapur_to_kathmandu(self):
        """Test Buddha Air BHA960 is correctly resolved as BDP -> KTM (not KTM -> KTM)."""
        flight = NormalizedFlight(
            id="opensky_70a8ee",
            provider="opensky",
            identification=FlightIdentification(
                icao24="70a8ee",
                callsign="BHA960",
                operator_icao="BHA",
                operator_name="Buddha Air",
                is_nepal_registered=True
            ),
            position=FlightPosition(
                latitude=26.9000,
                longitude=86.5000,
                altitude_baro_m=3000.0,
                heading_deg=290.0
            )
        )

        enriched = await enrichment_service.enrich_flight(flight)
        self.assertIsNotNone(enriched.route)
        self.assertEqual(enriched.route.origin_iata, "BDP")
        self.assertEqual(enriched.route.destination_iata, "KTM")

if __name__ == "__main__":
    unittest.main()
