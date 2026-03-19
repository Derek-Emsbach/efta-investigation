-- Migration 027: Add 'trump' to stories section CHECK constraint
-- Required for the Trump investigation story series (Stories 31-35)

-- Drop the existing CHECK constraint and recreate with 'trump' added
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_section_check;

ALTER TABLE stories ADD CONSTRAINT stories_section_check
  CHECK (section IN ('the-network', 'follow-the-money', 'the-cover-up', 'the-operation', 'voices', 'trump'));
