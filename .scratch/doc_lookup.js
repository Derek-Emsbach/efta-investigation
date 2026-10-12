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
  const ids = ["ed14c0ec-8411-4082-9e21-6e3afc2c1760","155e878a-2cce-4b43-b35e-aa528a9114ab","af722bcf-eed2-4b56-b523-75f541a0dff0","3e7210a4-b015-4b93-9770-f8bb2d42987e","e5c9796d-dddc-4cee-8af4-8f91466f825e","3114f02c-79be-48c9-a52a-b8ec6137f381"];
  const idList = ids.map(i=>`"${i}"`).join(',');
  const docs = await sb(`documents?id=in.(${idList})&select=id,bates_number,title,document_type`);
  console.log(JSON.stringify(docs, null, 2));
})().catch(e=>console.error('ERR', e.message));
