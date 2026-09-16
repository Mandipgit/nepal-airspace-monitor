"""
Integration Tests for Authentication Endpoints
Validates registration, login, JWT issuance, profile retrieval, refresh, and session revocation.
"""

import sys
import uuid
from datetime import timedelta
from pathlib import Path

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
from starlette.testclient import TestClient
from app.main import app
from app.core.security import create_access_token


class AuthAPITestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Use unique email per test run to prevent collision
        self.test_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
        self.test_password = "SecurePassword123!"
        self.first_name = "Jane"
        self.last_name = "Doe"

    def test_register_success(self):
        """Test POST /api/auth/register creates user and returns JWT session."""
        res = self.client.post("/api/auth/register", json={
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.test_email,
            "password": self.test_password
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn("access_token", data)
        self.assertIn("refresh_token", data)
        self.assertEqual(data["token_type"], "bearer")
        self.assertGreater(data["expires_in"], 0)

        user = data["user"]
        self.assertEqual(user["email"], self.test_email)
        self.assertEqual(user["first_name"], self.first_name)
        self.assertEqual(user["last_name"], self.last_name)
        self.assertIn("id", user)
        # Verify credentials are not leaked
        self.assertNotIn("password", user)
        self.assertNotIn("password_hash", user)

    def test_register_duplicate_email(self):
        """Test duplicate registration returns 409 Conflict."""
        payload = {
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.test_email,
            "password": self.test_password
        }
        # First registration
        res1 = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(res1.status_code, 201)

        # Duplicate attempt
        res2 = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(res2.status_code, 409)
        self.assertIn("already registered", res2.json()["error"]["message"])

    def test_register_weak_password(self):
        """Test registration with password under 8 characters returns 422."""
        res = self.client.post("/api/auth/register", json={
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.test_email,
            "password": "short"
        })
        self.assertEqual(res.status_code, 422)

    def test_register_invalid_email(self):
        """Test registration with malformed email format returns 422."""
        res = self.client.post("/api/auth/register", json={
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": "not-a-valid-email",
            "password": self.test_password
        })
        self.assertEqual(res.status_code, 422)

    def test_login_success(self):
        """Test POST /api/auth/login authenticates valid credentials."""
        # Register user first
        self.client.post("/api/auth/register", json={
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.test_email,
            "password": self.test_password
        })

        # Login
        res = self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": self.test_password
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("access_token", data)
        self.assertIn("refresh_token", data)
        self.assertEqual(data["user"]["email"], self.test_email)

    def test_login_incorrect_password(self):
        """Test POST /api/auth/login with wrong password returns 401."""
        self.client.post("/api/auth/register", json={
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.test_email,
            "password": self.test_password
        })

        res = self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": "WrongPassword999!"
        })
        self.assertEqual(res.status_code, 401)
        self.assertIn("Invalid email or password", res.json()["error"]["message"])

    def test_login_nonexistent_user(self):
        """Test POST /api/auth/login with unregistered email returns 401."""
        res = self.client.post("/api/auth/login", json={
            "email": f"unknown_{uuid.uuid4().hex[:8]}@example.com",
            "password": self.test_password
        })
        self.assertEqual(res.status_code, 401)
        self.assertIn("Invalid email or password", res.json()["error"]["message"])

    def test_get_me_authenticated(self):
        """Test GET /api/auth/me returns authenticated profile when valid JWT provided."""
        reg_res = self.client.post("/api/auth/register", json={
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.test_email,
            "password": self.test_password
        })
        token = reg_res.json()["access_token"]

        res = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["email"], self.test_email)
        self.assertEqual(data["first_name"], self.first_name)
        self.assertEqual(data["last_name"], self.last_name)
        self.assertNotIn("password", data)
        self.assertNotIn("password_hash", data)

    def test_get_me_unauthenticated(self):
        """Test GET /api/auth/me without token returns 401."""
        res = self.client.get("/api/auth/me")
        self.assertEqual(res.status_code, 401)

    def test_get_me_invalid_token(self):
        """Test GET /api/auth/me with forged token returns 401."""
        res = self.client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer forged.invalid.token"}
        )
        self.assertEqual(res.status_code, 401)

    def test_get_me_expired_token(self):
        """Test GET /api/auth/me with expired token returns 401."""
        # Create expired token (expired 1 hour ago)
        expired_token = create_access_token(
            subject="fake-user-id",
            email=self.test_email,
            expires_delta=timedelta(hours=-1)
        )
        res = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        self.assertEqual(res.status_code, 401)
        self.assertIn("expired", res.json()["detail"].lower())

    def test_refresh_token_flow(self):
        """Test POST /api/auth/refresh exchanges refresh token for new access token."""
        reg_res = self.client.post("/api/auth/register", json={
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.test_email,
            "password": self.test_password
        })
        refresh_token = reg_res.json()["refresh_token"]

        res = self.client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["user"]["email"], self.test_email)

    def test_logout_revokes_token(self):
        """Test POST /api/auth/logout revokes refresh token on server."""
        reg_res = self.client.post("/api/auth/register", json={
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.test_email,
            "password": self.test_password
        })
        token = reg_res.json()["access_token"]
        refresh_token = reg_res.json()["refresh_token"]

        # Logout
        logout_res = self.client.post(
            "/api/auth/logout",
            json={"refresh_token": refresh_token},
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(logout_res.status_code, 200)

        # Attempting refresh after logout must fail
        refresh_res = self.client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        self.assertEqual(refresh_res.status_code, 401)

    def test_v1_endpoint_compatibility(self):
        """Verify endpoints are also accessible under /api/v1/auth/."""
        email_v1 = f"v1_{uuid.uuid4().hex[:8]}@example.com"
        res = self.client.post("/api/v1/auth/register", json={
            "first_name": "Version",
            "last_name": "One",
            "email": email_v1,
            "password": self.test_password
        })
        self.assertEqual(res.status_code, 201)
        token = res.json()["access_token"]

        me_res = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()["email"], email_v1)


if __name__ == "__main__":
    unittest.main()
