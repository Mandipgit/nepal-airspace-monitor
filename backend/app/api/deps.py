"""
FastAPI Authentication Dependencies
Provides reusable dependency injection for extracting and validating authenticated users.
"""

import logging
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import decode_access_token
from app.schemas.auth import UserResponseSchema
from app.services.supabase.user_repository import user_repository

logger = logging.getLogger(__name__)

# Reusable HTTP Bearer authorization scheme
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> UserResponseSchema:
    """
    FastAPI dependency that extracts, verifies, and returns the currently authenticated user.
    Protects endpoints and injects user profile: `current_user = Depends(get_current_user)`.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials.strip()

    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.InvalidTokenError as e:
        logger.debug(f"Invalid JWT token presented: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_record = await user_repository.get_by_id(user_id)
    if not user_record or not user_record.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is inactive.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return UserResponseSchema(
        id=user_record["id"],
        first_name=user_record["first_name"],
        last_name=user_record["last_name"],
        email=user_record["email"],
        created_at=user_record.get("created_at")
    )
