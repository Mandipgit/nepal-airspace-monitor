"""
Security and Cryptography Utilities
Implements OWASP-standard PBKDF2 password hashing and JWT token operations.
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
import jwt

from app.config import get_settings

# OWASP Recommended parameters for PBKDF2 with SHA-256
PBKDF2_ITERATIONS = 600_000
SALT_BYTES = 16


def hash_password(plain_password: str) -> str:
    """
    Hash plaintext password using PBKDF2-HMAC-SHA256 with 600,000 iterations.
    Returns serialized string: pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>
    """
    if not plain_password:
        raise ValueError("Password cannot be empty.")

    salt = secrets.token_bytes(SALT_BYTES)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify plaintext password against a serialized PBKDF2 hash using constant-time comparison.
    """
    if not plain_password or not hashed_password:
        return False

    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False

        iterations = int(parts[1])
        salt = bytes.fromhex(parts[2])
        expected_key = bytes.fromhex(parts[3])

        computed_key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt,
            iterations
        )
        return hmac.compare_digest(computed_key, expected_key)
    except Exception:
        return False


def create_access_token(
    subject: str,
    email: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Generate signed JWT access token containing subject (user_id), email, and expiration.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": str(subject),
        "email": str(email).lower().strip(),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT access token.
    Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure.
    """
    settings = get_settings()
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM]
    )


def hash_token(raw_token: str) -> str:
    """
    Compute SHA-256 hash of a token for secure database storage.
    """
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> Tuple[str, str]:
    """
    Generate a cryptographically secure random refresh token.
    Returns tuple of (raw_token, token_hash).
    """
    raw_token = secrets.token_urlsafe(48)
    token_hash = hash_token(raw_token)
    return raw_token, token_hash
