# Nepal Flight Tracker

A Nepal-focused flight tracking web application engineered to monitor, track, and enrich live aircraft movements operating in and around Nepalese airspace.

## Architecture Highlights

* **Provider-Agnostic Core**: Built on a normalized internal flight data model. Sourced initially from the **OpenSky Network** ADS-B feed, with a flexible adapter layer designed to integrate **FlightAware AeroAPI** seamlessly.
* **Server-Side API & Security**: The frontend communicates solely with a **FastAPI** backend. All third-party credentials, polling timers, and caching mechanisms remain protected on the server.
* **Enrichment with Persistent Datasets**: Aviation reference data (airports, runways, aircraft specifications, airline registrations) are stored persistently in **Supabase (PostgreSQL)**, while high-frequency live aircraft telemetry remains transient in-memory.
* **Interactive Frontend**: Modern, responsive interface built with **Next.js**, **TypeScript**, and **Tailwind CSS**, featuring directional aircraft markers, flight detail cards, and airport runway visualization.

---

## Monorepo Structure

```text
nepal-flight-tracker/
├── backend/                  # FastAPI backend, data providers, caching, enrichment
│   ├── app/                  # Application code (API, models, schemas, services)
│   ├── scripts/              # Independent probes & database seeding scripts
│   ├── tests/                # Automated unit & integration tests
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Backend environment variable template
├── frontend/                 # Next.js web application
│   ├── src/                  # App router, UI components, hooks, type definitions
│   ├── package.json          # Node dependencies
│   └── .env.example          # Frontend environment variable template
├── data/                     # Raw datasets & Supabase SQL schemas
│   ├── raw/                  # Reference CSV/JSON files (airports, runways, aircraft specs)
│   └── schemas/              # PostgreSQL schema definitions & migrations
└── docs/                     # Architecture records, probe logs, API schemas
    ├── architecture.md
    └── opensky_experiment_log.md
```

---

## Development Principles

1. **Anti-Vibe-Coding**: Every layer is built in verified, incremental stages with empirical validation.
2. **Cost & Rate Consciousness**: External API access is debounced and cached to honor provider limits.
3. **Zero Fabricated Live Data**: Unresolved or missing fields remain transparently null; no fake coordinates or mock aircraft masquerade as live flights.

---

## License

MIT License - see [LICENSE](LICENSE) for details.
