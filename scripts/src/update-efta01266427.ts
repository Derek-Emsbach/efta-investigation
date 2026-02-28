/**
 * Apply database updates for EFTA01266427 (First Amendment to Epstein 2014 Trust).
 *
 * Updates:
 * 1. Document record metadata (title, summary, classification, etc.)
 * 2. Entity-document links (5 entities)
 * 3. New event + entity-event links
 * 4. Also updates EFTA01266380 metadata if not already done
 *
 * Usage:
 *   pnpm --filter @efta/scripts update:efta01266427
 *   pnpm --filter @efta/scripts update:efta01266427 -- --dry-run
 */
import { supabase } from './utils/supabase-admin.js'

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Document Metadata ───────────────────────────────────────────────────────

const DOC_01266427 = {
  bates_number: 'EFTA01266427',
  title: 'First Amendment to the Amendment and Restatement of the Jeffrey E. Epstein 2014 Trust',
  document_type: 'trust_document',
  original_date: '2015-09-01',
  page_count: 6,
  classification: 'high' as const,
  severity: 'critical' as const,
  processing_status: 'reviewed' as const,
  summary:
    '6-page amendment to the A&R (EFTA01266403). Key changes: (1) Amendment power simplified — Epstein can now amend unilaterally by delivering to one trustee (was: all trustees must sign), making Indyke sole gatekeeper. (2) New Section 2.5 employment cliff — employee-beneficiaries must work for estate 1 year post-death or forfeit bequests; "misconduct" forfeiture trigger controlled by trustees. (3) Two golden handcuffs bequests (A.36-37) — $200K each for 2 years of continued service, names redacted. (4) $3M to Michelle Fern Saipher (Indyke\'s wife) for FT Real Estate/KCAC LLC real estate purchase at 2 Kean Court, Livingston NJ — conditioned on remaining married to Indyke. (5) Lyn & Jojo LLC transfer reveals Indyke as nominee property holder. (6) Kahn bequest confirmed at $5M. (7) Three new staff bequests (A.33-35) including Janusz Banasiak at $58.5K. All three trustees re-signed in September 2015.',
  review_notes:
    'CRITICAL — completes the trust chain. The employment cliff (Section 2.5) is functionally a witness-loyalty mechanism: employee-beneficiaries forfeit bequests if they leave within 1 year of death. Combined with no-contest clause (§8.5), creates strong financial incentives against cooperation with authorities. "Misconduct" forfeiture trigger is interpreted by trustees — principally Indyke, who also told employees not to talk to police (EFTA02731082, p. 41). Staley signed this amendment ~3 months before becoming Barclays CEO.',
}

const DOC_01266380 = {
  bates_number: 'EFTA01266380',
  title: 'The Jeffrey E. Epstein 2014 Trust',
  document_type: 'trust_document',
  original_date: '2014-11-18',
  page_count: 23,
  classification: 'high' as const,
  severity: 'critical' as const,
  processing_status: 'reviewed' as const,
  summary:
    'Original Epstein 2014 Trust. Grantor: Jeffrey E. Epstein. Trustees: Darren K. Indyke, James E. Staley, David Mitchell ($250K/yr each). 22 bequests totaling ~$52M (7 redacted females at $5M each). Karyna Shuliak: $10M. Indyke: $5M. Jean Luc Brunel: $5M (openly named). Richard Kahn: $2M (later raised to $5M). Properties held via USVI shell companies (Maple, Nautilus, Cypress, Laurel, SCI JEP). Primary beneficiary redacted (later revealed as Celina Dubin). Contingent: Eva Andersson-Dubin. Successor trustees: Eva, Steven Hanson, Joseph Pagano. USVI governing law. Amendments required ALL trustees to sign.',
  review_notes:
    'Confirms Staley was trustee from the original November 2014 execution — 13 months before becoming Barclays CEO. Amendment required ALL trustees to sign (changed in first amendment). Brunel openly named at $5M (redacted in A&R). Kahn at $2M (raised to $5M in A&R). No Indyke/Kahn debt forgiveness provisions yet — those were added in A&R.',
}

