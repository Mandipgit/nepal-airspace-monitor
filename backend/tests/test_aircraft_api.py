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
        # Obtain valid authentication session
        reg_res = self.client.post("/api/v1/auth/register", json={
            "first_name": "Aircraft",
            "last_name": "Tester",
            "email": "aircraft_tester@example.com",
            "password": "Password123!"
        })
        if reg_res.status_code == 201:
            self.token = reg_res.json()["access_token"]
        else:
            login_res = self.client.post("/api/v1/auth/login", json={
                "email": "aircraft_tester@example.com",
                "password": "Password123!"
            })
            self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_unauthenticated_request_rejected(self):
        """Test GET /api/v1/aircraft without token returns 401 Unauthorized."""
        res = self.client.get("/api/v1/aircraft")
        self.assertEqual(res.status_code, 401)

    def test_list_aircraft_specs(self):
        """Test GET /api/v1/aircraft returns list of models when authenticated."""
        res = self.client.get("/api/v1/aircraft?limit=10", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total", data)
        self.assertIn("specifications", data)
        self.assertGreater(data["total"], 200)
        self.assertLessEqual(len(data["specifications"]), 10)

    def test_filter_by_category(self):
        """Test GET /api/v1/aircraft?category=regional filters correctly."""
        res = self.client.get("/api/v1/aircraft?category=regional", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        for spec in data["specifications"]:
            self.assertEqual(spec["category"], "regional")

    def test_get_aircraft_spec_by_model(self):
        """Test GET /api/v1/aircraft/ATR72 returns ATR specs."""
        res = self.client.get("/api/v1/aircraft/ATR72", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("ATR", data["model"])
        self.assertEqual(data["engine_type"], "turboprop")
        self.assertGreater(data["mtow_kg"], 20000)

    def test_get_aircraft_spec_404(self):
        """Test GET /api/v1/aircraft/NONEXISTENT returns 404."""
        res = self.client.get("/api/v1/aircraft/NONEXISTENT_MODEL_XYZ", headers=self.headers)
        self.assertEqual(res.status_code, 404)

    def test_list_nepal_fleet(self):
        """Test GET /api/v1/aircraft/nepal/fleet returns registered aircraft with linked specs."""
        res = self.client.get("/api/v1/aircraft/nepal/fleet?limit=20", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total", data)
        self.assertIn("aircraft", data)
        self.assertGreaterEqual(data["total"], 80)
        self.assertLessEqual(len(data["aircraft"]), 20)

        # Verify junction linking
        linked = [ac for ac in data["aircraft"] if ac.get("specification") is not None]
        self.assertGreater(len(linked), 0)

    def test_filter_nepal_fleet_by_operator(self):
        """Test GET /api/v1/aircraft/nepal/fleet?operator=Buddha Air."""
        res = self.client.get("/api/v1/aircraft/nepal/fleet?operator=Buddha Air", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["total"], 0)
        for ac in data["aircraft"]:
            self.assertIn("buddha", ac["operator"].lower())

    def test_filter_nepal_fleet_by_typecode(self):
        """Test GET /api/v1/aircraft/nepal/fleet?typecode=DHC6."""
        res = self.client.get("/api/v1/aircraft/nepal/fleet?typecode=DHC6", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["total"], 4)
        for ac in data["aircraft"]:
            self.assertEqual(ac["typecode"], "DHC6")
            self.assertIsNotNone(ac.get("specification"))

    def test_get_nepal_aircraft_by_registration(self):
        """Test GET /api/v1/aircraft/nepal/9N-AOH returns aircraft with linked spec."""
        res = self.client.get("/api/v1/aircraft/nepal/9N-AOH", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["registration"], "9N-AOH")
        self.assertEqual(data["typecode"], "AT75")
        self.assertIsNotNone(data.get("specification"))
        self.assertIn("ATR", data["specification"]["model"])
        self.assertGreater(len(data.get("junction_links", [])), 0)

    def test_get_nepal_aircraft_by_icao24(self):
        """Test GET /api/v1/aircraft/nepal/70a8e5 returns aircraft by Mode-S hex."""
        res = self.client.get("/api/v1/aircraft/nepal/70a8e5", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["icao24"], "70a8e5")
        self.assertEqual(data["registration"], "9N-AOH")

    def test_get_nepal_aircraft_404(self):
        """Test GET /api/v1/aircraft/nepal/INVALID returns 404."""
        res = self.client.get("/api/v1/aircraft/nepal/9N-INVALID-999", headers=self.headers)
        self.assertEqual(res.status_code, 404)

if __name__ == "__main__":
    unittest.main()
