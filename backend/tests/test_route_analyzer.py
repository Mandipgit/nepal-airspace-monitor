"""
Unit and Integration Tests for Route Aircraft Analyzer
Covers distance calculations, wind effects, range margins, runway margins,
Nepal airspace boundaries, error handling, authentication, and bulk comparisons.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
from starlette.testclient import TestClient
from app.main import app
from app.services.route_analyzer import route_analyzer_service
from app.schemas.route_analyzer import RouteAircraftAnalysisRequest


class RouteAircraftAnalyzerTestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Obtain valid authentication session
        reg_res = self.client.post("/api/auth/register", json={
            "first_name": "Analyzer",
            "last_name": "Tester",
            "email": "analyzer_tester@example.com",
            "password": "Password123!"
        })
        if reg_res.status_code == 201:
            self.token = reg_res.json()["access_token"]
        else:
            login_res = self.client.post("/api/auth/login", json={
                "email": "analyzer_tester@example.com",
                "password": "Password123!"
            })
            self.token = login_res.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_unauthenticated_request_rejected(self):
        """Test POST /api/v1/route-analyzer/analyze without token returns 401 Unauthorized."""
        payload = {
            "departure_ident": "VNKT",
            "destination_ident": "VNPK",
            "aircraft_identifiers": ["ATR72"]
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload)
        self.assertEqual(res.status_code, 401)

    def test_successful_analysis_single_aircraft(self):
        """Test standard route analysis for Kathmandu to Pokhara with ATR 72."""
        payload = {
            "departure_ident": "VNKT",
            "destination_ident": "VNPK",
            "aircraft_identifiers": ["ATR72"],
            "wind_kmh": 0,
            "descent_distance_km": 50
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Check route structure
        self.assertIn("route", data)
        self.assertEqual(data["route"]["departure"]["ident"], "VNKT")
        self.assertEqual(data["route"]["destination"]["ident"], "VNPK")
        self.assertAlmostEqual(data["route"]["distance_km"], 146.5, delta=10.0)

        # Check conditions
        self.assertEqual(data["conditions"]["wind_kmh"], 0.0)
        self.assertEqual(data["conditions"]["descent_distance_km"], 50.0)

        # Check runway info
        self.assertIn("destination_runway", data)
        self.assertGreater(data["destination_runway"]["runway_length_m"], 1000)

        # Check results
        self.assertEqual(len(data["results"]), 1)
        ac = data["results"][0]
        self.assertEqual(ac["aircraft_identifier"], "ATR72")
        self.assertIn("ATR", ac["aircraft_name"])
        self.assertGreater(ac["estimated_flight_time_min"], 10.0)
        self.assertGreater(ac["range_margin_km"], 1000.0)
        self.assertIn(ac["analysis_status"], ["within_calculated_limits", "outside_calculated_limits"])

    def test_comparison_multiple_aircraft(self):
        """Test multi-aircraft comparison and missing aircraft identification."""
        payload = {
            "departure_ident": "VNKT",
            "destination_ident": "VNPK",
            "aircraft_identifiers": ["ATR72", "Q400", "A320-200", "NONEXISTENT_FIGHTER_JET_999"],
            "wind_kmh": 10,
            "descent_distance_km": 40
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(len(data["results"]), 3)
        self.assertEqual(len(data["missing_aircraft"]), 1)
        self.assertEqual(data["missing_aircraft"][0], "NONEXISTENT_FIGHTER_JET_999")

        # Verify ATR72 and Q400 suitability
        idents = [r["aircraft_identifier"] for r in data["results"]]
        self.assertIn("ATR72", idents)
        self.assertIn("Q400", idents)
        self.assertIn("A320-200", idents)

    def test_wind_impact_on_flight_time(self):
        """Test headwind increases flight time while tailwind decreases it."""
        base_payload = {
            "departure_ident": "VNKT",
            "destination_ident": "VNPK",
            "aircraft_identifiers": ["ATR72"],
            "descent_distance_km": 50
        }

        # Calm
        res_calm = self.client.post(
            "/api/v1/route-analyzer/analyze",
            json={**base_payload, "wind_kmh": 0},
            headers=self.headers
        )
        time_calm = res_calm.json()["results"][0]["estimated_flight_time_min"]

        # Headwind (+50 km/h)
        res_headwind = self.client.post(
            "/api/v1/route-analyzer/analyze",
            json={**base_payload, "wind_kmh": 50},
            headers=self.headers
        )
        time_headwind = res_headwind.json()["results"][0]["estimated_flight_time_min"]

        # Tailwind (-50 km/h)
        res_tailwind = self.client.post(
            "/api/v1/route-analyzer/analyze",
            json={**base_payload, "wind_kmh": -50},
            headers=self.headers
        )
        time_tailwind = res_tailwind.json()["results"][0]["estimated_flight_time_min"]

        self.assertGreater(time_headwind, time_calm)
        self.assertLess(time_tailwind, time_calm)

    def test_excessive_headwind_handled_safely(self):
        """Test headwind exceeding cruise speed flags insufficient_ground_speed without 500 error."""
        payload = {
            "departure_ident": "VNKT",
            "destination_ident": "VNPK",
            "aircraft_identifiers": ["ATR72"],
            "wind_kmh": 390.0,  # ATR cruise is ~510 km/h, but let's test extreme
            "descent_distance_km": 50
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)

        # Direct service test with extreme wind
        req = RouteAircraftAnalysisRequest(
            departure_ident="VNKT",
            destination_ident="VNPK",
            aircraft_identifiers=["ATR72"],
            wind_kmh=600.0,  # Exceeds ATR cruise speed
            descent_distance_km=50
        )
        # Directly calling service to verify ground speed guard
        import asyncio
        resp = asyncio.run(route_analyzer_service.analyze_route(req))
        self.assertEqual(len(resp.results), 1)
        self.assertEqual(resp.results[0].analysis_status, "insufficient_ground_speed")
        self.assertFalse(resp.results[0].within_calculated_limits)
        self.assertIsNone(resp.results[0].estimated_flight_time_min)

    def test_runway_constraint_lukla(self):
        """Test landing at short runway (Lukla VNLK) flags large aircraft as outside limits."""
        payload = {
            "departure_ident": "VNKT",
            "destination_ident": "VNLK",
            "aircraft_identifiers": ["A320-200"],
            "wind_kmh": 0,
            "descent_distance_km": 30
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        ac = data["results"][0]
        # Lukla runway is ~527m, A320 requires ~1463m landing distance
        self.assertLess(ac["landing_runway_margin_m"], 0)
        self.assertFalse(ac["within_calculated_limits"])
        self.assertEqual(ac["analysis_status"], "outside_calculated_limits")

    def test_same_departure_destination_rejected(self):
        """Test same origin and destination returns 400 Bad Request."""
        payload = {
            "departure_ident": "VNKT",
            "destination_ident": "VNKT",
            "aircraft_identifiers": ["ATR72"]
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("must be different", res.json()["detail"])

    def test_missing_departure_airport(self):
        """Test non-existent departure airport returns 404."""
        payload = {
            "departure_ident": "ZZZZ",
            "destination_ident": "VNPK",
            "aircraft_identifiers": ["ATR72"]
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 404)
        self.assertIn("Departure airport 'ZZZZ' not found", res.json()["detail"])

    def test_missing_destination_airport(self):
        """Test non-existent destination airport returns 404."""
        payload = {
            "departure_ident": "VNKT",
            "destination_ident": "ZZZZ",
            "aircraft_identifiers": ["ATR72"]
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 404)
        self.assertIn("Destination airport 'ZZZZ' not found", res.json()["detail"])

    def test_non_nepal_airport_rejected(self):
        """Test foreign airport outside Nepal returns 400 Bad Request."""
        # Test foreign destination (e.g. Delhi VIDP)
        payload = {
            "departure_ident": "VNKT",
            "destination_ident": "VIDP",
            "aircraft_identifiers": ["ATR72"]
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        # VIDP might not be in offline Nepal catalog (404) or outside Nepal (400)
        self.assertIn(res.status_code, [400, 404])

    def test_route_information_endpoint(self):
        """Test GET /api/v1/route-analyzer/route returns distance, departure runway, and destination runway."""
        res = self.client.get(
            "/api/v1/route-analyzer/route?departure_ident=VNKT&destination_ident=VNPK",
            headers=self.headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["route"]["departure"]["ident"], "VNKT")
        self.assertEqual(data["route"]["destination"]["ident"], "VNPK")
        self.assertGreater(data["route"]["distance_km"], 100)

        # Verify departure runway details
        self.assertIn("departure_runway", data)
        dep_rw = data["departure_runway"]
        self.assertGreater(dep_rw["runway_length_m"], 3000)
        self.assertEqual(dep_rw["runway_length_ft"], 10991)
        self.assertEqual(dep_rw["surface"], "ASP")
        self.assertIn("02", dep_rw["runway_ident"])

        # Verify destination runway details
        self.assertIn("destination_runway", data)
        dest_rw = data["destination_runway"]
        self.assertGreater(dest_rw["runway_length_m"], 1000)
        self.assertGreater(dest_rw["runway_length_ft"], 3000)

        # Verify all physical runways list
        self.assertIn("departure_runways", data)
        self.assertGreater(len(data["departure_runways"]), 0)
        self.assertIn("destination_runways", data)
        self.assertGreater(len(data["destination_runways"]), 0)

    def test_flexible_airport_search_iata_and_names(self):
        """Test airport lookup using IATA codes, airport names, and municipality names."""
        # 1. IATA codes: KTM -> PKR
        res_iata = self.client.get(
            "/api/v1/route-analyzer/route?departure_ident=KTM&destination_ident=PKR",
            headers=self.headers
        )
        self.assertEqual(res_iata.status_code, 200)
        data_iata = res_iata.json()
        self.assertEqual(data_iata["route"]["departure"]["ident"], "VNKT")
        self.assertEqual(data_iata["route"]["destination"]["ident"], "VNPK")

        # 2. Municipality / City names: Kathmandu -> Pokhara
        res_city = self.client.get(
            "/api/v1/route-analyzer/route?departure=Kathmandu&destination=Pokhara",
            headers=self.headers
        )
        self.assertEqual(res_city.status_code, 200)
        data_city = res_city.json()
        self.assertEqual(data_city["route"]["departure"]["ident"], "VNKT")
        self.assertIn("Pokhara", data_city["route"]["destination"]["name"])

        # 3. Airport names: Tribhuvan -> Lukla (Tenzing-Hillary)
        res_names = self.client.get(
            "/api/v1/route-analyzer/route?departure_ident=Tribhuvan&destination_ident=Lukla",
            headers=self.headers
        )
        self.assertEqual(res_names.status_code, 200)
        data_names = res_names.json()
        self.assertEqual(data_names["route"]["departure"]["ident"], "VNKT")
        self.assertEqual(data_names["route"]["destination"]["ident"], "VNLK")

    def test_post_analyze_with_flexible_airport_names(self):
        """Test POST /analyze using city and IATA names resolves and returns departure runway."""
        payload = {
            "departure_ident": "Kathmandu",
            "destination_ident": "PKR",
            "aircraft_identifiers": ["ATR72"]
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["route"]["departure"]["ident"], "VNKT")
        self.assertEqual(data["route"]["destination"]["ident"], "VNPK")
        self.assertIn("departure_runway", data)
        self.assertIsNotNone(data["departure_runway"])
        self.assertGreater(data["departure_runway"]["runway_length_m"], 3000)
        self.assertGreater(data["destination_runway"]["runway_length_m"], 1000)

    def test_runway_margins_vncg_to_vnkt_departure_takeoff_vs_destination_landing(self):
        """
        Verify takeoff margin is evaluated against departure runway (VNCG ~1500m)
        and landing margin against destination runway (VNKT ~3350m).
        """
        payload = {
            "departure_ident": "VNCG",
            "destination_ident": "VNKT",
            "aircraft_identifiers": ["ATR72-500Basic"]
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        dep_rwy = data["departure_runway"]["runway_length_m"]
        dest_rwy = data["destination_runway"]["runway_length_m"]
        self.assertAlmostEqual(dep_rwy, 1500.0, delta=1.0)
        self.assertAlmostEqual(dest_rwy, 3350.1, delta=1.0)

        ac = data["results"][0]
        # ATR72-500Basic: TOFL = 1223m, LFL = 1048m
        # Takeoff margin at VNCG = 1500 - 1223 = ~277m (NOT ~2127m!)
        # Landing margin at VNKT = 3350.1 - 1048 = ~2302.1m
        self.assertAlmostEqual(ac["takeoff_runway_margin_m"], 277.0, delta=2.0)
        self.assertAlmostEqual(ac["landing_runway_margin_m"], 2302.1, delta=2.0)

    def test_multi_aircraft_independent_specification_calculation(self):
        """
        Verify each selected aircraft calculates using its own specifications,
        avoiding cross-model overwriting or incorrect loose matching.
        """
        payload = {
            "departure_ident": "VNKT",
            "destination_ident": "VNPK",
            "aircraft_identifiers": ["Airbus A320-200", "Airbus A320-200neo", "Boeing 737-800", "ATR72-500Basic"]
        }
        res = self.client.post("/api/v1/route-analyzer/analyze", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["results"]), 4)

        by_ident = {r["aircraft_identifier"]: r for r in data["results"]}
        self.assertIn("Airbus A320-200", by_ident)
        self.assertIn("Airbus A320-200neo", by_ident)
        self.assertIn("Boeing 737-800", by_ident)
        self.assertIn("ATR72-500Basic", by_ident)

        # Airbus A320-200 vs A320-200neo specs must not be identical corporate jetliner
        a320 = by_ident["Airbus A320-200"]
        a320neo = by_ident["Airbus A320-200neo"]
        self.assertEqual(a320["aircraft_name"], "Airbus A320-200")
        self.assertEqual(a320neo["aircraft_name"], "Airbus A320-200neo")
        self.assertNotEqual(a320["nominal_range_km"], a320neo["nominal_range_km"])


if __name__ == "__main__":
    unittest.main()
