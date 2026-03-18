import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

/** GET: List story_images for a story */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { supabase } = result
  const { id } = await params

  try {
    const { data, error } = await supabase
      .from('story_images')
      .select('*, image:image_id(id, r2_key, thumbnail_r2_key, caption, image_type, width, height, tags, document_id)')
      .eq('story_id', id)
      .order('sort_order', { ascending: true })

    if (error) throw new Error(error.message)

    return NextResponse.json({ images: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST: Add an image to a story */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { supabase } = result
  const { id } = await params

  try {
    const body = await request.json()
    const { image_id, role, caption_override } = body

    if (!image_id || !role) {
      return NextResponse.json({ error: 'image_id and role are required' }, { status: 400 })
    }

    if (!['hero', 'inline', 'candidate'].includes(role)) {
      return NextResponse.json({ error: 'role must be hero, inline, or candidate' }, { status: 400 })
    }

    // If setting as hero, clear any existing hero assignment
    if (role === 'hero') {
      await supabase
        .from('story_images')
        .update({ role: 'candidate' })
        .eq('story_id', id)
        .eq('role', 'hero')

      // Also update the story's hero_image_url to point to this image
      const { data: image } = await supabase
        .from('document_images')
        .select('id, caption')
        .eq('id', image_id)
        .single()

      if (image) {
        await supabase
          .from('stories')
          .update({
            hero_image_url: `/api/public/images/${image.id}/file`,
            hero_image_caption: caption_override || image.caption || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
      }
    }

    // Get next sort_order
    const { data: existing } = await supabase
      .from('story_images')
      .select('sort_order')
      .eq('story_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

    const { data, error } = await supabase
      .from('story_images')
      .upsert(
        {
          story_id: id,
          image_id,
          role,
          sort_order: nextOrder,
          caption_override: caption_override || null,
        },
        { onConflict: 'story_id,image_id' },
      )
      .select('*, image:image_id(id, r2_key, thumbnail_r2_key, caption, image_type, width, height, tags, document_id)')
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ storyImage: data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
