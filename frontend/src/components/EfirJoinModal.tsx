import { useState } from 'react'
import './EfirJoinModal.css'
import { getCurrentUser } from '../tgUser'
import { registerEfir } from '../api'
import { LINKS, openLink } from '../mock'

// Форма входа на «Эфир в клубе»: вместо прямого перехода по ссылке — имя
// (редактируемое) + telegram-ник (авто, read-only). По «Войти» сохраняем
// регистрацию за пользователем (для админ-списка/аналитики) и только потом
// открываем ссылку на комнату.
export default function EfirJoinModal({ onClose }: { onClose: () => void }) {
  const tg = getCurrentUser()
  const [name, setName] = useState(`${tg.firstName} ${tg.lastName}`.trim())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true); setErr('')
    try {
      await registerEfir(name.trim())
      openLink(LINKS.efirRoom)
      onClose()
    } catch {
      setErr('Не удалось зарегистрироваться. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ej-overlay" onClick={onClose}>
      <form className="ej-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="ej-icon">🎥</div>
        <div className="ej-title">Вход в Zoom</div>

        <label className="ej-field">
          <span>Имя</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к тебе обращаться" autoFocus />
        </label>

        <label className="ej-field">
          <span>Никнейм в Telegram</span>
          <input value={tg.username ? `@${tg.username}` : 'не указан'} readOnly className="ej-readonly" />
        </label>

        {err && <div className="ej-err">{err}</div>}

        <button className="ej-submit" type="submit" disabled={!name.trim() || busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
        <button className="ej-cancel" type="button" onClick={onClose}>Отмена</button>
      </form>
    </div>
  )
}
