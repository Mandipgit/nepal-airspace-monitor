"""
Unit Tests for Flight Data Enrichment Service
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
from unittest import mock
from app.models.flight import (
    NormalizedFlight,
    FlightIdentification,
    FlightPosition
)
from app.services.enrichment import enrichment_service, haversine_km, _make_route

class FlightEnrichmentTestCase(unittest.IsolatedAsyncioTestCase):
    def test_haversine_distance(self):
        """Test distance between Kathmandu (VNKT) and Pokhara (VNPK) ~146 km."""
        ktm_lat, ktm_lon = 27.6966, 85.3591
        pkr_lat, pkr_lon = 28.2009, 83.9821
        d = haversine_km(ktm_lat, ktm_lon, pkr_lat, pkr_lon)
        self.assertAlmostEqual(d, 146.0, delta=10.0)

    async def test_enrich_buddha_air_flight(self):
        """Test enrichment of flight with genuine type: sets nearest airport and ATR 72 specs."""
        flight = NormalizedFlight(
            id="opensky_70a8ee",
            provider="opensky",
            identification=FlightIdentification(
                icao24="70a8ee",
                callsign="BHA137",
                operator_icao="BHA",
                operator_name="Buddha Air",
                aircraft_type_icao="AT72",
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

    async def test_operator_without_aircraft_type_does_not_guess_specs(self):
        """Test that missing aircraft type for domestic airline does not guess fleet model."""
        flight = NormalizedFlight(
            id="opensky_70a8ee",
            provider="opensky",
            identification=FlightIdentification(
                icao24="70a8ee",
                callsign="BHA101",
                operator_icao="BHA",
                operator_name="Buddha Air",
                aircraft_type_icao=None
            ),
            position=FlightPosition(
                latitude=27.7,
                longitude=85.3
            )
        )
        enrichment_service._aircraft_meta_cache.pop("70a8ee", None)
        enrichment_service._aircraft_meta_timestamps.pop("70a8ee", None)

        enriched = await enrichment_service.enrich_flight(flight)
        self.assertIsNone(enriched.aircraft_spec)

    async def test_aic211_delhi_to_kathmandu(self):
        """Test Air India AIC211 is correctly resolved as DEL -> KTM from live API route data."""
        enrichment_service._route_cache["AIC211"] = _make_route("VIDP", "VNKT")
        enrichment_service._route_cache_timestamps["AIC211"] = 9999999999.0

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
        """Test Buddha Air BHA960 is correctly resolved as BDP -> KTM from live API route data."""
        enrichment_service._route_cache["BHA960"] = _make_route("VNCG", "VNKT")
        enrichment_service._route_cache_timestamps["BHA960"] = 9999999999.0

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

    async def test_domestic_flight_without_live_route_remains_none(self):
        """Test Buddha Air flight without live API route does not guess from flight number or heading."""
        flight = NormalizedFlight(
            id="opensky_70a8ee",
            provider="opensky",
            identification=FlightIdentification(
                icao24="70a8ee",
                callsign="BHA651",
                operator_icao="BHA",
                operator_name="Buddha Air",
                is_nepal_registered=True
            ),
            position=FlightPosition(
                latitude=27.7,
                longitude=84.5,
                altitude_baro_m=3000.0,
                heading_deg=270.0
            )
        )
        enrichment_service._route_cache.pop("BHA651", None)
        enrichment_service._route_cache_timestamps.pop("BHA651", None)

        enriched = await enrichment_service.enrich_flight(flight)
        self.assertIsNone(enriched.route)

    @mock.patch("httpx.AsyncClient.post")
    async def test_axb1035_delhi_to_guwahati(self, mock_post):
        """Test Air India Express AXB1035 resolves to DEL -> GAU (Guwahati), NOT DEL -> CCU (Kolkata)."""
        mock_resp = mock.MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "callsign": "AXB1035",
                "_airport_codes_iata": "DEL-GAU",
                "airport_codes": "VIDP-VEGT",
                "_airports": [
                    {"iata": "DEL", "icao": "VIDP", "name": "Indira Gandhi International Airport"},
                    {"iata": "GAU", "icao": "VEGT", "name": "Lokpriya Gopinath Bordoloi International Airport"}
                ]
            }
        ]
        mock_post.return_value = mock_resp

        # Clear cache for this callsign so mock is evaluated
        enrichment_service._route_cache.pop("AXB1035", None)
        enrichment_service._route_cache_timestamps.pop("AXB1035", None)

        flight = NormalizedFlight(
            id="opensky_801595",
            provider="opensky",
            identification=FlightIdentification(
                icao24="801595",
                callsign="AXB1035",
                operator_icao="AXB",
                operator_name="Air India Express",
                is_nepal_registered=False
            ),
            position=FlightPosition(
                latitude=26.2087,
                longitude=86.9587,
                altitude_baro_m=10668.0,
                groundspeed_mps=254.0,
                heading_deg=97.0
            )
        )

        enriched = await enrichment_service.enrich_flight(flight)
        self.assertIsNotNone(enriched.route)
        self.assertEqual(enriched.route.origin_iata, "DEL")
        self.assertEqual(enriched.route.origin_icao, "VIDP")
        self.assertEqual(enriched.route.destination_iata, "GAU")
        self.assertEqual(enriched.route.destination_icao, "VEGT")
        self.assertNotEqual(enriched.route.destination_iata, "CCU")

    async def test_unknown_high_altitude_overflight_does_not_fabricate_kolkata(self):
        """Test that unknown high-altitude flights do not invent fake Delhi-Kolkata routes."""
        flight = NormalizedFlight(
            id="opensky_unknown99",
            provider="opensky",
            identification=FlightIdentification(
                icao24="unknown99",
                callsign="NONEXISTENT_CALLSIGN_999",
                operator_icao=None
            ),
            position=FlightPosition(
                latitude=26.2,
                longitude=86.9,
                altitude_baro_m=11000.0,
                heading_deg=97.0
            )
        )

        enriched = await enrichment_service.enrich_flight(flight)
        self.assertIsNone(enriched.route)

    async def test_unverified_international_carrier_does_not_guess_kathmandu(self):
        """Test that an unverified international flight does not arbitrarily guess KTM destination."""
        flight = NormalizedFlight(
            id="opensky_qtr999",
            provider="opensky",
            identification=FlightIdentification(
                icao24="06a123",
                callsign="QTR999",
                operator_icao="QTR",
                operator_name="Qatar Airways"
            ),
            position=FlightPosition(
                latitude=27.5,
                longitude=85.0,
                altitude_baro_m=10000.0,
                heading_deg=90.0
            )
        )

        # Clear cache for this callsign
        enrichment_service._route_cache.pop("QTR999", None)
        enrichment_service._route_cache_timestamps.pop("QTR999", None)

        enriched = await enrichment_service.enrich_flight(flight)
        self.assertIsNone(enriched.route)

    async def test_nepal_callsign_9n_without_route_remains_none(self):
        """Test that a 9N helicopter or general aviation flight does not fabricate a KTM-PKR route."""
        flight = NormalizedFlight(
            id="opensky_70a999",
            provider="opensky",
            identification=FlightIdentification(
                icao24="70a999",
                callsign="9N-ANA",
                operator_icao=None,
                is_nepal_registered=True
            ),
            position=FlightPosition(
                latitude=28.0,
                longitude=84.0,
                altitude_baro_m=2000.0,
                heading_deg=180.0
            )
        )

        enrichment_service._route_cache.pop("9N-ANA", None)
        enrichment_service._route_cache_timestamps.pop("9N-ANA", None)

        enriched = await enrichment_service.enrich_flight(flight)
        self.assertIsNone(enriched.route)

    async def test_live_aircraft_meta_resolves_true_model_and_reg(self):
        """Test that dynamic aircraft metadata provides genuine type and registration from icao24."""
        # Prepopulate or mock aircraft metadata cache for 801595
        enrichment_service._aircraft_meta_cache["801595"] = {
            "type": "A321-251NX",
            "icao_type": "A321",
            "manufacturer": "Airbus",
            "registration": "VT-RTD",
            "registered_owner": "Air India Express",
            "operator_code": "AXB"
        }
        enrichment_service._aircraft_meta_timestamps["801595"] = 9999999999.0

        flight = NormalizedFlight(
            id="opensky_801595",
            provider="opensky",
            identification=FlightIdentification(
                icao24="801595",
                callsign="AXB1035",
                operator_icao="AXB",
                operator_name="Air India Express",
                is_nepal_registered=False
            ),
            position=FlightPosition(
                latitude=26.2,
                longitude=86.9,
                altitude_baro_m=10000.0,
                heading_deg=97.0
            )
        )

        enriched = await enrichment_service.enrich_flight(flight)
        # Should resolve to genuine Airbus A321 specs, NOT hardcoded B738
        self.assertIsNotNone(enriched.aircraft_spec)
        self.assertEqual(enriched.aircraft_spec["icao_type"], "A321")
        self.assertIn("A321", enriched.aircraft_spec["model"])
        self.assertEqual(enriched.identification.registration, "VT-RTD")
        self.assertEqual(enriched.identification.aircraft_type_icao, "A321")

if __name__ == "__main__":
    unittest.main()