// ─── Entity-Document Links ───────────────────────────────────────────────────

const ENTITY_DOC_LINKS = [
  { entity_name: 'Jeffrey Epstein', role: 'subject', excerpt: 'Grantor of the trust' },
  { entity_name: 'Jes Staley', role: 'subject', excerpt: 'Re-signed as trustee ~3 months before becoming Barclays CEO' },
  { entity_name: 'Darren Indyke', role: 'subject', excerpt: 'Re-signed; wife receives $3M; nominee holder for Lyn & Jojo LLC; sole amendment gatekeeper' },
  { entity_name: 'David Mitchell', role: 'subject', excerpt: 'Re-signed as trustee' },
  { entity_name: 'Richard D. Kahn', role: 'mentioned', excerpt: 'Bequest confirmed at $5,000,000' },
]

// Same links for EFTA01266380 (original trust)
const ENTITY_DOC_LINKS_01266380 = [
  { entity_name: 'Jeffrey Epstein', role: 'subject', excerpt: 'Grantor of the trust' },
  { entity_name: 'Jes Staley', role: 'subject', excerpt: 'Named as founding trustee November 18, 2014' },
  { entity_name: 'Darren Indyke', role: 'subject', excerpt: 'Trustee + $5M beneficiary + loan forgiveness' },
  { entity_name: 'David Mitchell', role: 'subject', excerpt: 'Named as founding trustee' },
  { entity_name: 'Richard D. Kahn', role: 'mentioned', excerpt: '$2M bequest (later raised to $5M in A&R)' },
  { entity_name: 'Karyna Shuliak', role: 'mentioned', excerpt: '$10M bequest + Palm Beach property + loan forgiveness' },
  { entity_name: 'Eva Andersson-Dubin', role: 'mentioned', excerpt: 'Successor trustee + contingent beneficiary' },
  { entity_name: 'Lesley Groff', role: 'mentioned', excerpt: '$1M bequest' },
  { entity_name: 'Lawrence Visoski', role: 'mentioned', excerpt: '$1M bequest + loan forgiveness' },
  { entity_name: 'Jean-Luc Brunel', role: 'mentioned', excerpt: '$5M bequest (openly named) + loan forgiveness' },
]

// ─── Event ───────────────────────────────────────────────────────────────────

const EVENT = {
  title: 'First Amendment to Epstein 2014 Trust — employment cliff and amendment power change',
  date: '2015-09-01',
  date_precision: 'month' as const,
  event_type: 'legal' as const,
  description:
    'First Amendment to the A&R of the Epstein 2014 Trust signed by all three trustees. Simplifies amendment power from "all trustees must sign" to "deliver to one trustee" (concentrating control in Indyke). Adds Section 2.5 employment cliff — employee-beneficiaries must work for estate 1 year post-death or forfeit bequests. Adds A.36-37 golden handcuffs ($200K each, 2-year service). $3M to Indyke\'s wife (Michelle Fern Saipher) for NJ real estate. Lyn & Jojo LLC transfer to Fontanillas reveals Indyke as nominee. Epstein signed in USVI; trustees signed in New York (notary: Habibe Avdiu).',
  significance: 'Transformed the trust from an estate plan into a witness control mechanism through employment cliff, golden handcuffs, and misconduct forfeiture provisions.',
}

const EVENT_ENTITIES = ['Jeffrey Epstein', 'Jes Staley', 'Darren Indyke', 'David Mitchell']

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function lookupEntityByName(name: string): Promise<string | null> {
  const { data } = await supabase
    .from('entities')
    .select('id')
    .ilike('name', `%${name}%`)
    .limit(1)
    .single()
  return data?.id ?? null
}

