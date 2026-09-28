-- ==============================================================================
-- Migration: Add image_path to airports table
-- Target: Supabase (PostgreSQL 15+)
-- Description: Stores relative Supabase Storage path for airport/heliport WebP images
-- Example values: 'airports/VNKT.webp', 'heliports/NP-0004.webp'
-- ==============================================================================

-- 1. Add image_path column if it does not already exist
ALTER TABLE public.airports 
ADD COLUMN IF NOT EXISTS image_path TEXT;

-- 2. Optional index for queries filtering by image availability
CREATE INDEX IF NOT EXISTS idx_airports_image_path 
ON public.airports (image_path) 
WHERE image_path IS NOT NULL;

-- 3. Documentation comment
COMMENT ON COLUMN public.airports.image_path IS 
'Relative path to processed 960x540 WebP image in Supabase Storage bucket airport-images (e.g. airports/VNKT.webp)';
