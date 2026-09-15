"""
Supabase Client Service
Manages authenticated Supabase connections for persistent aviation datasets.
"""

import logging
import time
from typing import Optional, Dict, Any
import httpx
from supabase import create_client, Client

from app.config import get_settings

logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None
_supabase_admin_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """
    Get or create standard Supabase client.
    Uses service_role key on backend if available to bypass restrictive RLS policies for server-side queries.
    """
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        url = settings.get_canonical_supabase_url()
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be configured in environment.")
        _supabase_client = create_client(url, key)
        logger.info(f"Initialized Supabase client for project: {url}")
    return _supabase_client

def get_supabase_admin_client() -> Client:
    """
    Get or create administrative Supabase client initialized with service_role secret.
    Used exclusively server-side for dataset migrations, seeding, and administrative tasks.
    """
    global _supabase_admin_client
    if _supabase_admin_client is None:
        settings = get_settings()
        url = settings.get_canonical_supabase_url()
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.")
        _supabase_admin_client = create_client(url, key)
        logger.info(f"Initialized administrative Supabase client for project: {url}")
    return _supabase_admin_client

async def check_supabase_connection() -> Dict[str, Any]:
    """
    Perform a health check against the Supabase PostgREST root endpoint.
    Returns status, latency in milliseconds, and project URL.
    """
    settings = get_settings()
    base_url = settings.get_canonical_supabase_url()
    if not base_url:
        return {
            "status": "unconfigured",
            "message": "SUPABASE_URL is not set"
        }

    rest_url = f"{base_url}/rest/v1/"
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}"
    }

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(rest_url, headers=headers)
            latency_ms = round((time.time() - start) * 1000, 1)

            if resp.status_code in (200, 404):  # 200 or 404 on OpenAPI spec indicates active PostgREST
                return {
                    "status": "connected",
                    "http_status": resp.status_code,
                    "latency_ms": latency_ms,
                    "project_url": base_url
                }
            else:
                return {
                    "status": "error",
                    "http_status": resp.status_code,
                    "latency_ms": latency_ms,
                    "message": resp.text[:200]
                }
    except Exception as e:
        latency_ms = round((time.time() - start) * 1000, 1)
        return {
            "status": "unreachable",
            "latency_ms": latency_ms,
            "error": str(e)
        }
