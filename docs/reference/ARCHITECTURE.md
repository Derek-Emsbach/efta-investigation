# Architecture Reference

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                      │
│  Next.js App Router                                      │
│  ├── (public)/ — Entity profiles, timeline, search       │
│  ├── (admin)/ — Dashboard, processing, review            │
│  └── api/ — REST endpoints querying Supabase             │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌─────────▼──────────┐
│   SUPABASE     │          │  CLOUDFLARE R2     │
│                │          │                    │
│  PostgreSQL    │          │  /datasets/ds12/   │
│  Auth          │          │  /datasets/ds9/    │
│  Full-text     │          │  /images/          │
│  search        │          │  /exports/         │
│  Realtime      │          │  /thumbnails/      │
└───────▲────────┘          └─────────▲──────────┘
        │                             │
        └──────────────┬──────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              PROCESSING WORKER (Railway)                  │
│  FastAPI + Python                                        │
│  ├── Zip ingestion                                       │
│  ├── PDF forensic analysis (PyMuPDF)                     │
│  ├── Text extraction + OCR                               │
│  ├── Entity recognition                                  │
│  ├── Redaction detection                                 │
│  ├── Cross-referencing                                   │
│  └── Evidence classification                             │
└──────────────────────────────────────────────────────────┘
```

## Data Flow

### Document Ingestion
1. User uploads zip via admin UI (or worker pulls from Google Drive)
2. Worker unpacks zip, creates `document` record per file (status: queued)
3. Worker uploads original file to R2, stores URL in document record
4. Worker processes through pipeline stages, updating status at each step
5. Extracted data written to Supabase (entities, connections, redactions, etc.)
6. High-value documents flagged as `needs_review`
7. Admin reviews and approves → status becomes `published`
8. Published documents appear in frontend

### Query Pattern
1. Next.js server component or API route receives request
2. Creates Supabase server client (using `@supabase/ssr`)
3. Queries Supabase PostgreSQL via client library
4. Returns data to component for rendering
5. For file access: returns signed R2 URL or proxies through API route

### Auth Pattern
1. User hits protected route
2. Middleware checks Supabase session
3. No session → redirect to `/login`
4. Session valid → allow access
5. RLS policies enforce data access at database level

## API Route Patterns

All API routes follow this pattern:

```typescript
// app/api/entities/route.ts
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  
  let query = supabase.from('entities').select('*')
  
  // Apply filters from search params
  const tier = searchParams.get('tier')
  if (tier) query = query.eq('tier', parseInt(tier))
  
  // Pagination
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  query = query.range((page - 1) * limit, page * limit - 1)
  
  const { data, error, count } = await query
  
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data, count, page, limit })
}
```

## File Storage Pattern (R2)

```
R2 Bucket: efta-documents
├── datasets/
│   ├── ds12/
│   │   ├── EFTA02730265.pdf
│   │   ├── EFTA02730269.pdf
│   │   └── ...
│   ├── ds9/
│   │   └── ...
│   └── ...
├── thumbnails/
│   ├── EFTA02730265_thumb.jpg
│   └── ...
├── images/
│   ├── evidence/
│   │   └── mv_photos/
│   └── profiles/
└── exports/
```

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Server-side only, never expose

# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=efta-documents
R2_PUBLIC_URL=https://xxx.r2.dev  # If public access enabled

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
