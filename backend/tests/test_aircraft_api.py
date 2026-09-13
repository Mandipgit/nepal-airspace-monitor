"""
Integration Tests for Aircraft Specifications Endpoints
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
from starlette.testclient import TestClient
from app.main import app

class AircraftAPITestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_list_aircraft_specs(self):
        """Test GET /api/v1/aircraft returns list of models."""
        res = self.client.get("/api/v1/aircraft?limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total", data)
        self.assertIn("specifications", data)
        self.assertGreater(data["total"], 200)
        self.assertLessEqual(len(data["specifications"]), 10)

    def test_filter_by_category(self):
        """Test GET /api/v1/aircraft?category=regional filters correctly."""
        res = self.client.get("/api/v1/aircraft?category=regional")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        for spec in data["specifications"]:
            self.assertEqual(spec["category"], "regional")

    def test_get_aircraft_spec_by_model(self):
        """Test GET /api/v1/aircraft/ATR72 returns ATR specs."""
        res = self.client.get("/api/v1/aircraft/ATR72")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("ATR", data["model"])
        self.assertEqual(data["engine_type"], "turboprop")
        self.assertGreater(data["mtow_kg"], 20000)

    def test_get_aircraft_spec_404(self):
        """Test GET /api/v1/aircraft/NONEXISTENT returns 404."""
        res = self.client.get("/api/v1/aircraft/NONEXISTENT_MODEL_XYZ")
        self.assertEqual(res.status_code, 404)

if __name__ == "__main__":
    unittest.main()
