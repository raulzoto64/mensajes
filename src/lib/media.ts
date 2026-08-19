import { supabase } from './supabase'

function mediaPathFromUrl(url?: string | null): string | null {
  if (!url) return null
  const marker = '/object/public/media/'
  const i = url.indexOf(marker)
  if (i === -1) return null
  return url.slice(i + marker.length)
}

export async function deleteMediaFiles(...urls: (string | null | undefined)[]): Promise<void> {
  const paths = [...new Set(urls.map(mediaPathFromUrl).filter((p): p is string => Boolean(p)))]
  if (!paths.length) return
  await supabase.storage.from('media').remove(paths).then(() => {}, () => {})
}