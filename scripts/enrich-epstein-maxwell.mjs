/**
 * Jeffrey Epstein & Ghislaine Maxwell Evidence Summary Enrichment
 * These two already have bios, photos, connections, docs, events — just missing evidence_summary
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; })
    .filter(Boolean)
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const dryRun = process.argv.includes('--dry-run');
if (dryRun) console.log('*** DRY RUN ***\n');

// ─── Jeffrey Epstein ──────────────────────────────────────────────────────────

const epsteinEvidenceSummary = `JEFFREY EPSTEIN — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Central subject of the EFTA investigation. Convicted sex offender. Operated an international sex trafficking network involving minors spanning at least two decades (1990s–2019). Died in custody August 10, 2019.

CRIMINAL HISTORY:
1. 2008 Florida conviction — pleaded guilty to state charges of soliciting prostitution from a minor. Sentenced to 18 months (served 13) with work release. Result of controversial 2007 NPA negotiated by defense team (Dershowitz, Starr, Lefkowitz) granting blanket immunity to unnamed co-conspirators.
2. 2019 federal indictment (SDNY) — charged with sex trafficking of minors and conspiracy. Two-count indictment covering 2002–2005 conduct. Case terminated by death.

KEY EVIDENCE IN EFTA CORPUS:
1. Prosecution memoranda (EFTA02731082, EFTA02731039) — SDNY internal analysis of charging decisions, victim accounts, cooperator debriefs. Section D (Groff charging analysis) entirely redacted under Category C.
2. Victim journals — Virginia Giuffre's handwritten journals naming 30+ men she was directed to have sexual encounters with. Forensically authenticated (gel pen analysis, contemporaneous dating).
3. Flight logs — Boeing 727 ("Lolita Express") and Gulfstream records documenting hundreds of flights with identified passengers including victims and high-profile associates.
4. Contact directory ("black book") — 1,571 names with phone numbers, addresses, and annotations. Multiple victim names marked with circled annotations.
5. Financial records — Deutsche Bank SAR filings, $158M to Leon Black, $62.5M USVI settlement, shell company networks (Financial Trust Co., Butterfly Trust, 1953 Trust, Gratitude America Ltd.).
6. Property portfolio — 9 East 71st Street (Manhattan), Zorro Ranch (New Mexico), Little St. James (USVI), Paris apartment, Palm Beach estate. Each location documented as abuse site.
7. Proffer agreements — cooperator debriefs including Lesley Groff (formal proffer 2021-07-23), pilot testimony (Larry Visoski, David Rodgers, Larry Morrison).
8. Deutsche Bank records (EFTA01681865) — $410K+ wire transfers, 120+ cash withdrawals ($40-80K each), suspicious activity reports.

PROSECUTION FAILURES:
1. 2007 NPA — unprecedented blanket immunity to unnamed co-conspirators, negotiated in secret, victims not notified (CVRA violation)
2. SDNY "Two-Track Failure" — parallel but uncoordinated investigations by SDNY federal prosecutors and Manhattan DA; neither resulted in charges against co-conspirators
3. Post-death investigation — "focused on Ghislaine Maxwell, [redacted], and Lesley Groff" per internal docs; only Maxwell charged
4. Leon Black: AUSA admission "I did not write anything up on Leon Black" despite $158M in payments and 3+ victim accounts with corroborating signature violence

NETWORK STRUCTURE (Five Systems):
- Recruitment Pipeline: victim-recruiter chain, school/spa targeting, Palm Beach massage ruse
- Logistics Network: private aviation, property portfolio, scheduling apparatus (Groff)
- Financial Infrastructure: shell companies, trust structures, Deutsche Bank relationship
- Protection Apparatus: NPA immunity, attorney network (Dershowitz, Starr, Indyke, Kahn), institutional shielding
- Inner Circle: Maxwell (recruitment), Groff (scheduling), Brunel (modeling), Staley (finance), Black (payments)

DEATH: Found unresponsive in MCC cell August 10, 2019. Official cause: suicide by hanging. FBI investigation ruled out bribery of guards Noel and Thomas; DVR system failure predated August 9; 4AM supervisor rounds not conducted. Two cameras outside cell malfunctioned. Guards falsified logs.`;

// ─── Ghislaine Maxwell ────────────────────────────────────────────────────────

const maxwellEvidenceSummary = `GHISLAINE MAXWELL — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Convicted co-conspirator. Found guilty December 29, 2021 on five of six counts including sex trafficking of a minor. Sentenced to 20 years federal imprisonment (June 28, 2022). Currently incarcerated at FCI Tallahassee (BOP #02879-509).

CRIMINAL CONVICTION:
United States v. Ghislaine Maxwell (S2 20-cr-330, SDNY)
- Count 1: Conspiracy to entice minors to travel for illegal sex acts — GUILTY
- Count 2: Enticement of a minor to travel for illegal sex acts — NOT GUILTY
- Count 3: Conspiracy to transport minors for illegal sex acts — GUILTY
- Count 4: Transportation of a minor for illegal sex acts — GUILTY
- Count 5: Sex trafficking conspiracy — GUILTY
- Count 6: Sex trafficking of a minor — GUILTY

KEY EVIDENCE:
1. Victim testimony at trial — four victims ("Jane," "Kate," "Carolyn," Annie Farmer) testified to Maxwell's direct role in recruitment, grooming, and participation in sexual abuse
2. Giuffre civil complaint and depositions — detailed allegations of Maxwell as primary recruiter and facilitator who "trained" Giuffre in sexual services
3. Photograph evidence — Maxwell photographed with Giuffre and Prince Andrew at Maxwell's London townhouse (2001)
4. Flight log presence — documented on Epstein aircraft flights
5. Property access — keys to all Epstein properties, lived at 9 East 71st Street
6. Post-death investigation focus — internal SDNY documents identify Maxwell as primary target alongside "[redacted]" and Lesley Groff
7. Epstein contact directory — Maxwell listed with extensive contact information across multiple residences
8. Financial records — payments from Epstein entities, property transfers, trust beneficiary designations

ROLE IN NETWORK:
Maxwell served as Epstein's primary recruiter and social shield. Her dual function was:
1. RECRUITMENT: Identified, approached, and groomed victims — often using her social status and gender to establish trust. Recruited from schools, spas, and social events. Created the "massage" pretext used to normalize initial contact.
2. SOCIAL LEGITIMIZATION: Her aristocratic background (daughter of Robert Maxwell) provided Epstein social access to circles he could not enter alone. Hosted dinners, attended events, introduced Epstein to royalty, politicians, and business leaders.

PROSECUTION CONTEXT: Maxwell was the ONLY Epstein associate criminally charged post-death. Despite SDNY internal documents referencing additional investigation targets, no other co-conspirators have been indicted. The 2007 NPA's blanket immunity provision may have influenced charging decisions for other individuals.

CONNECTIONS: Jeffrey Epstein (principal — romantic/professional partner, co-defendant), Virginia Giuffre (victim — recruited and groomed by Maxwell), Prince Andrew (introduced by Maxwell, photographed together), Jean-Luc Brunel (modeling recruiter in Maxwell's network), Lesley Groff (co-target of post-death investigation), all victim-journal-named individuals (Maxwell identified as facilitator directing encounters).

APPEAL STATUS: Maxwell's conviction was upheld on appeal. Currently serving 20-year sentence with projected release date of July 17, 2037.`;

async function main() {
  // ─── Epstein ─────────────────────────────────────────────────────────────
  console.log('═══ Jeffrey Epstein ═══');
  const { data: epstein } = await sb.from('entities').select('id, name, metadata').eq('name', 'Jeffrey Epstein').single();
  if (!epstein) { console.log('  NOT FOUND'); return; }

  if (!dryRun) {
    const { error } = await sb.from('entities').update({
      metadata: { ...epstein.metadata, evidence_summary: epsteinEvidenceSummary },
    }).eq('id', epstein.id);
    if (error) console.log('  ERROR:', error.message);
    else console.log('  ✓ Evidence summary added (' + epsteinEvidenceSummary.length + ' chars)');
  } else {
    console.log('  Would add evidence summary (' + epsteinEvidenceSummary.length + ' chars)');
  }

  // ─── Maxwell ─────────────────────────────────────────────────────────────
  console.log('\n═══ Ghislaine Maxwell ═══');
  const { data: maxwell } = await sb.from('entities').select('id, name, metadata').eq('name', 'Ghislaine Maxwell').single();
  if (!maxwell) { console.log('  NOT FOUND'); return; }

  if (!dryRun) {
    const { error } = await sb.from('entities').update({
      metadata: { ...maxwell.metadata, evidence_summary: maxwellEvidenceSummary },
    }).eq('id', maxwell.id);
    if (error) console.log('  ERROR:', error.message);
    else console.log('  ✓ Evidence summary added (' + maxwellEvidenceSummary.length + ' chars)');
  } else {
    console.log('  Would add evidence summary (' + maxwellEvidenceSummary.length + ' chars)');
  }
}

main().catch(console.error);
