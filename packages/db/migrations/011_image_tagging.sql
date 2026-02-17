-- Migration 011: Image tagging — entity + location junction tables
-- Allows linking extracted images to entities and locations for investigative use.

-- ─── image_entities junction table ─────────────────────────

CREATE TABLE image_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES document_images(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('subject', 'background', 'mentioned')),
  confidence TEXT DEFAULT 'confirmed' CHECK (confidence IN ('confirmed', 'likely', 'possible')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(image_id, entity_id)
);

CREATE INDEX idx_image_entities_image ON image_entities(image_id);
CREATE INDEX idx_image_entities_entity ON image_entities(entity_id);

-- ─── image_locations junction table ────────────────────────

CREATE TABLE image_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES document_images(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  confidence TEXT DEFAULT 'confirmed' CHECK (confidence IN ('confirmed', 'likely', 'possible')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(image_id, location_id)
);

CREATE INDEX idx_image_locations_image ON image_locations(image_id);
CREATE INDEX idx_image_locations_location ON image_locations(location_id);

-- ─── RLS (matches document_images pattern) ─────────────────

ALTER TABLE image_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_image_entities"
  ON image_entities FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "service_write_image_entities"
  ON image_entities FOR ALL
  TO service_role USING (true);

-- Also allow authenticated users to insert/delete (for admin tagging via API)
CREATE POLICY "authenticated_write_image_entities"
  ON image_entities FOR ALL
  TO authenticated USING (true);

ALTER TABLE image_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_image_locations"
  ON image_locations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "service_write_image_locations"
  ON image_locations FOR ALL
  TO service_role USING (true);

CREATE POLICY "authenticated_write_image_locations"
  ON image_locations FOR ALL
  TO authenticated USING (true);