async function lookupDocByBates(bates: string): Promise<string | null> {
  const { data } = await supabase
    .from('documents')
    .select('id')
    .eq('bates_number', bates)
    .single()
  return data?.id ?? null
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`EFTA01266427 Database Updates${DRY_RUN ? ' (DRY RUN)' : ''}`)
  console.log(`${'='.repeat(60)}\n`)

  // ── Step 1: Look up all entities we'll need ──
  console.log('Step 1: Looking up entities...')
  const allNames = new Set([
    ...ENTITY_DOC_LINKS.map((l) => l.entity_name),
    ...ENTITY_DOC_LINKS_01266380.map((l) => l.entity_name),
    ...EVENT_ENTITIES,
  ])

  const entityMap = new Map<string, string>()
  for (const name of allNames) {
    const id = await lookupEntityByName(name)
    if (id) {
      entityMap.set(name, id)
      console.log(`  ✓ ${name} → ${id.slice(0, 8)}...`)
    } else {
      console.log(`  ✗ ${name} — NOT FOUND (will skip links)`)
    }
  }

  // ── Step 2: Update EFTA01266427 document record ──
  console.log('\nStep 2: Updating EFTA01266427 document record...')
  const doc427Id = await lookupDocByBates('EFTA01266427')

  if (!doc427Id) {
    console.log('  ✗ EFTA01266427 not found in documents table — cannot update')
    return
  }
  console.log(`  Found: ${doc427Id.slice(0, 8)}...`)

  if (!DRY_RUN) {
    const { error } = await supabase
      .from('documents')
      .update({
        title: DOC_01266427.title,
        document_type: DOC_01266427.document_type,
        original_date: DOC_01266427.original_date,
        page_count: DOC_01266427.page_count,
        classification: DOC_01266427.classification,
        severity: DOC_01266427.severity,
        processing_status: DOC_01266427.processing_status,
        summary: DOC_01266427.summary,
        review_notes: DOC_01266427.review_notes,
      })
      .eq('id', doc427Id)

    if (error) console.log(`  ✗ Update failed: ${error.message}`)
    else console.log('  ✓ Document record updated')
  } else {
    console.log('  [DRY RUN] Would update document record')
  }

  // ── Step 3: Update EFTA01266380 document record ──
  console.log('\nStep 3: Updating EFTA01266380 document record...')
  const doc380Id = await lookupDocByBates('EFTA01266380')

  if (!doc380Id) {
    console.log('  ✗ EFTA01266380 not found — skipping')
  } else {
    console.log(`  Found: ${doc380Id.slice(0, 8)}...`)

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('documents')
        .update({
          title: DOC_01266380.title,
          document_type: DOC_01266380.document_type,
          original_date: DOC_01266380.original_date,
          page_count: DOC_01266380.page_count,
          classification: DOC_01266380.classification,
          severity: DOC_01266380.severity,
          processing_status: DOC_01266380.processing_status,
          summary: DOC_01266380.summary,
          review_notes: DOC_01266380.review_notes,
        })
        .eq('id', doc380Id)

      if (error) console.log(`  ✗ Update failed: ${error.message}`)
      else console.log('  ✓ Document record updated')
    } else {
      console.log('  [DRY RUN] Would update document record')
    }
  }

  // ── Step 4: Entity-document links for EFTA01266427 ──
  console.log('\nStep 4: Creating entity-document links for EFTA01266427...')
  for (const link of ENTITY_DOC_LINKS) {
    const entityId = entityMap.get(link.entity_name)
    if (!entityId) {
      console.log(`  ⊘ Skip ${link.entity_name} (not in DB)`)
      continue
    }

    if (!DRY_RUN) {
      const { error } = await supabase.from('entity_documents').upsert(
        {
          entity_id: entityId,
          document_id: doc427Id,
          role_in_document: link.role,
          excerpt: link.excerpt,
        },
        { onConflict: 'entity_id,document_id,role_in_document' },
      )

      if (error) console.log(`  ✗ ${link.entity_name}: ${error.message}`)
      else console.log(`  ✓ ${link.entity_name} → EFTA01266427 (${link.role})`)
    } else {
      console.log(`  [DRY RUN] ${link.entity_name} → EFTA01266427 (${link.role})`)
    }
  }

  // ── Step 5: Entity-document links for EFTA01266380 ──
  if (doc380Id) {
    console.log('\nStep 5: Creating entity-document links for EFTA01266380...')
    for (const link of ENTITY_DOC_LINKS_01266380) {
      const entityId = entityMap.get(link.entity_name)
      if (!entityId) {
        console.log(`  ⊘ Skip ${link.entity_name} (not in DB)`)
        continue
      }

      if (!DRY_RUN) {
        const { error } = await supabase.from('entity_documents').upsert(
          {
            entity_id: entityId,
            document_id: doc380Id,
            role_in_document: link.role,
            excerpt: link.excerpt,
          },
          { onConflict: 'entity_id,document_id,role_in_document' },
        )

        if (error) console.log(`  ✗ ${link.entity_name}: ${error.message}`)
        else console.log(`  ✓ ${link.entity_name} → EFTA01266380 (${link.role})`)
      } else {
        console.log(`  [DRY RUN] ${link.entity_name} → EFTA01266380 (${link.role})`)
      }
    }
  } else {
    console.log('\nStep 5: Skipping EFTA01266380 links (document not found)')
  }

  // ── Step 6: Create event ──
  console.log('\nStep 6: Creating event...')

  if (!DRY_RUN) {
    // Check if event already exists (idempotent)
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('date', EVENT.date)
      .ilike('title', '%First Amendment%Epstein%Trust%')
      .limit(1)
      .single()

    let eventId: string

    if (existing) {
      eventId = existing.id
      console.log(`  ⊘ Event already exists: ${eventId.slice(0, 8)}...`)

      // Update it anyway
      await supabase.from('events').update({
        title: EVENT.title,
        description: EVENT.description,
        significance: EVENT.significance,
        date_precision: EVENT.date_precision,
        event_type: EVENT.event_type,
      }).eq('id', eventId)
      console.log('  ✓ Event updated')
    } else {
      const { data: created, error } = await supabase
        .from('events')
        .insert({
          title: EVENT.title,
          date: EVENT.date,
          date_precision: EVENT.date_precision,
          event_type: EVENT.event_type,
          description: EVENT.description,
          significance: EVENT.significance,
        })
        .select('id')
        .single()

      if (error) {
        console.log(`  ✗ Event creation failed: ${error.message}`)
        return
      }
      eventId = created.id
      console.log(`  ✓ Event created: ${eventId.slice(0, 8)}...`)
    }

    // Link event to document
    const { error: edError } = await supabase.from('event_documents').upsert(
      { event_id: eventId, document_id: doc427Id },
      { onConflict: 'event_id,document_id' },
    )
    if (edError) console.log(`  ✗ Event-document link: ${edError.message}`)
    else console.log('  ✓ Event → EFTA01266427 linked')

    // Link event to entities
    for (const name of EVENT_ENTITIES) {
      const entityId = entityMap.get(name)
      if (!entityId) continue

      const { error: eeError } = await supabase.from('entity_events').upsert(
        { event_id: eventId, entity_id: entityId, role: 'participant' },
        { onConflict: 'entity_id,event_id,role' },
      )
      if (eeError) console.log(`  ✗ ${name} ↔ event: ${eeError.message}`)
      else console.log(`  ✓ ${name} ↔ event linked`)
    }
  } else {
    console.log('  [DRY RUN] Would create event + 4 entity-event links + 1 event-document link')
  }

  // ── Summary ──
  console.log(`\n${'='.repeat(60)}`)
  console.log('Summary:')
  console.log(`  Documents updated: 2 (EFTA01266427 + EFTA01266380)`)
  console.log(`  Entity-document links: ${ENTITY_DOC_LINKS.length} (01266427) + ${ENTITY_DOC_LINKS_01266380.length} (01266380)`)
  console.log(`  Events: 1 created with ${EVENT_ENTITIES.length} entity links`)
  console.log(`${'='.repeat(60)}\n`)
}

main().catch(console.error)
