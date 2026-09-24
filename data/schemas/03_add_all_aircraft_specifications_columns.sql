-- ==============================================================================
-- Nepal Flight Tracker - Aircraft Specifications Complete Schema Migration
-- Target: Supabase (PostgreSQL 15+)
-- Adds all airframe dimensions, aerodynamics, and propulsion columns:
-- fuselage_width (m), wing_span (m), wing_sweep25 (deg), wing_area (m2),
-- wing_position (string), htp_area (m2), vtp_area (m2), total_length (m),
-- total_height (m), owe (kg), mtow (kg), mlw (kg), max_fuel (kg),
-- n_engine (int), engine_y_arm (m), engine_type (string), thruster_type (string),
-- powerplant (string), bpr (no_dim), energy_type (string), engine_position (string),
-- rotor_diameter (m), max_power (kW), max_power_2 (kW), max_thrust (N),
-- cruise_altitude, landing_field_length_m (m).
-- ==============================================================================

-- 1. Dimensions & Geometry
ALTER TABLE public.aircraft_specifications 
ADD COLUMN IF NOT EXISTS fuselage_width NUMERIC(8, 3),
ADD COLUMN IF NOT EXISTS wing_span NUMERIC(8, 3),
ADD COLUMN IF NOT EXISTS wing_sweep25 NUMERIC(8, 3),
ADD COLUMN IF NOT EXISTS wing_area NUMERIC(8, 3),
ADD COLUMN IF NOT EXISTS wing_position TEXT,
ADD COLUMN IF NOT EXISTS htp_area NUMERIC(8, 3),
ADD COLUMN IF NOT EXISTS vtp_area NUMERIC(8, 3),
ADD COLUMN IF NOT EXISTS total_length NUMERIC(8, 3),
ADD COLUMN IF NOT EXISTS total_height NUMERIC(8, 3);

-- 2. Propulsion, Powerplant & Thrust
ALTER TABLE public.aircraft_specifications
ADD COLUMN IF NOT EXISTS thruster_type TEXT,
ADD COLUMN IF NOT EXISTS powerplant TEXT,
ADD COLUMN IF NOT EXISTS bpr NUMERIC(8, 3),
ADD COLUMN IF NOT EXISTS energy_type TEXT,
ADD COLUMN IF NOT EXISTS engine_position TEXT,
ADD COLUMN IF NOT EXISTS engine_y_arm NUMERIC(8, 3),
ADD COLUMN IF NOT EXISTS rotor_diameter NUMERIC(8, 3),
ADD COLUMN IF NOT EXISTS max_power NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS max_power_2 NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS max_thrust NUMERIC(12, 2);

-- 3. Weights, Altitudes & Runway Requirements
ALTER TABLE public.aircraft_specifications
ADD COLUMN IF NOT EXISTS owe NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS mtow NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS mlw NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS max_fuel NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS n_engine INTEGER,
ADD COLUMN IF NOT EXISTS cruise_altitude NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS landing_field_length_m INTEGER;

-- 4. Indexes for key dimensions & performance
CREATE INDEX IF NOT EXISTS idx_aircraft_specs_lfl ON public.aircraft_specifications (landing_field_length_m);
CREATE INDEX IF NOT EXISTS idx_aircraft_specs_wingspan ON public.aircraft_specifications (wing_span);
CREATE INDEX IF NOT EXISTS idx_aircraft_specs_mtow ON public.aircraft_specifications (mtow_kg);
