export default function SetupPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f0f2f5',
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
              background: 'linear-gradient(135deg, #00a884, #0088cc)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px',
              boxShadow: '0 0 40px rgba(0,168,132,0.2)',
            }}
          >
            ◈
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#111b21', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Ephemera
          </h1>
          <p style={{ color: '#8696a0', fontSize: '14px', margin: 0 }}>
            Configuración requerida
          </p>
        </div>

        {/* Warning card */}
        <div
          style={{
            background: '#ffffff',
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
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.2)',
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
              <p style={{ margin: 0, fontSize: '13px', color: '#8696a0', lineHeight: '1.5' }}>
                La app necesita un archivo <code style={{ background: '#f0f2f5', padding: '1px 5px', borderRadius: '4px', color: '#00a884', fontSize: '12px' }}>.env</code> con las credenciales de tu proyecto Supabase para funcionar.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Step n={1} title="Crea un proyecto en Supabase">
              Ve a{' '}
              <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: '#00a884' }}>
                supabase.com
              </a>{' '}
              → New Project
            </Step>
            <Step n={2} title="Ejecuta el schema SQL">
              En <b style={{ color: '#00a884' }}>SQL Editor</b>, pega y ejecuta el contenido de{' '}
              <code style={{ background: '#f0f2f5', padding: '1px 5px', borderRadius: '4px', color: '#00a884', fontSize: '12px' }}>supabase/schema.sql</code>
            </Step>
            <Step n={3} title="Crea el archivo .env">
              En la raíz del proyecto, crea <code style={{ background: '#f0f2f5', padding: '1px 5px', borderRadius: '4px', color: '#00a884', fontSize: '12px' }}>.env</code> con:
            </Step>
          </div>

          <div
            style={{
              marginTop: '16px',
              background: '#f0f2f5',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '16px',
              fontFamily: "'DM Mono', monospace",
              fontSize: '12px',
              lineHeight: '1.8',
              color: '#667781',
            }}
          >
            <div>
              <span style={{ color: '#adb5bd' }}># Settings → API en tu proyecto Supabase</span>
            </div>
            <div>
              <span style={{ color: '#0088cc' }}>VITE_SUPABASE_URL</span>
              <span style={{ color: '#8696a0' }}>=</span>
              <span style={{ color: '#fbbf24' }}>https://xxxx.supabase.co</span>
            </div>
            <div>
              <span style={{ color: '#0088cc' }}>VITE_SUPABASE_ANON_KEY</span>
              <span style={{ color: '#8696a0' }}>=</span>
              <span style={{ color: '#fbbf24' }}>eyJhbGciOi...</span>
            </div>
            <div style={{ marginTop: '8px' }}>
              <span style={{ color: '#adb5bd' }}># Opcional — para búsqueda de GIFs</span>
            </div>
            <div>
              <span style={{ color: '#0088cc' }}>VITE_GIPHY_API_KEY</span>
              <span style={{ color: '#8696a0' }}>=</span>
              <span style={{ color: '#fbbf24' }}>tu_clave_giphy</span>
            </div>
          </div>

          <div
            style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: 'rgba(0,168,132,0.06)',
              border: '1px solid rgba(0,168,132,0.12)',
              borderRadius: '10px',
              fontSize: '12px',
              color: '#667781',
              lineHeight: '1.5',
            }}
          >
            💡 Tras crear el <code style={{ color: '#00a884' }}>.env</code>, reinicia el servidor de desarrollo con{' '}
            <code style={{ background: '#f0f2f5', padding: '1px 5px', borderRadius: '4px', color: '#00a884' }}>pnpm dev</code>{' '}
            para que las variables surtan efecto.
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#adb5bd', fontSize: '11px', fontFamily: "'DM Mono', monospace" }}>
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
          background: 'rgba(0,168,132,0.12)',
          border: '1px solid rgba(0,168,132,0.2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: '700',
          color: '#00a884',
          fontFamily: "'DM Mono', monospace",
          marginTop: '1px',
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#111b21', marginBottom: '2px' }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#8696a0', lineHeight: '1.5' }}>{children}</div>
      </div>
    </div>
  )
}
