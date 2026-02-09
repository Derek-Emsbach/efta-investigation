# Location Intelligence

> **Status:** Placeholder — full specification coming in Phase 2.

## Overview

This document will cover:

- **Location tracking** — Properties, airports, offices, courts, and other physical locations referenced in the investigation
- **Entity sightings** — Placing entities at specific locations on specific dates using documentary evidence
- **Day-view timeline** — Intelligence briefing view showing all entity movements, events, and communications for a given date
- **Co-location queries** — Identifying when multiple entities were at the same location at the same time

## Schema Support

The database already supports location intelligence through two tables:
- `locations` — Physical places with coordinates, type, and ownership
- `entity_sightings` — Entity-location-date records with confidence levels and co-location tracking

See `packages/db/schema.sql` for full column definitions.
