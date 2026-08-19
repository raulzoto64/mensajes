export default function SetupPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#070711',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Outfit', sans-serif",
        padding: '24px',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '480px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #8b5cf6, #22d3ee)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px',
              boxShadow: '0 0 40px rgba(139,92,246,0.25)',
            }}
          >
            ◈
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#e8e8f0', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Ephemera
          </h1>
          <p style={{ color: '#6b6b8a', fontSize: '14px', margin: 0 }}>
            Configuración requerida
          </p>
        </div>

        {/* Warning card */}
        <div
          style={{
            background: '#0f0f1e',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '20px',
            padding: '28px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                minWidth: '36px',
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              ⚠
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '600', color: '#fbbf24' }}>
                Credenciales de Supabase no configuradas
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b6b8a', lineHeight: '1.5' }}>
                La app necesita un archivo <code style={{ background: '#14142a', padding: '1px 5px', borderRadius: '4px', color: '#c4b5fd', fontSize: '12px' }}>.env</code> con las credenciales de tu proyecto Supabase para funcionar.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Step n={1} title="Crea un proyecto en Supabase">
              Ve a{' '}
              <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: '#8b5cf6' }}>
                supabase.com
              </a>{' '}
              → New Project
            </Step>
            <Step n={2} title="Ejecuta el schema SQL">
              En <b style={{ color: '#c4b5fd' }}>SQL Editor</b>, pega y ejecuta el contenido de{' '}
              <code style={{ background: '#14142a', padding: '1px 5px', borderRadius: '4px', color: '#c4b5fd', fontSize: '12px' }}>supabase/schema.sql</code>
            </Step>
            <Step n={3} title="Crea el archivo .env">
              En la raíz del proyecto, crea <code style={{ background: '#14142a', padding: '1px 5px', borderRadius: '4px', color: '#c4b5fd', fontSize: '12px' }}>.env</code> con:
            </Step>
          </div>

          <div
            style={{
              marginTop: '16px',
              background: '#070711',
              border: '1px solid #1e1e3a',
              borderRadius: '12px',
              padding: '16px',
              fontFamily: "'DM Mono', monospace",
              fontSize: '12px',
              lineHeight: '1.8',
              color: '#9090b0',
            }}
          >
            <div>
              <span style={{ color: '#3d3d5c' }}># Settings → API en tu proyecto Supabase</span>
            </div>
            <div>
              <span style={{ color: '#22d3ee' }}>VITE_SUPABASE_URL</span>
              <span style={{ color: '#6b6b8a' }}>=</span>
              <span style={{ color: '#fbbf24' }}>https://xxxx.supabase.co</span>
            </div>
            <div>
              <span style={{ color: '#22d3ee' }}>VITE_SUPABASE_ANON_KEY</span>
              <span style={{ color: '#6b6b8a' }}>=</span>
              <span style={{ color: '#fbbf24' }}>eyJhbGciOi...</span>
            </div>
            <div style={{ marginTop: '8px' }}>
              <span style={{ color: '#3d3d5c' }}># Opcional — para búsqueda de GIFs</span>
            </div>
            <div>
              <span style={{ color: '#22d3ee' }}>VITE_GIPHY_API_KEY</span>
              <span style={{ color: '#6b6b8a' }}>=</span>
              <span style={{ color: '#fbbf24' }}>tu_clave_giphy</span>
            </div>
          </div>

          <div
            style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.15)',
              borderRadius: '10px',
              fontSize: '12px',
              color: '#9090b0',
              lineHeight: '1.5',
            }}
          >
            💡 Tras crear el <code style={{ color: '#c4b5fd' }}>.env</code>, reinicia el servidor de desarrollo con{' '}
            <code style={{ background: '#14142a', padding: '1px 5px', borderRadius: '4px', color: '#c4b5fd' }}>pnpm dev</code>{' '}
            para que las variables surtan efecto.
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#3d3d5c', fontSize: '11px', fontFamily: "'DM Mono', monospace" }}>
          VER <code style={{ color: '#4a4a6a' }}>supabase/README.md</code> PARA INSTRUCCIONES COMPLETAS
        </p>
      </div>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div
        style={{
          width: '22px',
          height: '22px',
          minWidth: '22px',
          background: 'rgba(139,92,246,0.15)',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: '700',
          color: '#c4b5fd',
          fontFamily: "'DM Mono', monospace",
          marginTop: '1px',
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#e8e8f0', marginBottom: '2px' }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#6b6b8a', lineHeight: '1.5' }}>{children}</div>
      </div>
    </div>
  )
}
