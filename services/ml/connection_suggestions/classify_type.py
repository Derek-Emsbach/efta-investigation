"""Classify connection types using Claude API.

Takes scored entity pairs with context excerpts and uses Claude to
determine the relationship type (attorney_for, family_of, etc.).
"""

import json
import sys
from pathlib import Path

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

sys.path.insert(0, str(Path(__file__).parent.parent))
import db
from config import ANTHROPIC_API_KEY

console = Console()

BATCH_SIZE = 5  # Pairs per API call

CLASSIFICATION_PROMPT = """You are analyzing document evidence from the Epstein Files Transparency Act (EFTA) investigation. Given entity pairs and their co-occurring document excerpts, classify the most likely relationship type.

Relationship types:
- attorney_for: Legal representation
- family_of: Family or marriage relationship
- co_accused: Both implicated in criminal activity
- financial: Business, financial, or investment relationship
- social: Personal friendship, social acquaintance
- employed_by: Employment or service relationship
- connected_to: Generic association (use only if no specific type fits)

For each pair, respond with JSON:
{"pairs": [{"index": N, "type": "...", "confidence": 0-100, "reasoning": "one sentence"}]}

Entity pairs to classify:

"""


def build_prompt(pairs_batch: list[dict], entity_map: dict) -> str:
    """Build classification prompt for a batch of pairs."""
    prompt = CLASSIFICATION_PROMPT

    for i, pair in enumerate(pairs_batch):
        ea = entity_map.get(pair["entity_a"], {})
        eb = entity_map.get(pair["entity_b"], {})

        prompt += f"\n--- Pair {i + 1} ---\n"
        prompt += f"Entity A: {ea.get('name', 'Unknown')} (tier: {ea.get('tier', '?')}, type: {ea.get('entity_type', '?')})\n"
        prompt += f"Entity B: {eb.get('name', 'Unknown')} (tier: {eb.get('tier', '?')}, type: {eb.get('entity_type', '?')})\n"
        prompt += f"Co-occurrence count: {pair.get('shared_count', 0)} documents\n"

        excerpts = pair.get("context_excerpts", [])
        for j, exc in enumerate(excerpts[:3]):  # Max 3 excerpts per pair
            prompt += f"Excerpt {j + 1}: \"{exc['excerpt'][:300]}\"\n"

    return prompt


def run(pairs: list[dict]):
    """Classify relationship types for scored pairs using Claude API.

    Updates ml_connection_suggestions with classified types.
    """
    if not ANTHROPIC_API_KEY:
        console.print("[yellow]Warning: ANTHROPIC_API_KEY not set. Skipping classification.[/]")
        return

    try:
        import anthropic
    except ImportError:
        console.print("[red]Error: anthropic package not installed.[/]")
        return

    console.print("[bold]Classifying connection types via Claude API...[/]\n")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Load entity info
    entities = db.get_all_entities()
    entity_map = {e["id"]: e for e in entities}

    # Process in batches
    total_classified = 0
    total_cost_input = 0
    total_cost_output = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Classifying", total=len(pairs))

        for batch_start in range(0, len(pairs), BATCH_SIZE):
            batch = pairs[batch_start:batch_start + BATCH_SIZE]
            prompt = build_prompt(batch, entity_map)

            try:
                response = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}],
                )

                # Track token usage
                total_cost_input += response.usage.input_tokens
                total_cost_output += response.usage.output_tokens

                # Parse response
                response_text = response.content[0].text

                # Extract JSON from response
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    result = json.loads(response_text[json_start:json_end])
                    classifications = result.get("pairs", [])

                    for cls in classifications:
                        idx = cls.get("index", 0) - 1  # 1-indexed in prompt
                        if 0 <= idx < len(batch):
                            pair = batch[idx]
                            suggested_type = cls.get("type", "connected_to")
                            claude_confidence = cls.get("confidence", 50)
                            reasoning = cls.get("reasoning", "")

                            # Update the database record
                            supabase = db.get_client()
                            supabase.table("ml_connection_suggestions").update({
                                "suggested_type": suggested_type,
                                "evidence_summary": reasoning,
                                "score_components": {
                                    **pair.get("score_components", {}),
                                    "claude_classification": claude_confidence,
                                },
                            }).eq("entity_a", pair["entity_a"]).eq(
                                "entity_b", pair["entity_b"]
                            ).execute()

                            total_classified += 1

            except json.JSONDecodeError:
                console.print(f"  [yellow]Warning: Failed to parse response for batch at {batch_start}[/]")
            except Exception as e:
                console.print(f"  [red]Error: {e}[/]")

            progress.update(task, advance=len(batch))

    # Cost estimate (Claude Sonnet pricing)
    cost = (total_cost_input * 3 / 1_000_000) + (total_cost_output * 15 / 1_000_000)

    console.print(f"\n  Classified: {total_classified}/{len(pairs)}")
    console.print(f"  Tokens: {total_cost_input:,} input + {total_cost_output:,} output")
    console.print(f"  Estimated cost: ${cost:.2f}")
