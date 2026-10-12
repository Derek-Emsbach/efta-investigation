const fs = require('fs');
const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) env[m[1]]=m[2];});
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
async function sb(path) {
  const r = await fetch(URL + '/rest/v1/' + path, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
  if (!r.ok) throw new Error(path + ' -> ' + r.status + ' ' + await r.text());
  return r.json();
}
(async () => {
  const barr = await sb('entities?name=eq.' + encodeURIComponent('William Barr') + '&select=id,name,tier');
  console.log('BARR:', JSON.stringify(barr));
  if (!barr.length) return;
  const barrId = barr[0].id;
  const conns = await sb(`entity_connections?or=(entity_a.eq.${barrId},entity_b.eq.${barrId})&select=*`);
  console.log('EXISTING_CONNECTIONS:', JSON.stringify(conns));
  const docs = await sb(`entity_documents?entity_id=eq.${barrId}&select=document_id,role_in_document,excerpt`);
  console.log('BARR_DOCS:', JSON.stringify(docs));
  const docIds = docs.map(d=>d.document_id);
  if (!docIds.length) { console.log('NO_DOCS'); return; }
  const inList = docIds.map(d=>`"${d}"`).join(',');
  const coDocs = await sb(`entity_documents?document_id=in.(${inList})&select=entity_id,document_id,excerpt,role_in_document`);
  console.log('CO_OCCURRING_RAW_COUNT:', coDocs.length);
  const byEntity = {};
  for (const row of coDocs) {
    if (row.entity_id === barrId) continue;
    if (!byEntity[row.entity_id]) byEntity[row.entity_id] = [];
    byEntity[row.entity_id].push(row);
  }
  const entityIds = Object.keys(byEntity);
  console.log('CO_OCCURRING_ENTITY_IDS:', JSON.stringify(entityIds));
  if (entityIds.length) {
    const idList = entityIds.map(e=>`"${e}"`).join(',');
    const names = await sb(`entities?id=in.(${idList})&select=id,name,tier,is_public,profile_published`);
    console.log('CO_OCCURRING_NAMES:', JSON.stringify(names));
  }
  console.log('BY_ENTITY_DETAIL:', JSON.stringify(byEntity));
  const tw = await sb('entities?name=in.(' + encodeURIComponent('Donald Trump') + ',' + encodeURIComponent('Harvey Weinstein') + ')&select=id,name,tier');
  console.log('TRUMP_WEINSTEIN:', JSON.stringify(tw));
})().catch(e=>console.error('SCRIPT_ERR', e.message));
