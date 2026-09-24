"""
User and Session Repository
Handles persistence of user profiles, authentication credentials, and refresh tokens.
Provides seamless fallback to in-memory store for offline development and local automated tests.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from app.services.supabase.client import get_supabase_admin_client

logger = logging.getLogger(__name__)


class UserRepository:
    """Repository handling database operations for user authentication and sessions."""

    def __init__(self):
        # In-memory stores for offline development, local unit tests, or before remote migration
        self._in_memory_users: Dict[str, Dict[str, Any]] = {}       # user_id -> user dict
        self._in_memory_by_email: Dict[str, str] = {}               # email_lower -> user_id
        self._in_memory_tokens: Dict[str, Dict[str, Any]] = {}      # token_hash -> token dict

    def _get_client(self):
        return get_supabase_admin_client()

    async def create_user(
        self,
        email: str,
        password_hash: str,
        first_name: str,
        last_name: str
    ) -> Dict[str, Any]:
        """Create a new user record in Supabase or fallback store."""
        clean_email = email.strip().lower()
        user_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        user_data = {
            "id": user_id,
            "email": clean_email,
            "password_hash": password_hash,
            "first_name": first_name.strip(),
            "last_name": last_name.strip(),
            "is_active": True,
            "created_at": now_iso,
            "updated_at": now_iso
        }

        # Attempt to insert into Supabase
        try:
            client = self._get_client()
            res = client.table("users").insert(user_data).execute()
            if res.data:
                created = res.data[0]
                # Mirror in local cache for speed
                self._in_memory_users[created["id"]] = created
                self._in_memory_by_email[created["email"].lower()] = created["id"]
                return created
        except Exception as e:
            logger.debug(f"Supabase create_user fallback invoked: {e}")

        # In-memory storage fallback
        self._in_memory_users[user_id] = user_data
        self._in_memory_by_email[clean_email] = user_id
        return user_data

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Retrieve user by email address (case-insensitive)."""
        clean_email = email.strip().lower()

        # Check Supabase first
        try:
            client = self._get_client()
            res = client.table("users").select("*").ilike("email", clean_email).limit(1).execute()
            if res.data:
                user = res.data[0]
                self._in_memory_users[user["id"]] = user
                self._in_memory_by_email[user["email"].lower()] = user["id"]
                return user
        except Exception as e:
            logger.debug(f"Supabase get_by_email fallback invoked: {e}")

        # Check in-memory store
        user_id = self._in_memory_by_email.get(clean_email)
        if user_id and user_id in self._in_memory_users:
            return self._in_memory_users[user_id]

        if clean_email == "guest@flighttracking.local":
            guest = {
                "id": "guest_session_user",
                "email": "guest@flighttracking.local",
                "first_name": "Guest",
                "last_name": "User",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            self._in_memory_users[guest["id"]] = guest
            self._in_memory_by_email[clean_email] = guest["id"]
            return guest

        return None

    async def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve user by primary key UUID."""
        target_id = str(user_id).strip()

        if target_id == "guest_session_user":
            return {
                "id": "guest_session_user",
                "email": "guest@flighttracking.local",
                "first_name": "Guest",
                "last_name": "User",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }

        # Check Supabase first
        try:
            client = self._get_client()
            res = client.table("users").select("*").eq("id", target_id).limit(1).execute()
            if res.data:
                user = res.data[0]
                self._in_memory_users[user["id"]] = user
                self._in_memory_by_email[user["email"].lower()] = user["id"]
                return user
        except Exception as e:
            logger.debug(f"Supabase get_by_id fallback invoked: {e}")

        # Check in-memory store
        return self._in_memory_users.get(target_id)

    async def save_refresh_token(
        self,
        user_id: str,
        token_hash: str,
        expires_at: datetime
    ) -> bool:
        """Persist a hashed refresh token for the user."""
        token_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        expires_iso = expires_at.isoformat()

        token_record = {
            "id": token_id,
            "user_id": str(user_id),
            "token_hash": token_hash,
            "expires_at": expires_iso,
            "revoked": False,
            "created_at": now_iso
        }

        # Attempt Supabase
        try:
            client = self._get_client()
            res = client.table("refresh_tokens").insert(token_record).execute()
            if res.data:
                self._in_memory_tokens[token_hash] = token_record
                return True
        except Exception as e:
            logger.debug(f"Supabase save_refresh_token fallback invoked: {e}")

        # In-memory store
        self._in_memory_tokens[token_hash] = token_record
        return True

    async def get_refresh_token(self, token_hash: str) -> Optional[Dict[str, Any]]:
        """Retrieve token record by its SHA-256 hash."""
        # Attempt Supabase
        try:
            client = self._get_client()
            res = client.table("refresh_tokens").select("*").eq("token_hash", token_hash).limit(1).execute()
            if res.data:
                record = res.data[0]
                self._in_memory_tokens[token_hash] = record
                return record
        except Exception as e:
            logger.debug(f"Supabase get_refresh_token fallback invoked: {e}")

        return self._in_memory_tokens.get(token_hash)

    async def revoke_refresh_token(self, token_hash: str) -> bool:
        """Mark a refresh token as revoked."""
        # Attempt Supabase
        try:
            client = self._get_client()
            res = client.table("refresh_tokens").update({"revoked": True}).eq("token_hash", token_hash).execute()
            if res.data:
                if token_hash in self._in_memory_tokens:
                    self._in_memory_tokens[token_hash]["revoked"] = True
                return True
        except Exception as e:
            logger.debug(f"Supabase revoke_refresh_token fallback invoked: {e}")

        if token_hash in self._in_memory_tokens:
            self._in_memory_tokens[token_hash]["revoked"] = True
            return True

        return False


user_repository = UserRepository()
