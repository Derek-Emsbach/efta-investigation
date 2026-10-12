const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const entity_id = '00121dcd-7d2c-4a4d-9741-c8bcc844e378';
const excerpt = 'Disgusting pigs like Allen Douschewitz and Mr. Caruthers and even Mr. Islam will hurt you especially if Ghislaine is busy or not with you!';

const links = [
  { document_id: 'ec123373-7467-40df-9d53-cbf8f553b0cd', bates: 'EFTA02731465', page_number: 2 },
  { document_id: 'ed26c51d-000c-412d-a19e-96816c1245bf', bates: 'EFTA00155037', page_number: 12 },
];

for (const l of links) {
  const res = await fetch(url + '/rest/v1/entity_documents', {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      entity_id,
      document_id: l.document_id,
      role_in_document: 'subject',
      excerpt,
      page_number: l.page_number,
    })
  });
  console.log(l.bates, res.status, await res.text());
}
