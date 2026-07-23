import { useEffect, useState } from 'react'
import { getProfiles, getPreviewToken, type Profile } from './api'

// Адрес живого мини-аппа. Можно переопределить VITE_MINIAPP_URL на деплое —
// по умолчанию прод-адрес (совпадает с CORS_ALLOW на сервере).
const MINIAPP_URL = (import.meta.env.VITE_MINIAPP_URL as string) || 'https://apclub.vercel.app'
const LAST_KEY = 'apclub-admin-preview-user'

const nameOf = (p: Profile) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.userId

// Постоянная панель справа — вертикальный мини-апп «глазами» выбранного
// резидента. Токен превью (см. api.ts getPreviewToken) — отдельная от
// Telegram initData схема авторизации, короткоживущая, только для чтения:
// на сервере это НЕ засчитывается как обычный вход (без записи в статистику
// запусков, без авто-активации прогресса).
export default function PreviewPanel() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [userId, setUserId] = useState<string>(() => localStorage.getItem(LAST_KEY) ?? '')
  const [src, setSrc] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    getProfiles()
      .then((list) => {
        const eligible = list
          .filter((p) => /^\d{5,}$/.test(p.userId)) // только реальные Telegram-аккаунты
          .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ru'))
        setProfiles(eligible)
        setUserId((cur) => (cur && eligible.some((p) => p.userId === cur) ? cur : (eligible[0]?.userId ?? '')))
      })
      .catch(() => {})
  }, [])

  async function load(id: string) {
    if (!id) return
    setLoading(true); setErr('')
    try {
      const token = await getPreviewToken(id)
      setSrc(`${MINIAPP_URL}/?preview_token=${encodeURIComponent(token)}&_=${Date.now()}`)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userId) return
    localStorage.setItem(LAST_KEY, userId)
    load(userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return (
    <aside className="preview-panel">
      <div className="pv-head">
        <span className="pv-title">📱 Превью</span>
        <button type="button" className="btn sm btn-ghost" disabled={loading || !userId} onClick={() => load(userId)}>
          {loading ? '…' : '↻ Обновить'}
        </button>
      </div>
      <select className="input pv-select" value={userId} onChange={(e) => setUserId(e.target.value)}>
        {profiles.length === 0 && <option value="">Нет участников</option>}
        {profiles.map((p) => (
          <option key={p.userId} value={p.userId}>{nameOf(p)}</option>
        ))}
      </select>
      {err && <div className="pv-err">{err}</div>}
      <div className="pv-phone">
        {src
          ? <iframe key={src} src={src} title="Превью мини-аппа" />
          : <div className="pv-empty">{loading ? 'Загрузка…' : 'Выбери участника'}</div>}
      </div>
    </aside>
  )
}
