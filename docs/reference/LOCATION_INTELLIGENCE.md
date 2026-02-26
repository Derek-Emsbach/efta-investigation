# Location Intelligence

## Overview

The platform tracks physical locations referenced in the investigation and records when entities were at specific places on specific dates, using documentary evidence as the source. This enables co-location analysis (who was where together) and movement pattern reconstruction.

## Schema

Two core tables support location intelligence (defined in `packages/db/schema.sql`):

### `locations` — Physical Places

Every property, airport, office, court, or other place referenced in the investigation.

| Column | Type | Purpose |
|--------|------|---------|
| `name` | TEXT | Display name |
| `location_type` | TEXT | property, airport, office, court, restaurant, hotel, school, other |
| `address`, `city`, `state`, `country` | TEXT | Physical address |
| `latitude`, `longitude` | DECIMAL | Coordinates for map display |
| `owner_entity_id` | UUID FK | Entity that owns/controls this location |
| `aliases` | TEXT[] | Alternative names |
| `metadata` | JSONB | Flexible attributes |

**Current data:** 15 locations seeded via MCP Phase 3.

### `entity_sightings` — Entity at Location on Date

Records placing an entity at a specific location on a specific date, citing the source document.

| Column | Type | Purpose |
|--------|------|---------|
| `entity_id` | UUID FK | Who was seen |
| `location_id` | UUID FK | Where they were |
| `date` | DATE | When (required) |
| `time_start`, `time_end` | TIME | Optional time precision |
| `time_precision` | TEXT | exact, approximate, day, am_pm |
| `sighting_type` | TEXT | flight_departure, flight_arrival, present_at, email_sent_from, court_appearance, photo_at, financial_transaction, phone_call, text_message, witness_testimony, document_reference, residence |
| `confidence` | TEXT | confirmed, likely, possible, inferred |
| `with_entities` | UUID[] | Other entities present at same time |
| `document_id` | UUID FK | Source document for this sighting |

### `image_locations` — Image ↔ Location Tagging (Migration 011)

Links extracted images to locations (e.g., a photo identified as being at a specific property).

| Column | Type | Purpose |
|--------|------|---------|
| `image_id` | UUID FK | The document image |
| `location_id` | UUID FK | The identified location |
| `confidence` | TEXT | confirmed, likely, possible |

## MCP Server Tools

The MCP server (`services/efta-mcp-server/src/tools/sightings.ts`) provides 6 location-related tools:

| Tool | Purpose |
|------|---------|
| `create_location` | Create a new location record (property, airport, office, etc.) |
| `search_entity_locations` | Find sightings for an entity (with optional date/location filters) |
| `add_entity_location` | Record an entity being at a location on a date |
| `find_co_locations` | Find other entities seen at the same location within a date range |
| `get_location_timeline` | Get chronological sighting history for a location |
| `find_entities_at_location` | List all entities ever recorded at a specific location |

## Web UI

- **Photos page** (`/photos`): Location filter dropdown — shows images tagged with a specific location
- **Lightbox sidebar**: Add/remove location tags on individual images
- **Locations page** (`/locations`): Location browser (basic)

## What's Built vs Planned

**Built:**
- Schema (locations + entity_sightings + image_locations tables)
- MCP tools for CRUD + co-location queries
- Image-location tagging (UI + API)
- 15 locations seeded

**Planned (future):**
- Interactive map with pins at all known locations per entity
- Day-view timeline: intelligence briefing showing all entity movements for a given date
- Parallel entity timeline comparison (stack 2-3 entities side-by-side)
- Movement pattern analysis and visualization
- Flight log import (structured data from corpus)
- Location page with sighting history and co-location matrix
