import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

/** PATCH: Update a story_image (role or caption) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { supabase } = result
  const { id, imageId } = await params

  try {
    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if ('role' in body) updates.role = body.role
    if ('caption_override' in body) updates.caption_override = body.caption_override
    if ('sort_order' in body) updates.sort_order = body.sort_order

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // If promoting to hero, demote existing hero
    if (updates.role === 'hero') {
      await supabase
        .from('story_images')
        .update({ role: 'candidate' })
        .eq('story_id', id)
        .eq('role', 'hero')

      // Update story hero_image_url
      const { data: image } = await supabase
        .from('document_images')
        .select('id, caption')
        .eq('id', imageId)
        .single()

      if (image) {
        await supabase
          .from('stories')
          .update({
            hero_image_url: `/api/public/images/${image.id}/file`,
            hero_image_caption: (updates.caption_override as string) || image.caption || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
      }
    }

    const { data, error } = await supabase
      .from('story_images')
      .update(updates)
      .eq('story_id', id)
      .eq('image_id', imageId)
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ storyImage: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE: Remove an image from a story */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { supabase } = result
  const { id, imageId } = await params

  try {
    // Check if this was the hero — if so, clear story hero_image_url
    const { data: existing } = await supabase
      .from('story_images')
      .select('role')
      .eq('story_id', id)
      .eq('image_id', imageId)
      .single()

    if (existing?.role === 'hero') {
      await supabase
        .from('stories')
        .update({
          hero_image_url: null,
          hero_image_caption: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    }

    const { error } = await supabase
      .from('story_images')
      .delete()
      .eq('story_id', id)
      .eq('image_id', imageId)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
