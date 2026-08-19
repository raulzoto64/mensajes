import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Props = {
  onSelect: (url: string) => void
  onClose: () => void
}

type GifResult = { id: string; url: string; preview: string; title: string; source: 'giphy' | 'custom' }

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY ?? ''

const PRESET_GIFS: GifResult[] = [
  { id: 'p1', url: 'https://media.giphy.com/media/ZqlvCTNHpqrio/giphy.gif', preview: 'https://media.giphy.com/media/ZqlvCTNHpqrio/giphy.gif', title: 'Thumbs up', source: 'giphy' },
  { id: 'p2', url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', preview: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', title: 'Fire', source: 'giphy' },
  { id: 'p3', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', title: 'Clapping', source: 'giphy' },
  { id: 'p4', url: 'https://media.giphy.com/media/xT9IgG50Lg7russbDa/giphy.gif', preview: 'https://media.giphy.com/media/xT9IgG50Lg7russbDa/giphy.gif', title: 'Laugh', source: 'giphy' },
  { id: 'p5', url: 'https://media.giphy.com/media/WRQBXSCnEFJIuxktnw/giphy.gif', preview: 'https://media.giphy.com/media/WRQBXSCnEFJIuxktnw/giphy.gif', title: 'Party', source: 'giphy' },
  { id: 'p6', url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif', preview: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif', title: 'Love', source: 'giphy' },
]

export default function GifPicker({ onSelect, onClose }: Props) {
  const { user } = useAuth()
  const [tab, setTab] = useState<'library' | 'custom'>('library')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<GifResult[]>(PRESET_GIFS)
  const [customGifs, setCustomGifs] = useState<GifResult[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (tab === 'custom') loadCustomGifs()
  }, [tab])

  async function searchGiphy(query: string) {
    if (!GIPHY_KEY) {
      setResults(PRESET_GIFS.filter(g => g.title.toLowerCase().includes(query.toLowerCase())))
      return
    }
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=18&rating=pg`
    const res = await fetch(url)
    const json = await res.json()
    const gifs: GifResult[] = json.data.map((g: any) => ({
      id: g.id,
      url: g.images.original.url,
      preview: g.images.fixed_height_small.url,
      title: g.title,
      source: 'giphy' as const,
    }))
    setResults(gifs)
  }

  useEffect(() => {
    if (!search.trim()) { setResults(PRESET_GIFS); return }
    const timer = setTimeout(() => searchGiphy(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  async function loadCustomGifs() {
    if (!user) return
    const { data } = await supabase.from('custom_gifs').select('*').order('created_at', { ascending: false })
    if (data) {
      setCustomGifs(
        data.map((g: any) => ({ id: g.id, url: g.url, preview: g.url, title: g.name ?? 'GIF', source: 'custom' as const }))
      )
    }
  }

  async function uploadCustomGif(file: File) {
    if (!user) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `gifs/${user.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('media').upload(path, file, { contentType: file.type })
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
      await supabase.from('custom_gifs').insert({ created_by: user.id, url: urlData.publicUrl, name: file.name })
      loadCustomGifs()
    }
    setUploading(false)
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '64px',
        left: '0',
        background: '#0f0f1e',
        border: '1px solid #1e1e3a',
        borderRadius: '16px',
        padding: '12px',
        width: '340px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        zIndex: 100,
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['library', 'custom'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '4px 12px',
                background: tab === t ? '#8b5cf6' : '#14142a',
                border: `1px solid ${tab === t ? '#8b5cf6' : '#1e1e3a'}`,
                borderRadius: '20px',
                color: tab === t ? '#fff' : '#6b6b8a',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {t === 'library' ? 'Biblioteca' : 'Mis GIFs'}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#3d3d5c', cursor: 'pointer', fontSize: '16px' }}>
          ✕
        </button>
      </div>

      {tab === 'library' && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={GIPHY_KEY ? 'Buscar en Giphy...' : 'Buscar (configura VITE_GIPHY_API_KEY)'}
            style={{
              width: '100%',
              background: '#14142a',
              border: '1px solid #1e1e3a',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#e8e8f0',
              fontSize: '13px',
              fontFamily: "'Outfit', sans-serif",
              marginBottom: '10px',
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
            {results.map((g) => (
              <button
                key={g.id}
                onClick={() => { onSelect(g.url); onClose() }}
                style={{
                  padding: 0,
                  border: '1px solid #1e1e3a',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  background: '#14142a',
                  aspectRatio: '4/3',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#8b5cf6')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e1e3a')}
              >
                <img src={g.preview} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'custom' && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(139,92,246,0.1)',
              border: '1px dashed #8b5cf6',
              borderRadius: '10px',
              color: '#c4b5fd',
              fontSize: '13px',
              cursor: uploading ? 'default' : 'pointer',
              fontFamily: "'Outfit', sans-serif",
              marginBottom: '10px',
            }}
          >
            {uploading ? 'Subiendo...' : '+ Subir GIF personalizado'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.[0]) uploadCustomGif(e.target.files[0]) }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
            {customGifs.length === 0 && (
              <p style={{ color: '#3d3d5c', fontSize: '12px', gridColumn: '1/-1', textAlign: 'center', padding: '20px 0' }}>
                No tienes GIFs personalizados
              </p>
            )}
            {customGifs.map((g) => (
              <button
                key={g.id}
                onClick={() => { onSelect(g.url); onClose() }}
                style={{
                  padding: 0,
                  border: '1px solid #1e1e3a',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  background: '#14142a',
                  aspectRatio: '4/3',
                }}
              >
                <img src={g.preview} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
