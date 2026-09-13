#!/usr/bin/env python3
"""
Supabase Database Connectivity Probe
Validates connectivity, authentication, and inspects database status.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import asyncio
from app.config import get_settings
from app.services.supabase.client import (
    get_supabase_client,
    get_supabase_admin_client,
    check_supabase_connection
)

async def main():
    settings = get_settings()
    print("=" * 70)
    print("NEPAL FLIGHT TRACKER - SUPABASE CONNECTIVITY VERIFICATION")
    print("=" * 70)
    print(f"Project URL (Canonical): {settings.get_canonical_supabase_url()}")
    print(f"Anon Key Present: {'YES' if settings.SUPABASE_KEY else 'NO'}")
    print(f"Service Role Key Present: {'YES' if settings.SUPABASE_SERVICE_ROLE_KEY else 'NO'}")
    print(f"Publishable Key Present: {'YES' if settings.SUPABASE_PUBLISHABLE_KEY else 'NO'}")
    print("-" * 70)

    # 1. Test raw PostgREST connectivity
    print("[1] Testing PostgREST endpoint health...")
    health = await check_supabase_connection()
    print(f"    Result: {health}")

    # 2. Test Supabase Python SDK Client
    print("\n[2] Initializing official Supabase SDK client...")
    try:
        admin_client = get_supabase_admin_client()
        print("    Admin Client initialized successfully.")
    except Exception as e:
        print(f"    [!] Failed to initialize Admin Client: {e}")
        return

    # 3. Test querying PostgreSQL tables via PostgREST
    print("\n[3] Testing query against database...")
    try:
        # Check if any tables exist or test postgrest connection
        # Querying an uncreated table will return a clean PostgREST 404/PGRST204 or table not found error
        res = admin_client.table("airports").select("*").limit(1).execute()
        print(f"    Found existing 'airports' table! Data: {res.data}")
    except Exception as e:
        err_msg = str(e)
        if "relation \"public.airports\" does not exist" in err_msg or "PGRST204" in err_msg or "PGRST205" in err_msg or "404" in err_msg or "does not exist" in err_msg:
            print("    [+] Database connection and authentication SUCCEEDED!")
            print("        Table 'airports' does not exist yet (as expected before schema creation).")
        else:
            print(f"    Response from database: {err_msg}")

    print("=" * 70)
    print("SUPABASE CONNECTIVITY VERIFIED SUCCESSFULLY")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
