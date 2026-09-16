-- ============================================================================
-- EFTA AUDIT — ADDENDUM: VICTIM-DEFAULT POLICY
-- Generated 2026-07-31. Run AFTER efta_entity_audit_migration.sql.
--
-- Policy chosen 2026-07-31: where it is unclear whether a person is a
-- witness, an associate, or a victim, they are treated as a VICTIM.
-- Never published. No category implying involvement. Flagged for review.
-- The error we are willing to make is over-protecting someone who turns out
-- not to need it. The error we are not willing to make is the reverse.
--
-- Reversible. Creates its own backup. Deletes nothing.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS entities_backup_victimdefault_20260731 AS
  SELECT * FROM entities;

-- ---------------------------------------------------------------------------
-- 1. "Ion" — the specific record this policy was decided for.
--
-- An unidentified guest whose stay at Epstein's Paris apartment was arranged
-- by Lesley Groff — the assistant this same database documents as scheduling
-- victims. Categorised "witness" on no evidence whatsoever. Nobody has
-- established who this person is, and the arrangement pattern is the same one
-- the investigation documents for victims.
-- ---------------------------------------------------------------------------
UPDATE entities
   SET tier = 5,
       category = 'unresolved_possible_victim',
       status = 'unresolved_identity',
       is_public = false,
       profile_published = false,
       tier_justification =
         'VICTIM-DEFAULT POLICY (2026-07-31). Identity unresolved. Travel '
         'arranged by Lesley Groff, documented elsewhere in this database as '
         'scheduling victims. Prior category "witness" rested on no evidence. '
         'Treated as a victim until affirmatively established otherwise. '
         'PERMANENT PUBLICATION BLOCK — do not lift without documentary proof '
         'of identity and role.',
       updated_at = now()
 WHERE name = 'Ion'
    OR name ILIKE 'Ion (%';

-- ---------------------------------------------------------------------------
-- 2. Karyna Shuliak — flagged in the audit as a private individual, never
--    charged, whose record concedes no evidence of criminality, and whom
--    nobody has assessed for victim status. Same policy applies.
-- ---------------------------------------------------------------------------
UPDATE entities
   SET category = 'unresolved_possible_victim',
       is_public = false,
       profile_published = false,
       tier_justification = COALESCE(tier_justification, '') ||
         ' | VICTIM-DEFAULT POLICY (2026-07-31): private individual, never '
         'charged, victim status never assessed. Publication blocked pending '
         'that assessment.',
       updated_at = now()
 WHERE name = 'Karyna Shuliak';

-- ---------------------------------------------------------------------------
-- 3. Standing guard — no Tier 5 record may ever be public without an explicit
--    decision recorded on the row itself.
--
-- Currently exempt (deliberately, and correctly): Annie Farmer asked the court
-- to speak in her true name and testified openly at the Maxwell trial;
-- Virginia Giuffre was a self-identified public advocate. Both remain public.
-- Every other Tier 5 record is forced private.
-- ---------------------------------------------------------------------------
UPDATE entities
   SET is_public = false,
       profile_published = false,
       updated_at = now()
 WHERE tier = 5
   AND name NOT IN ('Annie Farmer', 'Virginia Giuffre');

-- ---------------------------------------------------------------------------
-- 4. Enforcement trigger — refuse to publish a Tier 5 record unless the row
--    carries an explicit, recorded consent basis. This makes the policy
--    structural rather than a thing someone has to remember.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_victim_publication()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier = 5
     AND (NEW.is_public OR NEW.profile_published)
     AND COALESCE(NEW.metadata->>'publication_consent_basis', '') = '' THEN
    RAISE EXCEPTION
      'Tier 5 (victim) record "%" cannot be published without '
      'metadata.publication_consent_basis stating why publication is '
      'appropriate (e.g. testified publicly under own name; self-identified '
      'public advocate).', NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_victim_publication ON entities;
CREATE TRIGGER trg_guard_victim_publication
  BEFORE INSERT OR UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION guard_victim_publication();

-- Record the consent basis for the two who are legitimately public, so the
-- trigger does not fight you on the next update to their rows.
UPDATE entities
   SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb),
         '{publication_consent_basis}',
         '"Asked the court to speak in her true name at the July 2019 bail hearing; testified openly under her own name at the Maxwell trial."')
 WHERE name = 'Annie Farmer';

UPDATE entities
   SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb),
         '{publication_consent_basis}',
         '"Self-identified public victim advocate who spoke and litigated publicly under her own name for years."')
 WHERE name = 'Virginia Giuffre';

COMMIT;

-- ============================================================================
-- ROLLBACK
--   DROP TRIGGER IF EXISTS trg_guard_victim_publication ON entities;
--   UPDATE entities e
--      SET tier = b.tier, category = b.category, status = b.status,
--          is_public = b.is_public, profile_published = b.profile_published,
--          tier_justification = b.tier_justification, metadata = b.metadata
--     FROM entities_backup_victimdefault_20260731 b
--    WHERE e.id = b.id;
-- ============================================================================
