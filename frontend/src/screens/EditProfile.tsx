import { useEffect, useState } from 'react'
import './EditProfile.css'
import Header from '../components/Header'
import { getCurrentUser } from '../tgUser'
import { getMyProfile, saveMyProfile } from '../api'
import type { ProfileData } from '../api'

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}


// Уменьшаем выбранное фото до 256×256 и кодируем в data:URL (чтобы не хранить
// в БД тяжёлые файлы). Дефолтное фото берётся из Telegram, это — замена.
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no canvas'))
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
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

export default function EditProfile({
  onBack,
  onSaved,
}: {
  onBack?: () => void
  onSaved?: () => void
}) {
  const tg = getCurrentUser()
  const initials = `${tg.firstName[0] ?? ''}${tg.lastName[0] ?? ''}` || 'AP'

  const [form, setForm] = useState<ProfileData>({
    firstName: tg.firstName,
    lastName: tg.lastName,
    allowMessages: true,
    showProfile: true,
    social: {},
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    getMyProfile()
      .then(({ profile }) => {
        if (alive) setForm((f) => ({ ...f, ...profile, social: { ...f.social, ...profile.social } }))
      })
      .catch(() => {
        /* вне сети/сервера — остаёмся на дефолтах из Telegram */
      })
    return () => {
      alive = false
    }
  }, [])

  const set = (key: keyof ProfileData, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await fileToAvatar(file)
      set('avatar', dataUrl)
    } catch {
      alert('Не удалось обработать изображение')
    }
  }
  const setSocial = (key: keyof NonNullable<ProfileData['social']>, value: string) =>
    setForm((f) => ({ ...f, social: { ...f.social, [key]: value } }))

  async function handleSave() {
    setSaving(true)
    try {
      await saveMyProfile(form)
      onSaved?.()
    } catch (e) {
      console.error(e)
      alert('Не удалось сохранить. Проверьте, что запущен API-сервер.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="edit-profile">
      <Header title="APClub" onBack={onBack} />

      <div className="ep-body">
        <div className="ep-subhead">
          <button className="ep-back" onClick={onBack}>‹ Назад</button>
        </div>

        {/* Шапка с аватаром */}
        <div className="ep-hero">
          <label className="ep-avatar" title="Загрузить фото">
            {form.avatar || tg.avatar ? (
              <img src={form.avatar || tg.avatar} alt="" />
            ) : (
              <span>{initials}</span>
            )}
            <span className="ep-avatar-cam"><CameraIcon /></span>
            <input type="file" accept="image/*" hidden onChange={handleFile} />
          </label>
          <div className="ep-hero-info">
            <div className="ep-hero-name">{form.firstName} {form.lastName}</div>
            {tg.username && <div className="ep-hero-username">@{tg.username}</div>}
            <span className="ep-hero-badge">Пробный</span>
          </div>
        </div>

        {/* Имя */}
        <label className="ep-field">
          <span className="ep-label">Имя</span>
          <input autoComplete="off" className="ep-input" value={form.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} />
          <span className="ep-hint">По умолчанию загружается из Telegram</span>
        </label>

        {/* Фамилия */}
        <label className="ep-field">
          <span className="ep-label">Фамилия</span>
          <input autoComplete="off" className="ep-input" value={form.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} />
          <span className="ep-hint">По умолчанию загружается из Telegram</span>
        </label>

        {/* Почта — используется для проверки доступа */}
        <label className="ep-field">
          <span className="ep-label">Почта</span>
          <input autoComplete="off" className="ep-input" type="email" inputMode="email" value={form.email ?? ''} placeholder="you@email.com" onChange={(e) => set('email', e.target.value)} />
          <span className="ep-hint">На неё проверяется доступ к клубу</span>
        </label>

        {/* Город */}
        <label className="ep-field">
          <span className="ep-label">Город</span>
          <div className="ep-input-wrap">
            <span className="ep-input-icon"><PinIcon /></span>
            <input autoComplete="off" className="ep-input has-icon" value={form.city ?? ''} placeholder="Город" onChange={(e) => set('city', e.target.value)} />
          </div>
        </label>

        {/* Основная профессиональная деятельность */}
        <label className="ep-field">
          <span className="ep-label">Основная деятельность</span>
          <input autoComplete="off" className="ep-input" value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} placeholder="напр. Founder · CleanTech-стартап" />
        </label>

        {/* Текущий фокус */}
        <label className="ep-field">
          <span className="ep-label">Текущий фокус</span>
          <textarea autoComplete="off" className="ep-textarea" rows={3} value={form.focus ?? ''} onChange={(e) => set('focus', e.target.value)} placeholder="Над чем работаешь сейчас" />
        </label>

        {/* Стратегии */}
        <label className="ep-field">
          <span className="ep-label">Стратегии</span>
          <input autoComplete="off" className="ep-input" value={form.strategies ?? ''} onChange={(e) => set('strategies', e.target.value)} placeholder="На чём сосредоточен" />
        </label>

        {/* Направления */}
        <label className="ep-field">
          <span className="ep-label">Направления</span>
          <input autoComplete="off" className="ep-input" value={form.directions ?? ''} onChange={(e) => set('directions', e.target.value)} />
        </label>

        {/* Темы для обсуждения */}
        <label className="ep-field">
          <span className="ep-label">Темы для обсуждения</span>
          <textarea autoComplete="off" className="ep-textarea" rows={2} value={form.topics ?? ''} onChange={(e) => set('topics', e.target.value)} placeholder="О чём хочешь поговорить" />
        </label>

        {/* Что могу предложить */}
        <label className="ep-field">
          <span className="ep-label">Что могу предложить</span>
          <textarea autoComplete="off" className="ep-textarea" rows={2} value={form.offer ?? ''} onChange={(e) => set('offer', e.target.value)} />
        </label>

        {/* Результаты за месяц */}
        <div className="ep-row2">
          <label className="ep-field">
            <span className="ep-label">Средний результат / мес</span>
            <input autoComplete="off" className="ep-input" value={form.avgResult ?? ''} onChange={(e) => set('avgResult', e.target.value)} placeholder="напр. $1 500" />
          </label>
          <label className="ep-field">
            <span className="ep-label">Максимальный / мес</span>
            <input autoComplete="off" className="ep-input" value={form.maxResult ?? ''} onChange={(e) => set('maxResult', e.target.value)} placeholder="напр. $6 000" />
          </label>
        </div>

        {/* Соцсети */}
        <div className="ep-section-title">Мои соц. сети</div>

        <label className="ep-field">
          <span className="ep-label ep-label-sm">Instagram</span>
          <input autoComplete="off" className="ep-input" value={form.social?.instagram ?? ''} placeholder="https://" onChange={(e) => setSocial('instagram', e.target.value)} />
        </label>
        <label className="ep-field">
          <span className="ep-label ep-label-sm">LinkedIn</span>
          <input autoComplete="off" className="ep-input" value={form.social?.linkedin ?? ''} placeholder="https://" onChange={(e) => setSocial('linkedin', e.target.value)} />
        </label>
        <label className="ep-field">
          <span className="ep-label ep-label-sm">Telegram</span>
          <input autoComplete="off" className="ep-input" value={form.social?.telegram ?? ''} placeholder="https://" onChange={(e) => setSocial('telegram', e.target.value)} />
        </label>
        <label className="ep-field">
          <span className="ep-label ep-label-sm">Web:</span>
          <input autoComplete="off" className="ep-input" value={form.social?.web ?? ''} placeholder="https://" onChange={(e) => setSocial('web', e.target.value)} />
        </label>

        {/* Тумблеры */}
        <div className="ep-toggle-row">
          <div className="ep-toggle-text">
            <div className="ep-toggle-title">Разрешить мне писать</div>
            <div className="ep-toggle-sub">Возможность написать мне сообщение</div>
          </div>
          <button
            className={`ep-switch${form.allowMessages ? ' is-on' : ''}`}
            role="switch"
            aria-checked={form.allowMessages}
            onClick={() => set('allowMessages', !form.allowMessages)}
          >
            <span className="ep-switch-knob" />
          </button>
        </div>

        <button className="ep-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
