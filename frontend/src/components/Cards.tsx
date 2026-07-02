import './Cards.css'

export function BuddyButton({ onClick }: { onClick?: () => void }) {
  return (
    <button className="buddy-btn" onClick={onClick}>
      <span className="buddy-btn-icon">👥</span>
      <span>НАЙТИ БАДДИ</span>
    </button>
  )
}

export function ReferralBanner({ onClick }: { onClick?: () => void }) {
  return (
    <button className="referral card" onClick={onClick}>
      <span className="ref-icon">🔗</span>
      <span className="ref-text">
        <span className="ref-title">РЕФЕРАЛЬНАЯ ПРОГРАММА</span>
        <span className="ref-sub dim">Пригласи друзей и получи бонусы</span>
      </span>
      <span className="ref-chevron gold">›</span>
    </button>
  )
}
