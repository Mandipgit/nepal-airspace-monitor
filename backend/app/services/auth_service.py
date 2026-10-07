"""
Authentication Service
Coordinates user registration, credential verification, JWT issuance, and session revocation.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from app.config import get_settings
from app.core.errors import AppError
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_refresh_token,
    hash_token
)
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponseSchema,
    TokenResponseSchema
)
from app.services.supabase.user_repository import user_repository, UserRepository

logger = logging.getLogger(__name__)


class AuthService:
    """Core authentication logic orchestrator."""

    def __init__(self, repo: Optional[UserRepository] = None):
        self.repo = repo or user_repository

    async def register(self, req: UserRegisterRequest) -> TokenResponseSchema:
        """Register a new user, enforce email uniqueness, and issue initial session tokens."""
        clean_email = req.email.strip().lower()

        # Check existing user
        existing = await self.repo.get_by_email(clean_email)
        if existing:
            raise AppError(
                message=f"Email '{clean_email}' is already registered.",
                status_code=409,
                details={"email": clean_email}
            )

        # Hash password securely using PBKDF2-HMAC-SHA256
        pw_hash = hash_password(req.password)

        # Create user record
        user_record = await self.repo.create_user(
            email=clean_email,
            password_hash=pw_hash,
            first_name=req.first_name,
            last_name=req.last_name
        )

        return await self._build_token_response(user_record)

    async def login(self, req: UserLoginRequest) -> TokenResponseSchema:
        """Authenticate user credentials and issue session JWT tokens."""
        clean_email = req.email.strip().lower()

        # Lookup user by email
        user_record = await self.repo.get_by_email(clean_email)
        if not user_record:
            raise AppError(
                message="Invalid email or password.",
                status_code=401
            )

        if not user_record.get("is_active", True):
            raise AppError(
                message="User account is inactive.",
                status_code=401
            )

        # Verify password securely
        is_valid = verify_password(req.password, user_record.get("password_hash", ""))
        if not is_valid:
            raise AppError(
                message="Invalid email or password.",
                status_code=401
            )

        return await self._build_token_response(user_record)

    async def refresh(self, raw_refresh_token: str) -> TokenResponseSchema:
        """Validate an active refresh token and issue a new access token."""
        token_hash = hash_token(raw_refresh_token.strip())
        token_record = await self.repo.get_refresh_token(token_hash)

        if not token_record or token_record.get("revoked", False):
            raise AppError(
                message="Invalid or revoked refresh token.",
                status_code=401
            )

        # Check expiration
        expires_str = token_record.get("expires_at", "")
        try:
            expires_at = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires_at:
                raise AppError(message="Refresh token has expired.", status_code=401)
        except (ValueError, TypeError):
            raise AppError(message="Malformed refresh token expiration.", status_code=401)

        # Load user profile
        user_record = await self.repo.get_by_id(token_record["user_id"])
        if not user_record or not user_record.get("is_active", True):
            raise AppError(message="User account not found or inactive.", status_code=401)

        # Issue new access token while retaining existing refresh token
        settings = get_settings()
        access_token = create_access_token(
            subject=user_record["id"],
            email=user_record["email"]
        )

        user_schema = UserResponseSchema(
            id=user_record["id"],
            first_name=user_record["first_name"],
            last_name=user_record["last_name"],
            email=user_record["email"],
            created_at=user_record.get("created_at")
        )

        return TokenResponseSchema(
            access_token=access_token,
            refresh_token=raw_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_schema
        )

    async def logout(self, raw_refresh_token: Optional[str]) -> bool:
        """Revoke the user's active refresh token session."""
        if raw_refresh_token:
            token_hash = hash_token(raw_refresh_token.strip())
            return await self.repo.revoke_refresh_token(token_hash)
        return True

    async def verify_google_session(
        self,
        supabase_token: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None
    ) -> TokenResponseSchema:
        """
        Verify a Google-authenticated Supabase session, create or update the user's
        AeroTrace profile, and issue AeroTrace session JWT tokens.
        """
        from app.services.supabase.client import get_supabase_client
        supabase = get_supabase_client()
        try:
            auth_response = supabase.auth.get_user(supabase_token.strip())
            supabase_user = auth_response.user
            if not supabase_user or not supabase_user.email:
                raise AppError(message="Invalid Google authentication session.", status_code=401)
        except Exception as e:
            logger.error(f"Supabase auth token verification error: {e}")
            raise AppError(message="Could not verify Google authentication session.", status_code=401)

        email = supabase_user.email.strip().lower()
        user_id = str(supabase_user.id)

        # Derive first and last name:
        # Prefer user's explicitly submitted profile data (as instructed)
        # Fallback to Google user_metadata if available
        user_meta = supabase_user.user_metadata or {}
        g_full_name = user_meta.get("full_name") or user_meta.get("name") or ""
        g_given_name = user_meta.get("given_name") or ""
        g_family_name = user_meta.get("family_name") or ""

        final_first_name = (first_name or "").strip()
        if not final_first_name:
            if g_given_name:
                final_first_name = g_given_name
            elif g_full_name:
                final_first_name = g_full_name.split()[0]
            else:
                final_first_name = email.split("@")[0].capitalize()

        final_last_name = (last_name or "").strip()
        if not final_last_name:
            if g_family_name:
                final_last_name = g_family_name
            elif g_full_name and len(g_full_name.split()) > 1:
                final_last_name = " ".join(g_full_name.split()[1:])
            else:
                final_last_name = "User"

        # Check if AeroTrace profile already exists by user_id or by email
        existing_user = await self.repo.get_by_id(user_id)
        if not existing_user:
            existing_user = await self.repo.get_by_email(email)

        if existing_user:
            user_record = existing_user
            logger.info(f"Existing user authenticated via Google: {email} (ID: {user_record['id']})")
        else:
            now_iso = datetime.now(timezone.utc).isoformat()
            user_data = {
                "id": user_id,
                "email": email,
                "password_hash": "",
                "first_name": final_first_name,
                "last_name": final_last_name,
                "is_active": True,
                "created_at": now_iso,
                "updated_at": now_iso
            }
            try:
                client = self.repo._get_client()
                res = client.table("users").insert(user_data).execute()
                if res.data:
                    user_record = res.data[0]
                else:
                    user_record = user_data
            except Exception as e:
                logger.error(f"Error persisting new Google user to Supabase: {e}")
                user_record = user_data

            self.repo._in_memory_users[user_record["id"]] = user_record
            self.repo._in_memory_by_email[email] = user_record["id"]
            logger.info(f"New user created via Google: {email} (ID: {user_record['id']})")

        return await self._build_token_response(user_record)


    async def _build_token_response(self, user_record: Dict[str, Any]) -> TokenResponseSchema:
        """Helper to create JWT access token, persist hashed refresh token, and return envelope."""
        settings = get_settings()
        user_id = user_record["id"]
        email = user_record["email"]

        # Generate JWT access token
        access_token = create_access_token(subject=user_id, email=email)

        # Generate and persist refresh token
        raw_refresh, token_hash = generate_refresh_token()
        refresh_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        await self.repo.save_refresh_token(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=refresh_expires
        )

        user_schema = UserResponseSchema(
            id=user_id,
            first_name=user_record["first_name"],
            last_name=user_record["last_name"],
            email=email,
            created_at=user_record.get("created_at")
        )

        return TokenResponseSchema(
            access_token=access_token,
            refresh_token=raw_refresh,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_schema
        )


auth_service = AuthService()
