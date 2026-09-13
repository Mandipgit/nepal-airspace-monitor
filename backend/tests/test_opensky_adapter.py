import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
from app.services.providers.opensky import OpenSkyProvider

class OpenSkyAdapterTestCase(unittest.TestCase):
    def setUp(self):
        self.provider = OpenSkyProvider()

    def test_normalize_buddha_air_vector(self):
        """Test normalization of live Buddha Air vector captured during Phase 1 probe."""
        # [icao24, callsign, origin_country, time_pos, last_contact, lon, lat, baro_alt, on_ground, velocity, heading, vert_rate, sensors, geo_alt, squawk, spi, pos_source, category]
        vector = [
            "70a8ee", "BHA137  ", "Nepal", 1726135706, 1726135706,
            83.9536, 27.9958, 5433.0, False, 122.9, 278.0, 1.2,
            None, 5500.0, "1200", False, 0, 0
        ]
        
        flight = self.provider._normalize_state_vector(vector)
        self.assertIsNotNone(flight)
        self.assertEqual(flight.id, "opensky_70a8ee")
        self.assertEqual(flight.provider, "opensky")
        self.assertEqual(flight.identification.icao24, "70a8ee")
        self.assertEqual(flight.identification.callsign, "BHA137")
        self.assertEqual(flight.identification.operator_icao, "BHA")
        self.assertEqual(flight.identification.operator_name, "Buddha Air")
        self.assertTrue(flight.identification.is_nepal_registered)
        self.assertEqual(flight.position.latitude, 27.9958)
        self.assertEqual(flight.position.longitude, 83.9536)
        self.assertEqual(flight.position.altitude_baro_m, 5433.0)
        self.assertEqual(flight.position.altitude_baro_ft, 17825)
        self.assertFalse(flight.position.on_ground)

    def test_normalize_shree_airlines_vector(self):
        """Test normalization of Shree Airlines vector with Nepalese ICAO24 allocation."""
        vector = [
            "70a8e9", "SHA826", "Nepal", 1726135700, 1726135700,
            84.9332, 27.7627, 3108.96, False, 133.2, 84.0, -4.5,
            None, 3150.0, None, False, 0, 0
        ]
        
        flight = self.provider._normalize_state_vector(vector)
        self.assertIsNotNone(flight)
        self.assertEqual(flight.identification.operator_icao, "SHA")
        self.assertEqual(flight.identification.operator_name, "Shree Airlines")
        self.assertTrue(flight.identification.is_nepal_registered)
        self.assertEqual(flight.position.altitude_baro_ft, 10200)

    def test_normalize_international_overflight(self):
        """Test normalization of international overflight (Air India)."""
        vector = [
            "801645", "AIC6FW  ", "India", 1726135710, 1726135710,
            84.2718, 26.7446, 10668.0, False, 233.0, 96.0, 0.0,
            None, 10700.0, "3412", False, 0, 0
        ]
        
        flight = self.provider._normalize_state_vector(vector)
        self.assertIsNotNone(flight)
        self.assertEqual(flight.identification.operator_icao, "AIC")
        self.assertEqual(flight.identification.operator_name, "Air India")
        self.assertFalse(flight.identification.is_nepal_registered)
        self.assertEqual(flight.position.altitude_baro_ft, 35000)

    def test_normalize_sparse_vector(self):
        """Test handling of sparse telemetry (null altitude, velocity, and callsign)."""
        vector = [
            "70a811", None, "Nepal", None, 1726135700,
            85.3, 27.7, None, False, None, None, None,
            None, None, None, False, 0, 0
        ]
        flight = self.provider._normalize_state_vector(vector)
        self.assertIsNotNone(flight)
        self.assertIsNone(flight.identification.callsign)
        self.assertIsNone(flight.position.altitude_baro_m)
        self.assertIsNone(flight.position.altitude_baro_ft)
        self.assertIsNone(flight.position.groundspeed_mps)

    def test_normalize_mlat_and_uat_sources(self):
        """Test normalization of MLAT and UAT position sources."""
        # MLAT vector (e.g. domestic ATR 72 tracked via multilateration)
        mlat_vector = [
            "70a8b1", "BHA619  ", "Nepal", 1726135706, 1726135706,
            83.98, 28.20, 2118.0, False, None, None, None,
            None, 2150.0, None, False, 2, 3
        ]
        flight_mlat = self.provider._normalize_state_vector(mlat_vector)
        self.assertIsNotNone(flight_mlat)
        self.assertEqual(flight_mlat.identification.callsign, "BHA619")
        self.assertEqual(flight_mlat.identification.position_source, "MLAT")
        self.assertEqual(flight_mlat.identification.category, 3)
        self.assertEqual(flight_mlat.identification.category_name, "Small (15,500 to 75,000 lbs)")
        self.assertIsNone(flight_mlat.position.groundspeed_mps)

        # UAT / ADS-R vector
        uat_vector = [
            "70a8c2", "NYT878  ", "Nepal", 1726135706, 1726135706,
            84.42, 27.68, 3360.0, False, 110.0, 90.0, 0.0,
            None, 3400.0, "1200", False, 4, 3
        ]
        flight_uat = self.provider._normalize_state_vector(uat_vector)
        self.assertIsNotNone(flight_uat)
        self.assertEqual(flight_uat.identification.callsign, "NYT878")
        self.assertEqual(flight_uat.identification.position_source, "UAT / ADS-R")

    def test_invalid_vector(self):
        """Test that invalid or empty state vectors return None."""
        self.assertIsNone(self.provider._normalize_state_vector([]))
        self.assertIsNone(self.provider._normalize_state_vector([None] * 18))

if __name__ == "__main__":
    unittest.main()
