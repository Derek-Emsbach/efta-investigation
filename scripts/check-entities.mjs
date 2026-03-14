import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
for (const name of ['Jeffrey Epstein', 'Ghislaine Maxwell', 'Bill Clinton', 'Jean-Luc Brunel', 'Larry Summers']) {
  const { data } = await sb.from('entities').select('id, name, tier, bio, status, aliases, tier_justification, metadata').eq('name', name).single();
  if (data) {
    console.log('\n' + '='.repeat(60));
    console.log(name + ' (T' + data.tier + ')');
    console.log('Bio: ' + (data.bio ? data.bio.substring(0, 100) + '...' : 'NONE'));
    console.log('Evidence summary: ' + (data.metadata?.evidence_summary ? 'YES (' + data.metadata.evidence_summary.length + ' chars)' : 'NONE'));
    console.log('Status: ' + (data.status || 'null'));
    console.log('Aliases: ' + (data.aliases ? data.aliases.join(', ') : 'NONE'));
    console.log('Tier justification: ' + (data.tier_justification ? data.tier_justification.substring(0, 100) + '...' : 'NONE'));
  }
}
