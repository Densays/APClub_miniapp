import './Community.css'

function TelegramLogo() {
  return (
    <svg className="tg-logo" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#2AABEE" />
      <path
        fill="#fff"
        d="M5.4 11.74c3.6-1.57 6-2.6 7.2-3.1 3.43-1.43 4.14-1.68 4.6-1.69.1 0 .33.02.48.14.12.1.16.24.17.34.01.1.03.32.02.49-.18 1.9-.96 6.5-1.36 8.62-.17.9-.5 1.2-.82 1.23-.7.06-1.23-.46-1.9-.9-1.06-.7-1.66-1.13-2.69-1.81-1.19-.78-.42-1.21.26-1.91.18-.18 3.23-2.96 3.29-3.21.01-.03.01-.15-.06-.21-.07-.06-.17-.04-.25-.02-.11.02-1.78 1.13-5.03 3.32-.48.33-.91.49-1.29.48-.43-.01-1.24-.24-1.85-.43-.74-.24-1.33-.37-1.28-.78.03-.22.32-.44.88-.67z"
      />
    </svg>
  )
}

export default function Community({ onChat }: { onChat?: () => void }) {
  return (
    <div className="community">
      <div className="community-photo">
        <img src="/community.png" alt="Сообщество AP Crypto Club" />
      </div>
      <button className="community-chat" onClick={onChat}>
        <TelegramLogo />
        <span>Перейти в чат</span>
      </button>
    </div>
  )
}
