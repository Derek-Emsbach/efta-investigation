/**
 * Connection Graph Enrichment
 * 
 * Reads all `connected_to` connections, sends them to Claude API
 * in batches for relationship type classification, then updates the DB.
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';

const envFile = readFileSync('apps/web/.env.local', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; })
    .filter(Boolean)
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 10;

// Valid relationship types
const VALID_TYPES = [
  'attorney_for', 'family_of', 'co_accused', 'trafficked_by', 'trafficked_for',
  'employed_by', 'hired_by', 'financial', 'social', 'professional',
  'investigated_by', 'referred_by', 'protected_by', 'associated_with', 'connected_to'
];

// ── Manual overrides ────────────────────────────────────────────────────────
// Key: "Entity A Name → Entity B Name", Value: corrected type
// These override Claude's classification where it got the relationship wrong.
const OVERRIDES = {
  // T1 journal-named individuals are NOT traffickers — victims were trafficked TO them
  // Use co_accused (named in forensic victim evidence) not trafficked_by
  'Steve Case → Ghislaine Maxwell': 'co_accused',
  'Steve Case → Jeffrey Epstein': 'co_accused',
  'Ted Leonsis → Jeffrey Epstein': 'co_accused',
  'Ted Leonsis → Ghislaine Maxwell': 'co_accused',
  'Marvin Minsky → Ghislaine Maxwell': 'co_accused',
  'Harvey Weinstein → Jeffrey Epstein': 'social',       // separate criminal enterprise, social associates
  'Harvey Weinstein → Ghislaine Maxwell': 'social',     // no evidence of joint trafficking
  'Bill Richardson → Ghislaine Maxwell': 'co_accused',  // victims trafficked TO him at Zorro Ranch

  // Co-conspirators were co-conspirators, not employees
  'Sarah Kellen → Adriana Ross': 'co_accused',          // both NPA-immunized co-conspirators
  'Sarah Kellen → Ghislaine Maxwell': 'co_accused',     // criminal operation, not professional
  'Adriana Ross → Ghislaine Maxwell': 'co_accused',     // co-conspirator, not employee

  // Groff scheduled for Epstein's associates — not employment relationships
  'George Mitchell → Lesley Groff': 'social',           // Groff scheduled meetings for him
  'Alan Dershowitz → Lesley Groff': 'social',           // same — scheduling contact
  'Ehud Barak → Lesley Groff': 'social',                // same

  // Dershowitz connections — T1 for different reasons, not co-accused together
  'Alan Dershowitz → Bill Clinton': 'associated_with',   // both T1 but unrelated allegations
  'Alan Dershowitz → Jean-Luc Brunel': 'associated_with',

  // George Mitchell — victim allegations but never charged, not formally co-accused with Epstein
  'George Mitchell → Jeffrey Epstein': 'associated_with',

  // Karyna Shuliak was Epstein's girlfriend, not a financial relationship
  'Karyna Shuliak → Jeffrey Epstein': 'social',

  // Eva Andersson-Dubin dated Epstein before marrying Dubin
  'Eva Andersson-Dubin → Jeffrey Epstein': 'social',

  // Celina Dubin — financial trust beneficiary but primarily family connection through Glenn
  'Celina Edith Dubin → Jeffrey Epstein': 'social',

  // Dershowitz was accused alongside these people, not trafficked by Maxwell
  'Alan Dershowitz → Ghislaine Maxwell': 'co_accused',
  'Alan Dershowitz → Bill Richardson': 'associated_with', // separate allegations

  // Maxwell was convicted co-conspirator, not merely "associated"
  'Ghislaine Maxwell → Jeffrey Epstein': 'co_accused',

  // Prince Andrew — civil settlement with Giuffre, victim allegations. T1 for evidence.
  'Prince Andrew → Jeffrey Epstein': 'co_accused',

  // Ruemmler had post-WH social/professional contact, not a professional colleague
  'Kathy Ruemmler → Jeffrey Epstein': 'social',

  // Minsky — journal-named, social/academic relationship with Epstein not financial
  'Marvin Minsky → Jeffrey Epstein': 'social',
};

async function main() {
  // Fetch all connected_to connections with entity details
  const { data: connections, error } = await sb
    .from('entity_connections')
    .select('id, entity_a, entity_b, relationship_type, description, strength, evidence_strength, start_date, end_date')
    .eq('relationship_type', 'connected_to');

  if (error) { console.error('Failed to fetch:', error); process.exit(1); }
  console.log(`Found ${connections.length} 'connected_to' connections to classify\n`);

  // Fetch all entities for context
  const { data: entities } = await sb
    .from('entities')
    .select('id, name, tier, category, entity_type');
  const entityMap = Object.fromEntries(entities.map(e => [e.id, e]));

  // Enrich connections with entity names
  const enriched = connections.map(c => ({
    ...c,
    entity_a_name: entityMap[c.entity_a]?.name || 'Unknown',
    entity_a_tier: entityMap[c.entity_a]?.tier || '?',
    entity_a_category: entityMap[c.entity_a]?.category || '?',
    entity_b_name: entityMap[c.entity_b]?.name || 'Unknown',
    entity_b_tier: entityMap[c.entity_b]?.tier || '?',
    entity_b_category: entityMap[c.entity_b]?.category || '?',
  }));

  // Process in batches
  let updated = 0;
  let kept = 0;

  for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
    const batch = enriched.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(enriched.length / BATCH_SIZE);
    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} connections)...`);

    const prompt = batch.map((c, idx) => {
      return `${idx + 1}. [${c.id}] ${c.entity_a_name} (T${c.entity_a_tier}, ${c.entity_a_category}) → ${c.entity_b_name} (T${c.entity_b_tier}, ${c.entity_b_category})
   Description: "${c.description || 'No description'}"
   Strength: ${c.strength || 'unset'} | Evidence: ${c.evidence_strength || 'unset'}`;
    }).join('\n\n');

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Classify each connection's relationship type. Valid types:
- attorney_for: legal representation (lawyer representing client)
- family_of: family/spouse/relative
- co_accused: co-defendants, shared criminal activity, both accused
- trafficked_by: victim trafficked by perpetrator
- trafficked_for: perpetrator trafficked victims for another perpetrator
- employed_by: employment relationship (employee → employer)
- hired_by: hired for services (consultant, contractor)
- financial: financial ties (investments, payments, fund management)
- social: social relationship (dinners, flights, contacts book, friendship)
- professional: professional colleagues (same office, same investigation team)
- investigated_by: law enforcement investigating subject
- referred_by: referral or introduction
- protected_by: legal/institutional protection (prosecutor protecting subject)
- associated_with: documented association that doesn't fit other categories
- connected_to: ONLY if truly unclassifiable

For each connection, return a JSON array of objects with "id", "type", and "confidence" (0-100).
Consider the description carefully. The direction matters: entity_a → entity_b.

Connections to classify:

${prompt}

Return ONLY valid JSON array, no markdown fences.`
        }]
      });

      const text = response.content[0].text.trim();
      let classifications;
      try {
        // Strip markdown fences if present
        const clean = text.replace(/^```json?\n?/,'').replace(/\n?```$/,'');
        classifications = JSON.parse(clean);
      } catch (e) {
        console.error('  Failed to parse response:', text.substring(0, 200));
        continue;
      }

      for (const cls of classifications) {
        if (!cls.id || !cls.type) continue;

        const conn = batch.find(c => c.id === cls.id);
        if (!conn) continue;

        // Check for manual override
        const overrideKey = `${conn.entity_a_name} → ${conn.entity_b_name}`;
        const finalType = OVERRIDES[overrideKey] || cls.type;
        const wasOverridden = OVERRIDES[overrideKey] && OVERRIDES[overrideKey] !== cls.type;

        if (!VALID_TYPES.includes(finalType)) {
          console.log(`  ⚠ Invalid type "${finalType}" for ${cls.id}, skipping`);
          continue;
        }
        if (finalType === 'connected_to') {
          kept++;
          continue;
        }

        const label = wasOverridden
          ? `${finalType} (override, was ${cls.type})`
          : `${finalType} (${cls.confidence}%)`;

        if (DRY_RUN) {
          console.log(`  [DRY] ${conn.entity_a_name} → ${conn.entity_b_name}: ${label}`);
        } else {
          const { error: updateErr } = await sb
            .from('entity_connections')
            .update({ relationship_type: finalType })
            .eq('id', cls.id);

          if (updateErr) {
            console.error(`  ✗ Failed to update ${cls.id}:`, updateErr.message);
          } else {
            console.log(`  ✓ ${conn.entity_a_name} → ${conn.entity_b_name}: ${label}`);
            updated++;
          }
        }
      }

      // Rate limit
      if (i + BATCH_SIZE < enriched.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      console.error(`  Batch failed:`, e.message);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Reclassified: ${updated}`);
  console.log(`Kept as connected_to: ${kept}`);
  console.log(`Total processed: ${connections.length}`);
  if (DRY_RUN) console.log('(DRY RUN — no changes made)');
}

main().catch(console.error);
