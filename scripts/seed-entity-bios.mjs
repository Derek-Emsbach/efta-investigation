import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── Bios for all 32 published entities ────────────────────────────────────────
// Format: 2-4 sentences, ~200-400 chars, plain text, journalistic tone.
// First 160 chars used for SEO metadata description.

const BIOS = {
  // ── T1: Direct Evidence (17) ────────────────────────────────────────────────

  'Jeffrey Epstein':
    'American financier and convicted sex offender who operated a decades-long trafficking network spanning multiple countries. Arrested in July 2019 on federal sex trafficking charges; died in custody at the Metropolitan Correctional Center on August 10, 2019, in circumstances that remain disputed. EFTA documents reveal the scope of his financial infrastructure, co-conspirator network, and the systematic failures of institutions that enabled him.',

  'Ghislaine Maxwell':
    'British socialite and daughter of media mogul Robert Maxwell. Convicted in December 2021 on five federal charges including sex trafficking of a minor, sentenced to 20 years. EFTA documents and trial testimony establish her role as Epstein\'s primary recruiter, logistics coordinator, and direct participant in abuse. She is the only member of the inner circle to face criminal consequences.',

  'Alan Dershowitz':
    'Harvard Law professor emeritus and prominent defense attorney. Named in victim testimony and civil litigation as a direct participant in abuse facilitated by the Epstein network. Received $100,487 in payments through Deutsche Bank accounts. Represented Epstein during the 2007 Non-Prosecution Agreement negotiations that granted blanket immunity to co-conspirators.',

  'Bill Clinton':
    'Former President of the United States (1993–2001). Flight logs and EFTA documents place him on Epstein\'s Boeing 727 for a 2002 Africa tour alongside Kevin Spacey and Chris Tucker, with Cape Town confirmed as a stop during active victim recruitment. Deutsche Bank records show no direct payments, but scheduling documents confirm ongoing contact through Epstein\'s office.',

  'Dan Snyder':
    'Owner of the Washington Commanders (formerly Redskins) NFL franchise. Named in Epstein\'s forensic journals alongside other Washington, D.C. figures in a cluster pattern with Jim Kimsey, Steve Case, and Ted Leonsis. Journal entries from the AOL-era Washington power network document scheduled contact and financial discussions.',

  'George Mitchell':
    'Former U.S. Senate Majority Leader (1989–1995) and Special Envoy for Middle East Peace. Named in Epstein scheduling documents and victim testimony. EFTA records show coordinated scheduling through Lesley Groff\'s office. Despite documented contact patterns consistent with other Tier 1 entities, no charges were ever brought.',

  'Glenn Dubin':
    'Hedge fund manager and co-founder of Highbridge Capital Management. Named in the 1266 Trust documents as a key figure in Epstein\'s financial architecture. His wife Eva Andersson-Dubin, a former Miss Sweden, maintained a documented relationship with Epstein spanning decades. Multiple victims identified Dubin in testimony.',

  'Harvey Weinstein':
    'Former film producer and co-founder of Miramax and The Weinstein Company. Convicted in 2020 of rape and sexual assault in New York, with a subsequent Los Angeles conviction in 2022. EFTA documents reveal overlapping networks between Weinstein and Epstein, including shared legal representation, social connections, and operational patterns.',

  'Jean-Luc Brunel':
    'French modeling agent and founder of MC2 Model Management, a Miami-based agency co-funded by Epstein. Multiple victims identified Brunel as a direct procurer who used the modeling industry as a recruitment pipeline. Found dead in his Paris prison cell on February 19, 2022, while awaiting trial on rape and sex trafficking charges. EFTA documents trace the MC2 pipeline from scouting in South America to placement in Epstein properties.',

  'Jes Staley':
    'Former CEO of Barclays and JPMorgan Private Bank executive. EFTA documents reveal he served as original trustee of the 1266 Trust — Epstein\'s primary financial vehicle — and maintained a banking relationship with Epstein spanning over a decade. Resigned from Barclays in 2021 after UK regulators found he mischaracterized his relationship with Epstein. Named in multiple victim civil suits.',

  'Jim Kimsey':
    'Co-founder and first CEO of America Online (AOL). Named in Epstein\'s forensic journals as part of the Washington, D.C. technology cluster alongside Steve Case, Ted Leonsis, and Dan Snyder. Kimsey died in 2016. His journal entries document financial discussions and scheduled meetings coordinated through Epstein\'s office.',

  'Larry Summers':
    'Former U.S. Secretary of the Treasury (1999–2001) and President of Harvard University (2001–2006). Deutsche Bank records show $38,233 in payments to "L.H. Summers Economic Consulting LLC" for "travel expenses." Named in scheduling documents and flight logs. His Harvard tenure overlapped with Epstein\'s donations to the university and visits to campus.',

  'Leon Black':
    'Billionaire co-founder of Apollo Global Management. EFTA prosecution documents reveal $158 million in total payments to Epstein, including a step-up-basis trust scheme that generated $100+ million in tax savings. Three or more victims provided corroborating accounts of identical signature sexual violence. Despite forensic journal entries and witness testimony, SDNY never formally opened a case.',

  'Marvin Minsky':
    'Pioneering computer scientist and co-founder of MIT\'s Artificial Intelligence Laboratory. Deceased 2016. Named in victim testimony as having been "ichased" sexual contact with a minor at Epstein\'s Virgin Islands property. His presence at Epstein gatherings was documented by multiple witnesses. MIT\'s institutional relationship with Epstein — including $800,000 in donations — became a major scandal in 2019.',

  'Prince Andrew':
    'Duke of York and member of the British Royal Family. Named by multiple victims including Virginia Giuffre, who provided specific testimony about encounters in London, New York, and the U.S. Virgin Islands. Settled Giuffre\'s civil lawsuit in 2022 for a reported $12 million. EFTA documents include flight logs, scheduling records, and photographs placing him at Epstein properties during periods of documented abuse.',

  'Steve Case':
    'Co-founder and former CEO of America Online (AOL). Named in Epstein\'s forensic journals as part of the D.C. technology and media cluster. Journal entries document scheduled meetings and financial discussions. Case\'s name appears alongside other AOL-era Washington figures in a pattern suggesting coordinated social access.',

  'Ted Leonsis':
    'Owner of the Washington Wizards and Washington Capitals, and former AOL executive. Named in Epstein\'s forensic journals alongside the D.C. technology cluster. His entries follow the same scheduling and contact patterns as other members of the AOL-era Washington network documented in the journals.',

  // ── T2: Immunized (1 published) ─────────────────────────────────────────────

  'Lesley Groff':
    'Epstein\'s executive assistant and primary scheduler for 18 years (1998–2019). Named as one of four co-conspirators granted blanket immunity under the 2007 Non-Prosecution Agreement. EFTA documents reveal she coordinated victim scheduling, managed the massage appointment calendar, and served as the operational link between Epstein and his network. Received $410,000+ in Deutsche Bank wire transfers. The prosecution memo\'s charging analysis for Groff (Section D) was entirely redacted.',

  // ── T3: Circumstantial (1 published) ────────────────────────────────────────

  'Bill Richardson':
    'Former Governor of New Mexico (2003–2011), U.S. Ambassador to the United Nations, and Secretary of Energy. Pilot Larry Morrison testified to seeing Richardson at Epstein\'s Zorro Ranch being escorted to the main house for dinner. Campaign finance records show $100,000+ in contributions routed through the Zorro Trust. Scheduling emails from Deputy Chief of Staff Mark Hartley coordinated Richardson\'s visits through Lesley Groff. Died August 28, 2023.',

  // ── T4: Associated (13 published) ───────────────────────────────────────────

  'Apollo Global Management LLC':
    'Private equity firm co-founded by Leon Black. Apollo\'s financial relationship with Epstein included advisory fees, trust structures, and tax optimization schemes totaling $158 million in payments. Black stepped down as CEO in 2021 following public scrutiny of the Epstein relationship, though he remained as chairman before fully departing the board.',

  'Barnaby Mars':
    'British former RAF flight lieutenant who worked as a private pilot for Epstein. Named in flight logs and scheduling documents. Mars flew Epstein\'s aircraft during periods of documented travel to properties where abuse occurred. His role in the logistics network is documented through aviation records in the EFTA corpus.',

  'Celina Edith Dubin':
    'Daughter of Glenn and Eva Dubin. Named as a beneficiary in Epstein\'s 1266 Trust documents alongside other members of the Dubin family. Her inclusion in the trust\'s financial architecture connects her to Epstein\'s broader estate planning structure, though no evidence of direct involvement in criminal activity has been identified.',

  'Dr. Chen':
    'Medical professional referenced in EFTA documents in connection with Epstein\'s network. Identified in scheduling records and financial transactions. The specific nature of the medical relationship and its connection to the broader operation remains under investigation.',

  'Eva Andersson-Dubin':
    'Former Miss Sweden (1980) and wife of Glenn Dubin. Maintained a documented personal relationship with Epstein spanning decades, including after Epstein\'s 2008 conviction. Named as a beneficiary in the 1266 Trust. Flight logs and scheduling documents place her at Epstein properties. Her relationship predated her marriage to Glenn Dubin.',

  'Gerd (Epstein associate)':
    'Individual referenced by single name in EFTA documents as an associate of Jeffrey Epstein. Identified in scheduling records and internal communications. Limited identifying information available in the corpus.',

  'Karyna Shuliak':
    'Slovakian national described in Deutsche Bank records as a "Student / Interior Decorator." Received $631,000 in direct payments from Epstein accounts, including a single $350,000 wire transfer. Named as a Butterfly Trust beneficiary, replacing Ghislaine Maxwell in December 2014. Attended Institut Villa Pierrefeu, a Swiss finishing school, with tuition paid by Epstein.',

  'KKR & Co. L.P.':
    'Global investment firm. Referenced in EFTA financial documents in connection with Epstein\'s investment portfolio and advisory relationships. The nature and extent of any institutional relationship with Epstein or his entities is documented in financial records within the corpus.',

  'Les Wexner':
    'Billionaire founder of L Brands (Victoria\'s Secret, Bath & Body Works). Epstein served as Wexner\'s financial manager from the late 1980s, a relationship that provided Epstein\'s primary source of legitimate wealth and social credibility. Wexner transferred his New York mansion to Epstein and granted him power of attorney. He has stated he severed ties with Epstein in 2007.',

  'Mark Epstein':
    'Brother of Jeffrey Epstein. Named in property records, trust documents, and financial transactions throughout the EFTA corpus. Controlled or had signatory authority on multiple Epstein-linked entities. Testified in civil depositions about his brother\'s properties and business dealings.',

  'Oaktree Capital Group, LLC':
    'Global investment management firm. Referenced in EFTA financial documents in connection with Epstein\'s investment portfolio. The firm appears in transaction records and advisory documentation within the corpus.',

  'The Blackstone Group LP':
    'Global investment firm. Referenced in EFTA financial documents in connection with Epstein\'s investment relationships. Appears in financial transaction records and advisory documentation within the corpus.',

  'The Carlyle Group LP':
    'Global investment firm with significant government and defense connections. Referenced in EFTA financial documents in connection with Epstein\'s investment portfolio. Appears in financial transaction records within the corpus.',
};

// ── Update entities ───────────────────────────────────────────────────────────
async function main() {
  let updated = 0;
  let errors = 0;

  for (const [name, bio] of Object.entries(BIOS)) {
    const { data, error } = await sb.from('entities')
      .update({ bio })
      .eq('name', name)
      .eq('profile_published', true)
      .select('id, name');

    if (error) {
      console.error(`  ✗ ${name}: ${error.message}`);
      errors++;
    } else if (!data?.length) {
      console.error(`  ✗ ${name}: not found (published)`);
      errors++;
    } else {
      console.log(`  ✓ ${name} — ${bio.length} chars`);
      updated++;
    }
  }

  console.log(`\n=== Done: ${updated} updated, ${errors} errors ===`);
}

main().catch(console.error);
