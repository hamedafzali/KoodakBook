'use client'

/* Last resort: the root layout itself failed, so neither globals.css nor the
 * Vazirmatn font is guaranteed. Next's default here is an English page on
 * white; this keeps the app's cream page, RTL and Persian copy using inline
 * styles only. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fa" dir="rtl" style={{ backgroundColor: '#FEFAF5', colorScheme: 'light' }}>
      <body
        style={{
          margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
          background: 'linear-gradient(160deg, #FFFBF0 0%, #FFF5E0 100%)', color: '#3D3028',
          fontFamily: 'Vazirmatn, Tahoma, sans-serif', textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>یک مشکلی پیش آمد</h1>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 56, minWidth: 180, padding: '0 24px', borderRadius: 28, cursor: 'pointer',
            border: 0, borderBottom: '6px solid #745300', background: '#FBBF24', color: '#654900',
            fontFamily: 'inherit', fontSize: 18, fontWeight: 700,
          }}
        >
          دوباره امتحان کن
        </button>
      </body>
    </html>
  )
}
