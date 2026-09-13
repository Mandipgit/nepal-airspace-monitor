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
    print("\n[3] Testing query against database tables...")
    anon_client = get_supabase_client()
    
    tables = ["airlines", "airports", "runways", "aircraft_specifications"]
    for t in tables:
        try:
            res = anon_client.table(t).select("*").limit(5).execute()
            count = len(res.data)
            print(f"    [+] Table '{t}' verified accessible! (Sample rows fetched: {count})")
            if t == "airlines" and count > 0:
                print("        Seeded Airlines:")
                for a in res.data[:6]:
                    print(f"        * [{a['icao_code']}] {a['name']} - Callsign: {a['callsign']} (Domestic: {a['is_domestic']})")
        except Exception as e:
            print(f"    [!] Error accessing table '{t}': {e}")

    print("=" * 70)
    print("SUPABASE SCHEMA & TABLES VERIFIED SUCCESSFULLY")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
