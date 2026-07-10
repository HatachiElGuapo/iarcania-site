export default function AlertBar({ alerts }: { alerts: string[] }) {
  return (
    <div style={{ background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.35)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: 20 }}>
      <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 4, fontSize: '0.8rem' }}>⚠ ALERTAS</div>
      {alerts.map((a, i) => (
        <div key={i} style={{ fontSize: '0.82rem', color: '#f0aaaa', paddingLeft: 8 }}>• {a}</div>
      ))}
    </div>
  )
}
