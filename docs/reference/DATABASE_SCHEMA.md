# Database Schema Reference

See `packages/db/schema.sql` for the complete SQL. This document explains the relationships and query patterns.

## Entity Relationship Diagram

```
datasets 1──────────M documents
                        │
                        M
                        │
    entities M────────M entity_documents
       │                │
       M                M
       │                │
    entity_events    event_documents
       │                │
       M                M
       │                │
    events ─────────────┘
       │
       M
       │
    investigations
    
    entities M────────M entity_connections ────────M entities
    
    entities 1────────M evidence_items M────────1 documents
    
    documents 1───────M redactions
    
    documents 1───────M processing_queue
```

## Common Query Patterns

### Get entity with all related data
```sql
-- Entity with document count, event count, connection count
SELECT e.*,
  (SELECT COUNT(*) FROM entity_documents ed WHERE ed.entity_id = e.id) as doc_count,
  (SELECT COUNT(*) FROM entity_events ee WHERE ee.entity_id = e.id) as event_count,
  (SELECT COUNT(*) FROM entity_connections ec WHERE ec.entity_a = e.id OR ec.entity_b = e.id) as connection_count,
  (SELECT COUNT(*) FROM evidence_items ei WHERE ei.entity_id = e.id) as evidence_count
FROM entities e
WHERE e.id = $1;
```

### Get entity's documents with details
```sql
SELECT d.*, ed.role_in_document, ed.excerpt
FROM documents d
JOIN entity_documents ed ON d.id = ed.document_id
WHERE ed.entity_id = $1
ORDER BY d.original_date DESC;
```

### Get entity's connections (network graph data)
```sql
SELECT 
  ec.*,
  ea.name as entity_a_name, ea.tier as entity_a_tier,
  eb.name as entity_b_name, eb.tier as entity_b_tier
FROM entity_connections ec
JOIN entities ea ON ec.entity_a = ea.id
JOIN entities eb ON ec.entity_b = eb.id
WHERE ec.entity_a = $1 OR ec.entity_b = $1;
```

### Full-text search across entities and documents
```sql
-- Search entities
SELECT *, ts_rank(search_vector, query) as rank
FROM entities, plainto_tsquery('english', $1) query
WHERE search_vector @@ query
ORDER BY rank DESC;

-- Search documents
SELECT *, ts_rank(search_vector, query) as rank
FROM documents, plainto_tsquery('english', $1) query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

### Timeline query with entity filter
```sql
SELECT e.*, 
  array_agg(DISTINCT ent.name) as entity_names,
  array_agg(DISTINCT d.bates_number) as source_documents
FROM events e
LEFT JOIN entity_events ee ON e.id = ee.event_id
LEFT JOIN entities ent ON ee.entity_id = ent.id
LEFT JOIN event_documents ed ON e.id = ed.event_id
LEFT JOIN documents d ON ed.document_id = d.id
WHERE ($1::uuid IS NULL OR ee.entity_id = $1)
  AND ($2::text IS NULL OR e.event_type = $2)
  AND ($3::date IS NULL OR e.date >= $3)
  AND ($4::date IS NULL OR e.date <= $4)
GROUP BY e.id
ORDER BY e.date ASC;
```

### Dashboard stats
```sql
SELECT
  (SELECT COUNT(*) FROM entities) as total_entities,
  (SELECT COUNT(*) FROM documents) as total_documents,
  (SELECT COUNT(*) FROM events) as total_events,
  (SELECT COUNT(*) FROM documents WHERE severity = 'extreme_critical') as extreme_findings,
  (SELECT COUNT(*) FROM documents WHERE processing_status = 'needs_review') as pending_review,
  (SELECT COUNT(*) FROM entities WHERE tier = 1) as tier_1_count;
```

## Supabase Client Usage

### Server Components (read-only)
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function EntitiesPage() {
  const supabase = await createClient()
  const { data: entities } = await supabase
    .from('entities')
    .select('*')
    .order('name')
  
  return <EntityList entities={entities} />
}
```

### API Routes (read/write)
```typescript
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  
  const { data, error } = await supabase
    .from('entities')
    .insert(body)
    .select()
    .single()
  
  if (error) return Response.json({ error }, { status: 400 })
  return Response.json(data)
}
```

### Client Components (with auth)
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

export function SearchBox() {
  const supabase = createClient()
  
  async function search(query: string) {
    const { data } = await supabase
      .from('entities')
      .select('*')
      .textSearch('search_vector', query)
      .limit(20)
    return data
  }
}
```
