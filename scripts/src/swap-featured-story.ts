import { supabase } from './utils/supabase-admin.js'

async function main() {
  // Clear existing featured
  const { error: clearError } = await supabase
    .from('stories')
    .update({ is_featured: false })
    .eq('is_featured', true)

  if (clearError) {
    console.error('Error clearing featured:', clearError)
    return
  }

  // Set "The System" as featured
  const { data, error: setError } = await supabase
    .from('stories')
    .update({ is_featured: true })
    .eq('slug', 'the-system')
    .select('slug, title, is_featured')

  if (setError) {
    console.error('Error setting featured:', setError)
    return
  }

  console.log('Featured story updated:', data)
}

main()
