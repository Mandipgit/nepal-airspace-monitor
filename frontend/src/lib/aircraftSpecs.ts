/**
 * Centralized Aircraft Specification Explanations and Metadata
 * Provides human-readable descriptions, technical meanings, and units for all 25+ airframe and propulsion metrics.
 */

export interface SpecExplanation {
  field: string;
  meaning: string;
  layman: string;
  unit?: string;
}

export const SPEC_EXPLANATIONS: Record<string, SpecExplanation> = {
  // Weights (kg)
  oew_kg: {
    field: "oew_kg",
    meaning: "Operating Empty Weight (OEW)",
    layman:
      "How much the aircraft weighs when it's basically empty of passengers, cargo, and usable fuel. Think aircraft's own weight + essential equipment.",
    unit: "kg",
  },
  owe: {
    field: "owe",
    meaning: "Operating Weight Empty (OWE)",
    layman:
      "Weight of the aircraft structure, engines, operational equipment, and crew, but excluding payload and fuel.",
    unit: "kg",
  },
  mtow_kg: {
    field: "mtow_kg",
    meaning: "Maximum Takeoff Weight (MTOW)",
    layman:
      "The heaviest the aircraft is legally allowed to be when taking off. This includes the aircraft, fuel, passengers, baggage, etc.",
    unit: "kg",
  },
  mtow: {
    field: "mtow",
    meaning: "Maximum Takeoff Weight",
    layman: "Maximum certified total gross mass permitted at brake release for takeoff.",
    unit: "kg",
  },
  mlw_kg: {
    field: "mlw_kg",
    meaning: "Maximum Landing Weight (MLW)",
    layman:
      "The heaviest the aircraft should be when landing. It is usually lower than MTOW because landing puts significant stress on the aircraft.",
    unit: "kg",
  },
  mlw: {
    field: "mlw",
    meaning: "Maximum Landing Weight",
    layman: "Maximum gross weight at which the airframe structure can safely touch down.",
    unit: "kg",
  },
  fuel_capacity_liters: {
    field: "fuel_capacity_liters",
    meaning: "Fuel Capacity",
    layman: "The maximum total volume of fuel the aircraft tanks can accommodate, measured in liters.",
    unit: "L",
  },
  max_fuel: {
    field: "max_fuel",
    meaning: "Maximum Fuel Mass",
    layman: "The maximum usable fuel mass the aircraft can carry, measured in kilograms.",
    unit: "kg",
  },

  // Capacities & Speeds
  passenger_capacity: {
    field: "passenger_capacity",
    meaning: "Passenger Capacity",
    layman: "Maximum number of passengers the aircraft is certified to carry in standard configuration.",
    unit: "seats",
  },
  takeoff_field_length_m: {
    field: "takeoff_field_length_m",
    meaning: "Takeoff Field Length (TOFL)",
    layman: "Approximate runway distance needed to take off safely under standard ISA conditions at sea level.",
    unit: "m",
  },
  landing_field_length_m: {
    field: "landing_field_length_m",
    meaning: "Landing Field Length (LFL)",
    layman:
      "Approximate runway distance needed to safely touch down and come to a complete stop under standard conditions.",
    unit: "m",
  },
  approach_speed_kts: {
    field: "approach_speed_kts",
    meaning: "Approach Speed (Vapp)",
    layman: "Approximate calibrated airspeed the aircraft flies when approaching the runway threshold for landing.",
    unit: "kts",
  },
  cruise_speed_kts: {
    field: "cruise_speed_kts",
    meaning: "Normal Cruise Speed (TAS)",
    layman: "Typical true airspeed while flying normally in level cruise flight.",
    unit: "kts",
  },
  max_speed_kts: {
    field: "max_speed_kts",
    meaning: "Maximum Speed (Vmo/Mmo)",
    layman: "Fastest published/approved maximum operating airspeed under relevant atmospheric conditions.",
    unit: "kts",
  },
  nominal_range_nm: {
    field: "nominal_range_nm",
    meaning: "Nominal Flight Range",
    layman: "Approximate maximum operational distance the aircraft can fly with typical payload and standard fuel reserves.",
    unit: "NM",
  },
  cruise_altitude: {
    field: "cruise_altitude",
    meaning: "Design Cruise Altitude",
    layman: "Optimum design cruise altitude under standard atmospheric conditions.",
    unit: "ft",
  },

  // Airframe Dimensions & Aerodynamics (m, deg, m2)
  fuselage_width: {
    field: "fuselage_width",
    meaning: "Fuselage Outer Width",
    layman: "Maximum outer width/diameter of the main fuselage cabin body in meters.",
    unit: "m",
  },
  wing_span: {
    field: "wing_span",
    meaning: "Total Wing Span",
    layman: "Total straight-line distance from wingtip to wingtip in meters.",
    unit: "m",
  },
  wing_sweep25: {
    field: "wing_sweep25",
    meaning: "Wing Sweep (25% Chord)",
    layman: "Angle at which the wing leading structure slants backward relative to the lateral axis, measured at 25% chord line.",
    unit: "deg",
  },
  wing_area: {
    field: "wing_area",
    meaning: "Wing Reference Area",
    layman: "Total planform surface area of the wing structure in square meters (m²), determining aerodynamic lift.",
    unit: "m²",
  },
  wing_position: {
    field: "wing_position",
    meaning: "Wing Placement",
    layman: "Vertical mounting position of the wing on the fuselage (e.g. low-wing or high-wing architecture).",
  },
  htp_area: {
    field: "htp_area",
    meaning: "Horizontal Tailplane Area",
    layman: "Surface area of the horizontal tail stabilizer in square meters (m²), providing pitch stability and elevator control.",
    unit: "m²",
  },
  vtp_area: {
    field: "vtp_area",
    meaning: "Vertical Tailplane Area",
    layman: "Surface area of the vertical fin and rudder in square meters (m²), providing yaw directional stability.",
    unit: "m²",
  },
  total_length: {
    field: "total_length",
    meaning: "Total Aircraft Length",
    layman: "Overall nose-to-tail length of the aircraft in meters.",
    unit: "m",
  },
  total_height: {
    field: "total_height",
    meaning: "Total Aircraft Height",
    layman: "Vertical height from the ground landing gear plane to the highest point on the tail fin in meters.",
    unit: "m",
  },

  // Engines, Propulsion & Powerplant
  engine_model: {
    field: "engine_model",
    meaning: "Engine Model Designation",
    layman: "Specific manufacturer powerplant model variant certified and installed on this airframe.",
  },
  powerplant: {
    field: "powerplant",
    meaning: "Powerplant Model",
    layman: "Certified engine model designation installed on this aircraft variant.",
  },
  number_of_engines: {
    field: "number_of_engines",
    meaning: "Number of Engines",
    layman: "Total number of primary propulsion engines mounted on the aircraft.",
  },
  n_engine: {
    field: "n_engine",
    meaning: "Number of Engines",
    layman: "Total count of primary propulsion engines installed.",
  },
  engine_type: {
    field: "engine_type",
    meaning: "Propulsion Engine Type",
    layman: "The propulsion technology category (e.g. Turbofan, Turboprop, or Piston).",
  },
  thruster_type: {
    field: "thruster_type",
    meaning: "Thruster Mechanism",
    layman: "Primary propulsive mechanism converting engine energy into thrust (e.g. propeller or turbofan duct).",
  },
  bpr: {
    field: "bpr",
    meaning: "Bypass Ratio (BPR)",
    layman: "Ratio between air mass bypassing the core vs. entering the combustion core. Higher BPR delivers better fuel economy.",
  },
  energy_type: {
    field: "energy_type",
    meaning: "Energy / Fuel Source",
    layman: "Primary combustible fuel source (e.g. aviation kerosene Jet A/A-1 or avgas gasoline).",
  },
  engine_position: {
    field: "engine_position",
    meaning: "Engine Location",
    layman: "Physical mounting location of the powerplants on the airframe (e.g. under the wing or on the rear fuselage).",
  },
  engine_y_arm: {
    field: "engine_y_arm",
    meaning: "Engine Lateral Arm (Y-Arm)",
    layman: "Lateral distance in meters from the aircraft longitudinal centerline to the engine thrust centerline.",
    unit: "m",
  },
  rotor_diameter: {
    field: "rotor_diameter",
    meaning: "Propeller / Rotor Diameter",
    layman: "Tip-to-tip diameter of the rotating propeller or rotor disk in meters.",
    unit: "m",
  },
  max_power: {
    field: "max_power",
    meaning: "Maximum Engine Power",
    layman: "Peak mechanical power delivered per engine at takeoff in kilowatts (kW).",
    unit: "kW",
  },
  max_power_2: {
    field: "max_power_2",
    meaning: "Secondary Power Rating",
    layman: "Contingency, emergency, or alternate takeoff power rating per engine in kilowatts (kW).",
    unit: "kW",
  },
  max_thrust: {
    field: "max_thrust",
    meaning: "Maximum Takeoff Thrust",
    layman: "Total peak forward propulsive force generated at full takeoff throttle, measured in Newtons (N).",
    unit: "N",
  },

  // Classifications
  category: {
    field: "category",
    meaning: "Aircraft Category",
    layman: "Operational classification based on design, weight, and passenger capacity envelope.",
  },
  icao_type: {
    field: "icao_type",
    meaning: "ICAO Type Designator",
    layman: "Standard 2-4 character international designator assigned by ICAO for air traffic management.",
  },

  // Civil Aviation Authority of Nepal (CAAN) Registry
  registration: {
    field: "registration",
    meaning: "Tail Registration Mark",
    layman: "Official national civil aircraft alphanumeric identification mark displayed on the tail or fuselage.",
  },
  owner: {
    field: "owner",
    meaning: "Registered Aircraft Owner",
    layman: "The registered corporate airline, commercial carrier, or lessor holding legal title to the airframe.",
  },
  serial_number: {
    field: "serial_number",
    meaning: "Manufacturer Serial Number (MSN)",
    layman: "Unique factory construction sequence number assigned by the aircraft manufacturer.",
  },
  built_year: {
    field: "built_year",
    meaning: "Construction Year",
    layman: "The year or maiden assembly completion date when the aircraft was manufactured.",
  },
  registered_date: {
    field: "registered_date",
    meaning: "CAAN Registration Date",
    layman: "Official date registered in Nepal's Civil Aviation Authority civil aircraft registry.",
  },
  reg_until: {
    field: "reg_until",
    meaning: "Registration Certificate Expiry",
    layman: "Current validity expiry date of the Certificate of Registration issued by CAAN.",
  },
  status: {
    field: "status",
    meaning: "Airworthiness / Operational Status",
    layman: "Current certification or airworthiness status reported in the national civil aircraft registry.",
  },
  icao_aircraft_class: {
    field: "icao_aircraft_class",
    meaning: "ICAO Aircraft Class",
    layman: "ICAO designator defining airframe configuration, land/seaplane operational capability, and propulsion count.",
  },
  engines_desc: {
    field: "engines",
    meaning: "Powerplant Installation",
    layman: "Factory engine powerplant configuration and manufacturer engine model designations.",
  },
};
