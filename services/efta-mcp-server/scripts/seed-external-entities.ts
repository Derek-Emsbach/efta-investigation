import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getSupabase } from '../src/supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RegistryEntry {
  name: string;
  slug: string;
  aliases: string[];
  category: string;
  search_terms: string[];
  sources: string[];
  description?: string;
  involvement?: string;
  occupation?: string;
  metadata?: Record<string, unknown>;
}

// Map rhowardstone categories → entity_type for our schema
function mapEntityType(category: string): string {
  switch (category) {
    case 'perpetrator':
    case 'enabler':
    case 'associate':
    case 'staff':
    case 'victim':
    case 'socialite':
    case 'celebrity':
    case 'royalty':
    case 'intelligence':
      return 'person';
    case 'business':
      return 'person'; // Most are businesspeople, not orgs
    case 'politician':
    case 'legal':
    case 'academic':
    case 'other':
    default:
      return 'person';
  }
}

// Build a legal_status hint from category + involvement
function inferLegalStatus(entry: RegistryEntry): string | undefined {
  if (entry.category === 'perpetrator') return 'convicted/charged';
  if (entry.category === 'victim') return 'victim';
  if (entry.involvement?.toLowerCase().includes('co-conspirator')) return 'named co-conspirator';
  if (entry.involvement?.toLowerCase().includes('convicted')) return 'convicted';
  if (entry.involvement?.toLowerCase().includes('charged')) return 'charged';
  return undefined;
}

async function main() {
  const sb = getSupabase();

  // Load registry data
  const registryPath = join(__dirname, '..', 'data', 'persons_registry.json');
  const registry: RegistryEntry[] = JSON.parse(readFileSync(registryPath, 'utf-8'));
  console.log(`Loaded ${registry.length} entries from persons_registry.json`);

  // Filter out redacted/code entries (start with "(b)" or "*D")
  const realEntries = registry.filter(e =>
    !e.name.startsWith('(b)') && !e.name.startsWith('*D') && !e.name.startsWith('(')
  );
  console.log(`Filtered to ${realEntries.length} real name entries (skipped ${registry.length - realEntries.length} redacted codes)`);

  // Pre-load entities + suspects for auto-matching (small tables, O(1) lookup)
  const [entitiesRes, suspectsRes] = await Promise.all([
    sb.from('entities').select('id, name'),
    sb.from('suspect_watchlist').select('id, name'),
  ]);

  const entityMap = new Map<string, string>();
  for (const e of (entitiesRes.data ?? [])) {
    entityMap.set(e.name.toLowerCase(), e.id);
  }

  const suspectMap = new Map<string, string>();
  for (const s of (suspectsRes.data ?? [])) {
    suspectMap.set(s.name.toLowerCase(), s.id);
  }

  console.log(`Loaded ${entityMap.size} entities and ${suspectMap.size} suspects for matching`);

  // Map registry entries to external_entities rows
  let matchedEntity = 0;
  let matchedSuspect = 0;
  let unmatched = 0;

  const rows = realEntries.map(entry => {
    const nameLower = entry.name.toLowerCase();
    const entityId = entityMap.get(nameLower) ?? null;
    const suspectId = !entityId ? (suspectMap.get(nameLower) ?? null) : null;

    let matchStatus: string;
    if (entityId) {
      matchStatus = 'matched';
      matchedEntity++;
    } else if (suspectId) {
      matchStatus = 'matched';
      matchedSuspect++;
    } else {
      matchStatus = 'unmatched';
      unmatched++;
    }

    // Pack everything into raw_data for reference
    const rawData: Record<string, unknown> = {
      category: entry.category,
      search_terms: entry.search_terms,
      sources: entry.sources,
    };
    if (entry.description) rawData.description = entry.description;
    if (entry.involvement) rawData.involvement = entry.involvement;
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      rawData.metadata = entry.metadata;
    }

    return {
      source: 'rhowardstone',
      source_id: entry.slug,
      name: entry.name,
      aliases: entry.aliases ?? [],
      entity_type: mapEntityType(entry.category),
      occupation: entry.occupation ?? null,
      legal_status: inferLegalStatus(entry) ?? null,
      mention_count: (entry.metadata as Record<string, number>)?.ds10_mentions ?? null,
      matched_entity_id: entityId,
      matched_suspect_id: suspectId,
      match_status: matchStatus,
      raw_data: rawData,
      notes: entry.involvement ?? null,
    };
  });

  // Batch insert in chunks of 100
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await sb.from('external_entities')
      .upsert(batch, { onConflict: 'source,source_id', ignoreDuplicates: true })
      .select('id');

    if (error) {
      // If upsert fails (no unique constraint on source+source_id), fall back to insert
      console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: upsert failed, trying insert: ${error.message}`);
      const { data: insertData, error: insertError } = await sb.from('external_entities')
        .insert(batch)
        .select('id');
      if (insertError) {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: insert failed: ${insertError.message}`);
        errors++;
        continue;
      }
      inserted += insertData?.length ?? 0;
    } else {
      inserted += data?.length ?? 0;
    }

    process.stdout.write(`\r  Inserted ${inserted}/${rows.length} (batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)})`);
  }

  console.log('\n');
  console.log('=== Import Summary ===');
  console.log(`  Total entries:      ${registry.length}`);
  console.log(`  Skipped (redacted): ${registry.length - realEntries.length}`);
  console.log(`  Imported:           ${inserted}`);
  console.log(`  Matched to entity:  ${matchedEntity}`);
  console.log(`  Matched to suspect: ${matchedSuspect}`);
  console.log(`  Unmatched:          ${unmatched}`);
  if (errors > 0) {
    console.log(`  Batch errors:       ${errors}`);
  }
}

main();
