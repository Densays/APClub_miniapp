import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getProfiles, updateProfile, createMember, deleteProfile, fileToAvatar, getShowcase,
  getResources, saveResources, saveLevels,
  type Profile, type Catalog, type Perk,
} from './api'
import { computeStars, TIER_MAX } from './stars'

const PERIODS: { key: NonNullable<Profile['billingPeriod']>; label: string }[] = [
  { key: 'monthly', label: 'Ежемесячно' },
  { key: 'quarterly', label: 'Ежеквартально' },
  { key: 'semiannual', label: 'Раз в полгода' },
  { key: 'annual', label: 'Ежегодно' },
]

const nameOf = (p: Profile) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Без имени'
const initialsOf = (p: Profile) => (`${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || 'AP')
const dateToInput = (ts?: number) => (ts ? new Date(ts).toISOString().slice(0, 10) : '')

function Avatar({ p, size = 40 }: { p: Profile; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {p.avatar ? <img src={p.avatar} alt="" /> : initialsOf(p)}
    </span>
  )
}

export default function Members({ catalog, openId, onConsumedOpen, onLevelsChange }: {
  catalog: Catalog | null; openId?: string | null; onConsumedOpen?: () => void
  onLevelsChange?: (levels: string[]) => void
}) {
  const [users, setUsers] = useState<Profile[] | null>(null)
  const [sel, setSel] = useState<Profile | null>(null)
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    setErr('')
    try { setUsers(await getProfiles()) }
    catch (e) { setErr((e as Error).message === 'unauth' ? 'Сессия истекла — войдите заново' : 'Не удалось загрузить участников') }
  }
  useEffect(() => { load() }, [])

  // Открыть карточку конкретного участника (напр. переход из таблицы лидеров/дашборда).
  useEffect(() => {
    if (openId && users) {
      const u = users.find((x) => x.userId === openId)
      if (u) { setSel(u); onConsumedOpen?.() }
    }
  }, [openId, users, onConsumedOpen])

  function applyUpdate(p: Profile) {
    setUsers((us) => (us ? us.map((u) => (u.userId === p.userId ? { ...u, ...p } : u)) : us))
    setSel((s) => (s && s.userId === p.userId ? { ...s, ...p } : s))
  }
  function applyDelete(id: string) {
    setUsers((us) => (us ? us.filter((u) => u.userId !== id) : us))
    setSel(null)
  }

  const filtered = useMemo(() => {
    const list = users ?? []
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter((u) =>
      nameOf(u).toLowerCase().includes(s) ||
      (u.username ?? '').toLowerCase().includes(s) || u.userId.includes(s))
  }, [users, q])

  if (sel) {
    return <MemberCard key={sel.userId} user={sel} catalog={catalog}
      onBack={() => setSel(null)} onUpdate={applyUpdate} onDelete={applyDelete} onLevelsChange={onLevelsChange} />
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Участники</h1>
          <div className="page-sub">CRM резидентов клуба · {users?.length ?? 0}</div>
        </div>
        <button className="btn btn-gold" onClick={() => setAdding(true)}>+ Добавить участника</button>
      </div>

      <input className="input search" placeholder="Поиск по имени, @нику, id" value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <div className="err">{err}</div>}

      <div className="table">
        <div className="tr th">
          <span className="td-name">Участник</span>
          <span className="td-col">Достижения</span>
          <span className="td-col">Прогресс</span>
          <span className="td-col">Доступ</span>
        </div>
        {users === null && <div className="td-empty">Загрузка…</div>}
        {users && filtered.length === 0 && <div className="td-empty">Ничего не найдено</div>}
        {filtered.map((u) => (
          <div key={u.userId} className="tr row" role="button" tabIndex={0}
            onClick={() => setSel(u)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSel(u)}>
            <span className="td-name">
              <Avatar p={u} />
              <span className="td-name-txt">
                <span className="td-name-1">{nameOf(u)}{u.createdBy === 'admin' && <span className="tag-manual">ручной</span>}</span>
                <span className="td-name-2">{u.username ? `@${u.username}` : `id ${u.userId}`}</span>
              </span>
            </span>
            <span className="td-col"><b className="gold">★ {computeStars(u, catalog?.achievements ?? [])}</b></span>
            <span className="td-col">{u.unlock?.current ?? 0}/12</span>
            <span className="td-col">
              {u.access?.active === false
                ? <span className="badge red">истёк</span>
                : u.accessUntil
                  ? <span className="badge">до {dateToInput(u.accessUntil)}</span>
                  : <span className="badge green">активен</span>}
            </span>
          </div>
        ))}
      </div>

      {adding && <AddModal onClose={() => setAdding(false)} onCreated={(p) => { setAdding(false); load(); setSel(p) }} />}
    </div>
  )
}

// ── Модалка «добавить участника» ──────────────────────────────────────────────
function AddModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Profile) => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [userId, setUserId] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true); setErr('')
    try { onCreated(await createMember({ firstName, lastName, userId: userId.trim() || undefined })) }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-t">Новый участник</div>
        <div className="field"><label>Имя</label><input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus /></div>
        <div className="field"><label>Фамилия</label><input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
        <div className="field">
          <label>Telegram ID <span className="hint-inline">(необязательно — если знаешь, профиль свяжется при входе)</span></label>
          <input className="input" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="напр. 123456789" />
        </div>
        {err && <div className="err">{err}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-gold" disabled={busy || (!firstName && !lastName)} onClick={submit}>{busy ? 'Создаю…' : 'Создать'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Карточка участника ────────────────────────────────────────────────────────
const FIELDS: { key: keyof Profile; label: string; type?: 'textarea' | 'date' }[] = [
  { key: 'firstName', label: 'Имя' },
  { key: 'lastName', label: 'Фамилия' },
  { key: 'email', label: 'Почта' },
  { key: 'city', label: 'Город' },
  { key: 'birthDate', label: 'Дата рождения', type: 'date' },
  { key: 'about', label: 'О себе', type: 'textarea' },
  { key: 'maritalStatus', label: 'Семейное положение' },
  { key: 'occupation', label: 'Род деятельности' },
  { key: 'strengths', label: 'Сильные стороны', type: 'textarea' },
  { key: 'weaknesses', label: 'Слабые стороны', type: 'textarea' },
  { key: 'canHelp', label: 'Чем полезен / навыки', type: 'textarea' },
]
const SOCIALS: { key: keyof NonNullable<Profile['social']>; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'web', label: 'Веб-сайт' },
]

function MemberCard({ user, catalog, onBack, onUpdate, onDelete, onLevelsChange }: {
  user: Profile; catalog: Catalog | null
  onBack: () => void; onUpdate: (p: Profile) => void; onDelete: (id: string) => void
  onLevelsChange?: (levels: string[]) => void
}) {
  const [form, setForm] = useState<Profile>({ ...user })
  const [month, setMonth] = useState<number>(user.unlock?.current ?? 0)
  // Достижения (money) и прогресс ролей по тирам разнесены. Legacy: role-id,
  // лежавший в achievements[], поднимаем в roleTiers как Тир 5.
  const roleIdSet = new Set((catalog?.achievements ?? []).filter((a) => a.group === 'role').map((a) => a.id))
  const [ach, setAch] = useState<Set<string>>(() =>
    new Set((user.achievements ?? []).filter((id) => !roleIdSet.has(id))))
  const [roleTiers, setRoleTiers] = useState<Record<string, number>>(() => {
    const rt: Record<string, number> = { ...(user.roleTiers ?? {}) }
    for (const id of user.achievements ?? []) if (roleIdSet.has(id) && !rt[id]) rt[id] = TIER_MAX
    return rt
  })
  const [access, setAccess] = useState<string>(dateToInput(user.accessUntil))
  const [grants, setGrants] = useState<string[]>(user.grants ?? [])
  const [period, setPeriod] = useState<Profile['billingPeriod'] | ''>(user.billingPeriod ?? '')
  // Названия уровней (статусов) по месяцам — ОБЩИЕ для всех участников.
  const [levels, setLevels] = useState<string[]>(catalog?.levels ?? [])
  const [levelsDirty, setLevelsDirty] = useState(false)
  const [savingLevels, setSavingLevels] = useState(false)
  const [resCatalog, setResCatalog] = useState<string[]>([])
  const [grantPick, setGrantPick] = useState('')
  const [newRes, setNewRes] = useState('')
  const [perks, setPerks] = useState<Perk[]>([])
  const [msg, setMsg] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const cat = catalog?.achievements ?? []
  // Перки витрины клуба — доступ по звёздам. Звёзды участника = число достижений.
  useEffect(() => { getShowcase().then(setPerks).catch(() => setPerks([])) }, [])
  useEffect(() => { getResources().then(setResCatalog).catch(() => setResCatalog([])) }, [])
  const roles = cat.filter((a) => a.group === 'role')
  const stars = computeStars({ achievements: Array.from(ach), roleTiers }, cat)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setSocial = (k: keyof NonNullable<Profile['social']>, v: string) =>
    setForm((f) => ({ ...f, social: { ...f.social, [k]: v } }))
  const flash = (t: string) => setMsg(t)

  async function saveProfile() {
    try {
      const patch: Record<string, unknown> = { social: form.social ?? {}, allowMessages: form.allowMessages !== false, showProfile: form.showProfile !== false }
      for (const f of FIELDS) patch[f.key] = form[f.key] ?? ''
      onUpdate(await updateProfile(user.userId, patch)); flash('Профиль сохранён ✓')
    } catch { flash('Ошибка сохранения профиля') }
  }
  // Кол-во уровней = длине списка названий (минимум 1 для установки месяца).
  const totalLevels = Math.max(1, levels.length)
  function editLevel(i: number, name: string) { setLevels((ls) => ls.map((l, j) => (j === i ? name : l))); setLevelsDirty(true) }
  function addLevel() { setLevels((ls) => [...ls, `Уровень ${ls.length + 1}`]); setLevelsDirty(true) }
  function removeLevel(i: number) { setLevels((ls) => ls.filter((_, j) => j !== i)); setLevelsDirty(true) }
  async function saveLevelNames() {
    const clean = levels.map((l) => l.trim()).filter(Boolean)
    if (!clean.length) { flash('Нужен хотя бы один уровень'); return }
    setSavingLevels(true)
    try {
      const saved = await saveLevels(clean)
      setLevels(saved); setLevelsDirty(false); onLevelsChange?.(saved)
      if (month > saved.length) setMonth(saved.length)
      flash('Уровни сохранены ✓ — общие для всех участников')
    } catch { flash('Ошибка сохранения уровней') } finally { setSavingLevels(false) }
  }
  async function saveMonth() {
    try { onUpdate(await updateProfile(user.userId, { setMonth: month })); flash(`Открыто месяцев: ${month} ✓`) } catch { flash('Ошибка') }
  }
  async function saveAccess(clear = false) {
    const accessUntil = clear || !access ? null : Date.parse(`${access}T23:59:59`)
    try { const p = await updateProfile(user.userId, { accessUntil, billingPeriod: period || null }); setAccess(dateToInput(p.accessUntil)); onUpdate(p); flash(clear ? 'Доступ бессрочный ✓' : 'Срок доступа обновлён ✓') }
    catch { flash('Ошибка') }
  }
  async function saveAch() {
    // achievements — только money-id; прогресс ролей отдельно в roleTiers.
    try { onUpdate(await updateProfile(user.userId, { achievements: Array.from(ach), roleTiers })); flash('Достижения сохранены ✓') } catch { flash('Ошибка') }
  }
  function setRoleTier(id: string, tier: number) {
    setRoleTiers((r) => ({ ...r, [id]: Math.max(0, Math.min(TIER_MAX, tier)) }))
  }
  async function saveGrants(next: string[]) {
    setGrants(next)
    try { onUpdate(await updateProfile(user.userId, { grants: next })) } catch { flash('Ошибка доступов') }
  }
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try { const avatar = await fileToAvatar(file); const p = await updateProfile(user.userId, { avatar }); set('avatar', avatar); onUpdate(p); flash('Фото обновлено ✓') }
    catch { flash('Ошибка загрузки фото') }
  }
  async function remove() {
    try { await deleteProfile(user.userId); onDelete(user.userId) } catch { flash('Ошибка удаления') }
  }
  function toggle(id: string) { setAch((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  // Выдать выбранный из каталога ресурс участнику.
  function grantResource() { const v = grantPick.trim(); if (v && !grants.includes(v)) saveGrants([...grants, v]); setGrantPick('') }
  // Управление каталогом ресурсов (общий список, из которого выбираем).
  async function addToCatalog() {
    const v = newRes.trim(); if (!v || resCatalog.includes(v)) { setNewRes(''); return }
    const next = [...resCatalog, v]; setResCatalog(next); setNewRes('')
    try { setResCatalog(await saveResources(next)) } catch { flash('Ошибка списка ресурсов') }
  }
  async function removeFromCatalog(name: string) {
    const next = resCatalog.filter((x) => x !== name); setResCatalog(next)
    try { await saveResources(next) } catch { flash('Ошибка списка ресурсов') }
  }

  return (
    <div className="page">
      <button className="back" onClick={onBack}>‹ К списку участников</button>

      <div className="card-hero">
        <div className="hero-ava" onClick={() => fileRef.current?.click()} title="Загрузить фото">
          <Avatar p={form} size={72} />
          <span className="hero-cam">📷</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
        <div>
          <div className="hero-name">{nameOf(form)}</div>
          <div className="hero-sub">{form.username ? `@${form.username} · ` : ''}id {user.userId}{user.createdBy === 'admin' ? ' · ручной' : ''}</div>
        </div>
      </div>
      {msg && <div className="msg">{msg}</div>}

      {/* Профиль */}
      <div className="card">
        <div className="card-t">Профиль</div>
        <div className="grid2">
          {FIELDS.map((f) => (
            <div className={`field${f.type === 'textarea' ? ' full' : ''}`} key={f.key}>
              <label>{f.label}</label>
              {f.type === 'textarea'
                ? <textarea className="input" rows={2} value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value as never)} />
                : <input className="input" type={f.type === 'date' ? 'date' : 'text'} value={String(form[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value as never)} />}
            </div>
          ))}
          {SOCIALS.map((s) => (
            <div className="field" key={s.key}>
              <label>{s.label}</label>
              <input className="input" value={form.social?.[s.key] ?? ''} onChange={(e) => setSocial(s.key, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="toggles">
          <label className="switch"><input type="checkbox" checked={form.allowMessages !== false} onChange={(e) => set('allowMessages', e.target.checked)} /><span /> Разрешить писать сообщения</label>
          <label className="switch"><input type="checkbox" checked={form.showProfile !== false} onChange={(e) => set('showProfile', e.target.checked)} /><span /> Показывать профиль в сообществе</label>
        </div>
        <button className="btn btn-gold wide" onClick={saveProfile}>Сохранить профиль</button>
      </div>

      {/* Прогресс разблокировки + названия уровней (общие) */}
      <div className="card">
        <div className="card-t">Прогресс разблокировки <span className="gold">{month}/{totalLevels}</span></div>
        <div className="hint">Растёт автоматически по месяцам с активации. Ниже — ручная установка месяца и названия статусов (ОБЩИЕ для всех участников).</div>
        <div className="row">
          <input className="input num" type="number" min={0} max={totalLevels}
            value={month} onChange={(e) => setMonth(Math.max(0, Math.min(totalLevels, Number(e.target.value))))} />
          <button className="btn btn-gold" onClick={saveMonth}>Установить месяц</button>
          {month > 0 && levels[month - 1] && <span className="lvl-now">Сейчас: <b className="gold">{levels[month - 1]}</b></span>}
        </div>

        <div className="lvl-head">Месяцы и статусы</div>
        <div className="lvl-list">
          {levels.map((name, i) => (
            <div className={`lvl-row${i + 1 === month ? ' now' : ''}`} key={i}>
              <span className="lvl-num">{i + 1}</span>
              <input className="input" value={name} placeholder={`Статус ${i + 1} месяца`}
                onChange={(e) => editLevel(i, e.target.value)} />
              <button className="lvl-x" title="Удалить месяц" onClick={() => removeLevel(i)}>×</button>
            </div>
          ))}
          {levels.length === 0 && <div className="hint">Уровней пока нет — добавь первый.</div>}
        </div>
        <div className="row">
          <button className="btn btn-ghost sm" onClick={addLevel}>+ Добавить месяц</button>
          <button className="btn btn-gold sm" disabled={!levelsDirty || savingLevels} onClick={saveLevelNames}>
            {savingLevels ? 'Сохраняю…' : 'Сохранить уровни'}
          </button>
        </div>
      </div>

      {/* Срок доступа */}
      <div className="card">
        <div className="card-t">Срок доступа / платёж</div>
        <div className="hint">Дата = следующий платёж; по истечении вход закрывается. Пусто = бессрочно.</div>
        <div className="row">
          <input className="input" type="date" value={access} onChange={(e) => setAccess(e.target.value)} />
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as Profile['billingPeriod'] | '')}>
            <option value="">Период —</option>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button className="btn btn-gold" onClick={() => saveAccess(false)}>Сохранить</button>
        </div>
        <div className="row">
          <button className="btn btn-ghost sm" onClick={() => saveAccess(true)}>Сделать бессрочным</button>
          {user.access?.active === false
            ? <span className="badge red">доступ истёк</span>
            : user.accessUntil
              ? <span className="badge green">активен до {dateToInput(user.accessUntil)}</span>
              : <span className="badge green">♾ бессрочно</span>}
        </div>
      </div>

      {/* Достижения + роли */}
      <div className="card">
        <div className="card-t">Достижения и роли <span className="gold">★ {stars}/{cat.length}</span></div>
        <div className="hint">Звёзды = полученные достижения + роли, доведённые до Тира 5.</div>

        <div className="ach-group-t">За деньги / трейдинг · каждое = ★</div>
        <div className="ach-grid">
          {cat.filter((a) => a.group === 'money').map((a) => (
            <button key={a.id} className={`ach${ach.has(a.id) ? ' on' : ''}`} onClick={() => toggle(a.id)}>
              <span className="ach-i">{a.icon}</span><span className="ach-t">{a.title}</span>
            </button>
          ))}
        </div>

        <div className="ach-group-t">Роли в клубе · Тир 5 = ★</div>
        <div className="role-list">
          {roles.map((a) => {
            const tier = Math.max(0, Math.min(TIER_MAX, roleTiers[a.id] ?? 0))
            return (
              <div className={`role-row${tier >= TIER_MAX ? ' maxed' : ''}`} key={a.id}>
                <span className="role-i">{a.icon}</span>
                <span className="role-t">{a.title}</span>
                <div className="role-tiers">
                  {Array.from({ length: TIER_MAX + 1 }, (_, t) => (
                    <button
                      key={t}
                      className={`role-tier${tier === t ? ' sel' : ''}${t > 0 && t <= tier ? ' fill' : ''}`}
                      onClick={() => setRoleTier(a.id, t)}
                      title={t === 0 ? 'Нет' : `Тир ${t}`}
                    >{t}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <button className="btn btn-gold wide" onClick={saveAch}>Сохранить достижения и роли</button>
      </div>

      {/* Доступ к ресурсам */}
      <div className="card">
        <div className="card-t">Доступ к ресурсам <span className="gold">★ {stars}</span></div>

        {/* По звёздам — из витрины клуба */}
        <div className="hint">Открывается автоматически по звёздам (достижениям). Витрина редактируется в разделе «Витрина клуба».</div>
        <div className="grants-perks">
          {perks.length === 0 && <span className="hint">Витрина пуста — добавь перки в разделе «Витрина клуба».</span>}
          {[...perks].sort((a, b) => a.stars - b.stars).map((p, i) => {
            const open = stars >= p.stars
            return (
              <div className={`perk-access${open ? ' open' : ''}`} key={i}>
                <span className="perk-access-i">{p.icon}</span>
                <span className="perk-access-t">{p.title}</span>
                <span className={`perk-access-s${open ? ' ok' : ''}`}>{open ? 'открыт ✓' : `нужно ${p.stars}★`}</span>
              </div>
            )
          })}
        </div>

        {/* Ручные доступы — выбор из списка ресурсов */}
        <div className="hint" style={{ marginTop: 14 }}>Ручные доступы поверх уровней — выбери из списка.</div>
        <div className="tags">
          {grants.map((g) => (
            <span className="tag" key={g}>{g}<button className="tag-x" onClick={() => saveGrants(grants.filter((x) => x !== g))}>×</button></span>
          ))}
          {grants.length === 0 && <span className="hint">Пока нет ручных доступов.</span>}
        </div>
        <div className="row">
          <select className="input" value={grantPick} onChange={(e) => setGrantPick(e.target.value)}>
            <option value="">Выбери ресурс…</option>
            {resCatalog.filter((r) => !grants.includes(r)).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="btn btn-ghost" disabled={!grantPick} onClick={grantResource}>Выдать</button>
        </div>

        {/* Управление списком ресурсов (общий каталог) */}
        <details className="res-manage">
          <summary>Управлять списком ресурсов</summary>
          <div className="tags" style={{ marginTop: 8 }}>
            {resCatalog.map((r) => (
              <span className="tag" key={r}>{r}<button className="tag-x" onClick={() => removeFromCatalog(r)}>×</button></span>
            ))}
          </div>
          <div className="row">
            <input className="input" placeholder="Новый ресурс в список" value={newRes}
              onChange={(e) => setNewRes(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addToCatalog()} />
            <button className="btn btn-ghost" onClick={addToCatalog}>+ В список</button>
          </div>
        </details>
      </div>

      {/* Управление */}
      <div className="card">
        <div className="card-t">Управление</div>
        {!confirmDel
          ? <button className="btn btn-danger" onClick={() => setConfirmDel(true)}>Удалить участника</button>
          : <div className="row"><span className="confirm">Удалить безвозвратно?</span>
              <button className="btn btn-danger sm" onClick={remove}>Да, удалить</button>
              <button className="btn btn-ghost sm" onClick={() => setConfirmDel(false)}>Отмена</button></div>}
      </div>
    </div>
  )
}
