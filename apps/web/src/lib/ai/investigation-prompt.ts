import { buildArcherStaticPrompt } from './archer-prompt'

export interface InvestigationContext {
  id: string
  name: string
  status: string
  summary: string | null
  open_questions: string[]
  entities: {
    name: string
    tier: number | null
    entity_type: string
    role: string | null
  }[]
  documents: {
    bates_number: string | null
    title: string | null
    document_type: string | null
    severity: string | null
  }[]
  events: {
    title: string | null
    date: string | null
    event_type: string | null
    description: string | null
  }[]
}

/**
 * Builds the investigation-specific context block for Archer.
 * Reuses the core Archer persona from archer-prompt.ts but adds
 * investigation scope instead of document-review scope.
 */
export function buildInvestigationStaticPrompt(): string {
  return `${buildArcherStaticPrompt()}

## Investigation Mode

You are now operating in **Investigation Mode** — scoped to a specific investigation case rather than a single document review. Your job is to help the analyst build their case by:

1. **Analyzing linked evidence** — summarize what the evidence shows and what gaps remain
2. **Suggesting new evidence** — search the database for entities, documents, and events that may be relevant but aren't linked yet
3. **Drafting narratives** — write evidence-based case summaries when asked
4. **Identifying gaps** — analyze the linked evidence for holes, contradictions, and missing connections
5. **Cross-referencing** — find patterns across linked entities, documents, and events

When suggesting evidence to add, be specific about WHY it's relevant. When drafting summaries, cite Bates numbers and entity names.

## Quick Actions
The analyst may ask you to:
- **"Summarize this case"** — Draft a narrative summary from all linked evidence
- **"Find gaps"** — Analyze what's missing from the investigation
- **"Suggest evidence"** — Search for related items not yet linked
- **"Cross-reference"** — Find patterns between linked entities`
}

export function buildInvestigationContext(ctx: InvestigationContext): string {
  const entityList =
    ctx.entities.length > 0
      ? ctx.entities
          .map(
            (e) =>
              `- ${e.name} (${e.entity_type}, Tier ${e.tier ?? '?'}${e.role ? `, role: ${e.role}` : ''})`
          )
          .join('\n')
      : '(No entities linked yet)'

  const docList =
    ctx.documents.length > 0
      ? ctx.documents
          .map(
            (d) =>
              `- ${d.bates_number ?? 'Unknown'}: ${d.title ?? 'Untitled'} (${d.document_type ?? 'Unknown'}, severity: ${d.severity ?? 'unassessed'})`
          )
          .join('\n')
      : '(No documents linked yet)'

  const eventList =
    ctx.events.length > 0
      ? ctx.events
          .map(
            (e) =>
              `- ${e.date ?? 'No date'}: ${e.title ?? 'Untitled'} (${e.event_type ?? 'Unknown'})`
          )
          .join('\n')
      : '(No events linked yet)'

  const questionList =
    ctx.open_questions.length > 0
      ? ctx.open_questions.map((q) => `- ${q}`).join('\n')
      : '(No open questions defined yet)'

  return `## Active Investigation: ${ctx.name}

**Status**: ${ctx.status}
**Summary**: ${ctx.summary ?? '(No summary written yet)'}

### Linked Entities (${ctx.entities.length})
${entityList}

### Linked Documents (${ctx.documents.length})
${docList}

### Linked Events (${ctx.events.length})
${eventList}

### Open Questions
${questionList}`
}
