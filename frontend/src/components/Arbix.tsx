import './Arbix.css'

export default function Arbix({ onClick }: { onClick?: () => void }) {
  return (
    <button className="arbix card" onClick={onClick}>
      <div className="arbix-info">
        <div className="arbix-title">Arbix</div>
        <div className="arbix-sub">Аналитический SaaS для крипторынка</div>
        <span className="arbix-cta">Открыть <span className="arbix-cta-arrow">›</span></span>
      </div>
      <div className="arbix-shot">
        <img src="/dashboard-v2.webp" alt="Arbix dashboard" />
      </div>
    </button>
  )
}
