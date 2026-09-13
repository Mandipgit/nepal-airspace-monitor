"""
Integration Tests for Airports & Runways Endpoints
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
from starlette.testclient import TestClient
from app.main import app

class AirportsAPITestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_list_airports(self):
        """Test GET /api/v1/airports returns a valid paginated list."""
        res = self.client.get("/api/v1/airports?limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total", data)
        self.assertIn("airports", data)
        self.assertGreater(data["total"], 0)
        self.assertLessEqual(len(data["airports"]), 10)

    def test_get_nepal_airports(self):
        """Test GET /api/v1/airports/nepal returns all Nepalese airports."""
        res = self.client.get("/api/v1/airports/nepal")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["total"], 60)
        # Ensure Kathmandu (VNKT) is present
        idents = [a["ident"] for a in data["airports"]]
        self.assertIn("VNKT", idents)

    def test_get_airport_details_vnkt(self):
        """Test GET /api/v1/airports/VNKT returns Tribhuvan Intl details and physical runways."""
        res = self.client.get("/api/v1/airports/VNKT")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["ident"], "VNKT")
        self.assertEqual(data["iata_code"], "KTM")
        self.assertEqual(data["iso_country"], "NP")
        self.assertIn("runways", data)
        self.assertGreater(len(data["runways"]), 0)
        # Verify runway 02/20
        rw = data["runways"][0]
        self.assertEqual(rw["le_ident"], "02")
        self.assertEqual(rw["he_ident"], "20")
        self.assertGreater(rw["length_ft"], 10000)

    def test_get_airport_details_404(self):
        """Test GET /api/v1/airports/INVALID returns 404."""
        res = self.client.get("/api/v1/airports/ZZZZ")
        self.assertEqual(res.status_code, 404)

if __name__ == "__main__":
    unittest.main()
