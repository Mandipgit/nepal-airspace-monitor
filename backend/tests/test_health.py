import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
from starlette.testclient import TestClient
from app.main import app

class HealthCheckTestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_root_health_endpoint(self):
        """Test GET /health returns 200 and valid JSON schema."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("environment", data)
        self.assertIn("version", data)
        self.assertIn("timestamp", data)

    def test_api_v1_health_endpoint(self):
        """Test GET /api/v1/health returns 200 and matches root health."""
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")

    def test_database_health_endpoint(self):
        """Test GET /api/v1/health/db returns structured status."""
        response = self.client.get("/api/v1/health/db")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)

if __name__ == "__main__":
    unittest.main()
