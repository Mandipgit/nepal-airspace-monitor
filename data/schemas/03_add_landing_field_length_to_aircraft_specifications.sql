-- ==============================================================================
-- Nepal Flight Tracker - Aircraft Specifications Schema Migration
-- Target: Supabase (PostgreSQL 15+)
-- Adds missing landing_field_length_m (LFL) column to aircraft_specifications table
-- ==============================================================================

-- 1. Add landing_field_length_m column to aircraft_specifications
ALTER TABLE public.aircraft_specifications 
ADD COLUMN IF NOT EXISTS landing_field_length_m INTEGER;

COMMENT ON COLUMN public.aircraft_specifications.landing_field_length_m IS 'Landing field length in meters (required landing ground distance under standard conditions)';

-- 2. Create index for performance filtering
CREATE INDEX IF NOT EXISTS idx_aircraft_specs_lfl ON public.aircraft_specifications (landing_field_length_m);
