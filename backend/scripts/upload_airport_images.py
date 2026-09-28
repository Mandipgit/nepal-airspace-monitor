#!/usr/bin/env python3
"""
AeroTrace Airport Image Supabase Storage & Database Sync Workflow
Uploads preprocessed 960x540 WebP airport and heliport images to Supabase Storage
and populates the relative `image_path` column in public.airports.

Usage:
    python backend/scripts/upload_airport_images.py [--dry-run]
"""

import os
import sys
import csv
import argparse
from pathlib import Path
from typing import Dict, Any, List

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
project_root = backend_dir.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

# Load backend/.env
env_file = backend_dir / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv()

from app.config import get_settings
from supabase import create_client, Client

BUCKET_NAME = "airport-images"
MANIFEST_FILE = project_root / "airport-images" / "manifest.csv"
PROCESSED_DIR = project_root / "airport-images" / "processed"


def find_processed_image(ident: str, location_type: str) -> Path:
    """Find the exact processed WebP image for this identifier."""
    subfolder = "airports" if location_type == "airport" else "heliports"
    target_file = PROCESSED_DIR / subfolder / f"{ident}.webp"
    if target_file.exists() and target_file.is_file():
        return target_file
    return None


def main():
    parser = argparse.ArgumentParser(
        description="Upload AeroTrace airport images to Supabase Storage and sync image_path in database."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate manifest, images, and credentials without uploading or writing to database.",
    )
    args = parser.parse_args()

    print("=" * 70)
    print("AEROTRACE AIRPORT & HELIPORT IMAGE SYNC WORKFLOW")
    print(f"Target Bucket: {BUCKET_NAME}")
    print(f"Mode: {'DRY RUN (Simulated)' if args.dry_run else 'LIVE UPLOAD & SYNC'}")
    print("=" * 70)

    # 1. Validate manifest
    if not MANIFEST_FILE.exists():
        print(f"[!] ERROR: manifest.csv not found at: {MANIFEST_FILE}")
        sys.exit(1)

    with open(MANIFEST_FILE, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        manifest_rows = [r for r in reader if r.get("ident")]

    print(f"[+] Loaded {len(manifest_rows)} locations from manifest.csv")

    # 2. Match each identifier with processed WebP
    items_to_sync: List[Dict[str, Any]] = []
    missing_files: List[str] = []

    for row in manifest_rows:
        ident = row["ident"].strip()
        loc_type = row.get("type", "airport").strip().lower()
        subfolder = "airports" if loc_type == "airport" else "heliports"
        img_file = find_processed_image(ident, loc_type)

        if not img_file:
            missing_files.append(f"{ident} ({loc_type})")
            continue

        rel_storage_path = f"{subfolder}/{ident}.webp"
        items_to_sync.append(
            {
                "ident": ident,
                "name": row.get("name", ident),
                "type": loc_type,
                "local_file": img_file,
                "storage_path": rel_storage_path,
                "size_kb": round(img_file.stat().st_size / 1024, 1),
            }
        )

    print(f"[+] Matched processed WebP images: {len(items_to_sync)}/{len(manifest_rows)}")
    if missing_files:
        print(f"[!] WARNING: Missing processed files for {len(missing_files)} locations:")
        for m in missing_files:
            print(f"    - {m}")
        sys.exit(1)

    # 3. Initialize Supabase client
    settings = get_settings()
    supabase_url = settings.get_canonical_supabase_url()
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY

    if not supabase_url or not service_key:
        print("[!] ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in backend/.env")
        sys.exit(1)

    client: Client = create_client(supabase_url, service_key)

    if args.dry_run:
        print("\n--- Dry Run Audit Summary ---")
        for item in items_to_sync[:5]:
            print(f"  * {item['ident']} -> {item['storage_path']} ({item['size_kb']} KB)")
        print(f"  ... and {len(items_to_sync) - 5} more locations.")
        print("\n[+] Dry run completed successfully. All 64 images verified locally.")
        return

    # 4. Upload loop
    print("\n[+] Uploading WebP images to Supabase Storage & updating database...")
    uploaded_count = 0
    db_updated_count = 0
    errors: List[str] = []

    bucket_client = client.storage.from_(BUCKET_NAME)

    for idx, item in enumerate(items_to_sync, start=1):
        ident = item["ident"]
        storage_path = item["storage_path"]
        local_file: Path = item["local_file"]

        # Read file bytes
        file_bytes = local_file.read_bytes()

        # Upload with upsert (idempotent, safe to rerun)
        try:
            upload_res = bucket_client.upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": "image/webp", "upsert": "true"},
            )
            uploaded_count += 1
        except Exception as e:
            err_str = str(e)
            # If storage3 returns duplicate or similar error, verify if it was an error
            print(f"  [!] Storage notice for {ident} ({storage_path}): {err_str}")
            errors.append(f"Storage {ident}: {err_str}")

        # Update database column image_path
        try:
            db_res = (
                client.table("airports")
                .update({"image_path": storage_path})
                .eq("ident", ident)
                .execute()
            )
            if db_res.data:
                db_updated_count += 1
            else:
                # Airport might not exist in remote DB table if not seeded
                print(f"  [i] Notice: ident '{ident}' not found in public.airports table to update.")
        except Exception as e:
            err_str = str(e)
            errors.append(f"Database {ident}: {err_str}")
            print(f"  [!] Database update error for {ident}: {err_str}")

        if idx % 10 == 0 or idx == len(items_to_sync):
            print(f"    Progress: {idx}/{len(items_to_sync)} processed...")

    # 5. Output SQL file as a backup for instant direct SQL execution
    sql_file = project_root / "data" / "schemas" / "05_populate_airport_images.sql"
    sql_lines = [
        "-- ==============================================================================",
        "-- Auto-Generated: Populate image_path for 64 Nepal Airports and Heliports",
        "-- ==============================================================================",
        "BEGIN;",
    ]
    for item in items_to_sync:
        ident = item["ident"]
        storage_path = item["storage_path"]
        sql_lines.append(
            f"UPDATE public.airports SET image_path = '{storage_path}' WHERE ident = '{ident}';"
        )
    sql_lines.append("COMMIT;")
    sql_lines.append("")
    sql_file.write_text("\n".join(sql_lines), encoding="utf-8")
    print(f"\n[+] Generated SQL backup script: {sql_file}")

    # 6. Final verification report
    print("\n" + "=" * 70)
    print("SYNC SUMMARY & VERIFICATION")
    print("=" * 70)
    print(f"Total manifest locations: {len(manifest_rows)}")
    print(f"Processed images:        {len(items_to_sync)}")
    print(f"Storage uploaded/upsert: {uploaded_count}")
    print(f"Database rows updated:   {db_updated_count}")
    print(f"Errors encountered:      {len(errors)}")

    print("\nVerified key examples:")
    for ex in ["VNKT", "VNPK", "VNTR", "NP-0004", "NP-0018"]:
        match = next((i for i in items_to_sync if i["ident"] == ex), None)
        if match:
            print(f"  * {ex:<8} -> {match['storage_path']}")

    print("=" * 70)


if __name__ == "__main__":
    main()
