import { supabase } from './supabase'

const BUCKET = 'question-images'
const MAX = 5 * 1024 * 1024

/** Nahraje obrázek do Supabase Storage a vrátí veřejnou URL. */
export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Tohle není obrázek.')
  if (file.size > MAX) throw new Error('Obrázek je větší než 5 MB.')
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Markdown zápis obrázku, který umí RichText. */
export const imageMarkdown = (url: string) => `![](${url})`

/** Vrátí první obrázek ze schránky (Ctrl+V screenshotu), pokud tam je. */
export function imageFromClipboard(e: React.ClipboardEvent): File | null {
  for (const item of Array.from(e.clipboardData.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile()
  }
  return null
}

/**
 * Smaže z úložiště obrázky, na které už nic neodkazuje (otázky, odpovědi, historie pokusů).
 * Volá se na pozadí po mazání a ukládání; chyby se jen zalogují.
 */
export async function cleanupImages() {
  try {
    const { data, error } = await supabase.rpc('orphan_question_images')
    if (error) throw error
    const names = (data as string[] | null) ?? []
    for (let i = 0; i < names.length; i += 100) {
      const { error } = await supabase.storage.from(BUCKET).remove(names.slice(i, i + 100))
      if (error) throw error
    }
    return names.length
  } catch (e) {
    console.warn('Úklid obrázků selhal', e)
    return 0
  }
}
