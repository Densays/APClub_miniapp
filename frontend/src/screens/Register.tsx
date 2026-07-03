import { useState } from 'react'
import './Register.css'
import { registerProfile, type ProfileData } from '../api'
import { getCurrentUser } from '../tgUser'

// Уменьшаем фото до 256×256 → data:URL (как в EditProfile).
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no canvas'))
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale, h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Гейт входа: первый онбординг. Аватар и имя подтягиваются из Telegram,
// пользователь дозаполняет и указывает почту (для проверки доступа на платформе).
export default function Register({ initial, onDone }: {
  initial: ProfileData | null
  onDone: (profile: ProfileData) => void
}) {
  const tg = getCurrentUser()
  const [firstName, setFirstName] = useState(initial?.firstName || tg.firstName || '')
  const [lastName, setLastName] = useState(initial?.lastName || tg.lastName || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [avatar, setAvatar] = useState(initial?.avatar || tg.avatar || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const initials = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || '🙂'

  async function pickAvatar(file?: File) {
    if (!file) return
    try { setAvatar(await fileToAvatar(file)) } catch { setErr('Не удалось загрузить фото') }
  }

  async function submit() {
    setErr('')
    if (!firstName.trim() || !lastName.trim()) { setErr('Укажи имя и фамилию'); return }
    if (!EMAIL_RE.test(email.trim())) { setErr('Проверь адрес почты'); return }
    setBusy(true)
    try {
      const profile = await registerProfile({
        firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(),
        avatar: avatar || undefined,
      })
      onDone(profile)
    } catch (e) {
      const m = (e as Error).message
      const errs: Record<string, string> = {
        bad_email: 'Проверь адрес почты',
        name_required: 'Укажи имя и фамилию',
        email_not_allowed: 'Этой почты нет в списке доступа клуба. Обратись к администратору.',
        email_taken: 'Эта почта уже привязана к другому аккаунту.',
      }
      setErr(errs[m] ?? 'Не удалось сохранить. Попробуй ещё раз')
    } finally { setBusy(false) }
  }

  return (
    <div className="reg">
      <div className="reg-body">
        <img className="reg-logo" src="/logo.png" alt="AP Crypto Club" />
        <h1 className="reg-title">Создай профиль резидента</h1>
        <p className="reg-sub">Заполни данные, чтобы войти в AP Crypto Club. Почта нужна для проверки доступа.</p>

        <label className="reg-avatar">
          {avatar ? <img src={avatar} alt="аватар" /> : <span className="reg-avatar-ini">{initials}</span>}
          <span className="reg-avatar-cam">📷</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickAvatar(e.target.files?.[0])} />
        </label>
        <div className="reg-avatar-hint">Фото из Telegram — можно заменить</div>

        <div className="reg-field">
          <label className="reg-label">Имя</label>
          <input className="reg-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Иван" autoComplete="off" />
        </div>
        <div className="reg-field">
          <label className="reg-label">Фамилия</label>
          <input className="reg-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Иванов" autoComplete="off" />
        </div>
        <div className="reg-field">
          <label className="reg-label">Почта</label>
          <input className="reg-input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="off" />
          <div className="reg-field-hint">На неё проверяется доступ к клубу</div>
        </div>

        {err && <div className="reg-err">{err}</div>}

        <button className="reg-btn" disabled={busy} onClick={submit}>
          {busy ? 'Создаём профиль…' : 'Войти в клуб'}
        </button>
      </div>
    </div>
  )
}
