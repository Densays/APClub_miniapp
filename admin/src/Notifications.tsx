import { useEffect, useState } from 'react'
import {
  getNotifications, saveNotifications, sendNotification, sendCustomNotification, testNotification, fileToBanner,
  getChannelStatus, publishChannel,
  type NotifData, type NotifConfig, type NotifEventId, type NotifOccurrence, type SendReport, type CustomNotif, type ChannelStatus,
} from './api'

const EVENT_META: Record<NotifEventId, { title: string; hint: string; vars: string }> = {
  sreda:    { title: 'Онлайн-среда',   hint: 'Ср 15:00 МСК',        vars: '{time}' },
  efir:     { title: 'Эфир в клубе',   hint: 'Чт 19:00 МСК',        vars: '{time}' },
  birthday: { title: 'День рождения',  hint: 'в день ДР резидента', vars: '{name}' },
  weekplan: { title: 'План недели',    hint: 'Пн',                  vars: '—' },
  weeksum:  { title: 'Итоги недели',   hint: 'Вс',                  vars: '—' },
}
const ORDER: NotifEventId[] = ['efir', 'sreda', 'birthday', 'weekplan', 'weeksum']
const TEST_KEY = 'apclub-admin-test-chat'

type Draft = { title: string; text: string; image?: string }
const emptyDraft = (): Draft => ({ title: '', text: '', image: undefined })

export default function Notifications() {
  const [data, setData] = useState<NotifData | null>(null)
  const [cfg, setCfg] = useState<NotifConfig | null>(null)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [sending, setSending] = useState<string>('')
  const [testChat, setTestChat] = useState(() => localStorage.getItem(TEST_KEY) ?? '')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [channel, setChannel] = useState<ChannelStatus | null>(null)
  const [pubBusy, setPubBusy] = useState(false)

  async function load() {
    setErr('')
    try {
      const d = await getNotifications()
      setData(d); setCfg(d.config); setDirty(false)
    } catch (e) {
      setErr((e as Error).message === 'unauth' ? 'Сессия истекла' : 'Не удалось загрузить уведомления')
    }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { getChannelStatus().then(setChannel).catch(() => setChannel(null)) }, [])

  async function publish() {
    setPubBusy(true); setMsg(''); setErr('')
    try {
      const r = await publishChannel()
      if (r.ok && r.posted) setMsg(r.pinned ? 'Опубликовано и закреплено в канале ✓' : `Опубликовано, но не закреплено${r.error ? `: ${r.error}` : ' (нет прав на закреп)'}`)
      else setErr(channelErrText(r.error))
      getChannelStatus().then(setChannel).catch(() => {})
    } catch (e) { setErr((e as Error).message) }
    finally { setPubBusy(false) }
  }

  // Карта event id → «стенное» время (для превью {time} в тесте).
  const timeById: Record<string, string | null> = Object.fromEntries((data?.events ?? []).map((e) => [e.id, e.time]))

  function editEvent(id: NotifEventId, patch: Partial<NotifConfig['events'][NotifEventId]>) {
    setCfg((c) => (c ? { ...c, events: { ...c.events, [id]: { ...c.events[id], ...patch } } } : c))
    setDirty(true); setMsg('')
  }
  function toggleGlobal() {
    setCfg((c) => (c ? { ...c, enabled: !c.enabled } : c)); setDirty(true); setMsg('')
  }
  function setTestChatId(v: string) {
    const clean = v.replace(/[^0-9]/g, '')
    setTestChat(clean); localStorage.setItem(TEST_KEY, clean)
  }

  async function asBanner(file?: File): Promise<string | undefined> {
    if (!file) return undefined
    try { return await fileToBanner(file) } catch { setErr('Не удалось обработать картинку'); return undefined }
  }

  async function save() {
    if (!cfg) return
    try {
      const saved = await saveNotifications({ enabled: cfg.enabled, events: cfg.events, custom: cfg.custom })
      setCfg(saved); setDirty(false); setMsg('Настройки сохранены ✓')
      load()
    } catch { setErr('Ошибка сохранения') }
  }

  // Рендер шаблона события с примерными значениями — для теста «как увидит резидент».
  function renderSample(id: NotifEventId, tpl: string): string {
    const now = new Date()
    return tpl
      .replace(/\{name\}/g, 'Иван Иванов')
      .replace(/\{time\}/g, timeById[id] ?? '19:00')
      .replace(/\{date\}/g, `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}`)
  }

  async function send(o: NotifOccurrence, force: boolean) {
    const key = `${o.eventId}:${o.dateKey}`
    setSending(key); setMsg(''); setErr('')
    try { setMsg(reportText(await sendNotification(o.eventId, o.dateKey, force))); load() }
    catch (e) { setErr((e as Error).message) }
    finally { setSending('') }
  }

  async function sendAll(text: string, image: string | undefined, key: string) {
    if (!text.trim() && !image) { setErr('Пустое уведомление — добавь текст или картинку'); return }
    setSending(key); setMsg(''); setErr('')
    try { setMsg(reportText(await sendCustomNotification(text, image))) }
    catch (e) { setErr((e as Error).message) }
    finally { setSending('') }
  }

  async function doTest(text: string, image: string | undefined, key: string) {
    if (!testChat) { setErr('Укажи свой Telegram ID в поле «Тест себе» вверху'); return }
    setSending(key); setMsg(''); setErr('')
    try {
      const r = await testNotification(testChat, text, image)
      setMsg(r.ok ? `Тест отправлен на ID ${testChat} ✓` : testErrText(r.error))
    } catch (e) { setErr((e as Error).message) }
    finally { setSending('') }
  }

  // Произвольные уведомления (сохранённый список — часть cfg.custom).
  function editCustom(id: string, patch: Partial<CustomNotif>) {
    setCfg((c) => (c ? { ...c, custom: c.custom.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : c))
    setDirty(true); setMsg('')
  }
  function delCustom(id: string) {
    setCfg((c) => (c ? { ...c, custom: c.custom.filter((x) => x.id !== id) } : c)); setDirty(true)
  }
  function addFromDraft() {
    if (!draft.text.trim() && !draft.image) { setErr('Заполни текст или добавь картинку'); return }
    const item: CustomNotif = { id: `c${Date.now()}`, title: draft.title.trim(), text: draft.text.trim(), image: draft.image }
    setCfg((c) => (c ? { ...c, custom: [item, ...c.custom] } : c))
    setDraft(emptyDraft()); setDirty(true); setMsg('Добавлено в список — не забудь «Сохранить»')
  }

  if (err && !data) return <div className="page"><div className="err">{err}</div></div>
  if (!data || !cfg) return <div className="page"><div className="td-empty">Загрузка…</div></div>

  const busy = (k: string) => sending === k

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Уведомления</h1>
          <div className="page-sub">Анонсы событий клуба в бота — личным сообщением каждому резиденту</div>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={load}>Обновить</button>
          <button className="btn btn-gold" disabled={!dirty} onClick={save}>Сохранить</button>
        </div>
      </div>

      {msg && <div className="msg">{msg}</div>}
      {err && <div className="err">{err}</div>}

      {/* Статус + тест в свой Telegram */}
      <div className="card nf-status">
        <div className="nf-status-row">
          <label className="nf-switch">
            <input type="checkbox" checked={cfg.enabled} onChange={toggleGlobal} />
            <span>Уведомления {cfg.enabled ? 'включены' : 'выключены'}</span>
          </label>
          <div className="nf-badges">
            <span className="nf-badge">Получателей: <b>{data.recipients}</b></span>
            <span className={`nf-badge ${data.botReady ? 'ok' : 'warn'}`}>
              {data.botReady ? 'Бот подключён' : 'BOT_TOKEN не задан'}
            </span>
          </div>
        </div>
        <div className="nf-test">
          <label className="nf-test-lbl">Тест себе — Telegram ID:</label>
          <input
            className="input nf-test-id"
            value={testChat}
            onChange={(e) => setTestChatId(e.target.value)}
            placeholder="напр. 123456789"
            inputMode="numeric"
          />
          <span className="nf-test-hint">Кнопки «Тест» шлют сообщение на этот ID. Свой ID узнать: @userinfobot</span>
        </div>
        {!data.botReady && (
          <div className="nf-note">
            Пока не вписан <code>BOT_TOKEN</code>, отправка не идёт (авто, ручная и тест). Настройки и тексты сохраняются —
            заработают сразу после подключения бота на деплое. Резидент получит DM, только если нажал у бота «Start».
          </div>
        )}
      </div>

      {/* Приветствие в канал (закреплённый пост с кнопкой входа) */}
      <div className="card">
        <div className="card-t">Приветствие в канал <span className="dim">(закреплённый пост с кнопкой входа)</span></div>
        {!channel ? (
          <div className="td-empty">Загрузка статуса…</div>
        ) : !channel.configured ? (
          <div className="nf-note">
            Канал не настроен. Задай на сервере <code>CHANNEL_ID</code> (@username или -100…) и <code>MINIAPP_LINK</code>
            (прямая ссылка Mini App из BotFather), затем добавь бота <b>админом</b> канала с правами «Публикация» и «Закрепление».
          </div>
        ) : (
          <>
            <div className="nf-chan-grid">
              <div className="nf-chan-row"><span>Канал</span><b>{channel.title || channel.channelId}</b></div>
              <div className="nf-chan-row"><span>Бот — админ</span><span className={channel.isAdmin ? 'nf-ok' : 'nf-bad'}>{channel.isAdmin ? 'да' : 'нет'}</span></div>
              <div className="nf-chan-row"><span>Может публиковать</span><span className={channel.canPost ? 'nf-ok' : 'nf-bad'}>{channel.canPost ? 'да' : 'нет'}</span></div>
              <div className="nf-chan-row"><span>Может закреплять</span><span className={channel.canPin ? 'nf-ok' : 'nf-bad'}>{channel.canPin ? 'да' : 'нет'}</span></div>
              <div className="nf-chan-row"><span>Ссылка входа</span><span className={channel.hasLink ? 'nf-ok' : 'nf-bad'}>{channel.hasLink ? 'задана' : 'нет'}</span></div>
            </div>
            {channel.error && <div className="nf-note">⚠️ {channelErrText(channel.error)}</div>}
            <div className="nf-ev-foot" style={{ marginTop: 12 }}>
              <span className="nf-vars">Опубликует баннер + текст приветствия с кнопкой «Вход в клуб» и закрепит.</span>
              <button className="btn btn-gold" disabled={pubBusy || !channel.canPost} onClick={publish}>
                {pubBusy ? 'Публикуем…' : 'Опубликовать и закрепить'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Настройки по типам событий */}
      <div className="card">
        <div className="card-t">Типы событий</div>
        <div className="nf-events">
          {ORDER.map((id) => {
            const e = cfg.events[id]
            const meta = EVENT_META[id]
            const tkey = `test:${id}`
            return (
              <div className={`nf-ev ${e.enabled ? '' : 'off'}`} key={id}>
                <div className="nf-ev-head">
                  <label className="nf-switch sm">
                    <input type="checkbox" checked={e.enabled} onChange={(ev) => editEvent(id, { enabled: ev.target.checked })} />
                    <span className="nf-ev-title">{meta.title}</span>
                  </label>
                  <span className="nf-ev-hint">{meta.hint}</span>
                </div>
                <textarea
                  className="input nf-tpl" value={e.template} rows={2}
                  onChange={(ev) => editEvent(id, { template: ev.target.value })} placeholder="Текст анонса"
                />
                <ImageField
                  image={e.image}
                  onPick={async (f) => { const b = await asBanner(f); if (b) editEvent(id, { image: b }) }}
                  onClear={() => editEvent(id, { image: '' })}
                />
                <div className="nf-ev-foot">
                  <span className="nf-vars">Подстановки: <code>{meta.vars}</code></span>
                  <div className="nf-ev-foot-r">
                    <button className="btn sm btn-ghost" disabled={busy(tkey)}
                      onClick={() => doTest(renderSample(id, e.template), e.image, tkey)}>
                      {busy(tkey) ? 'Тест…' : 'Тест себе'}
                    </button>
                    <label className="nf-hour">
                      Авто в
                      <select className="input" value={e.sendHour} onChange={(ev) => editEvent(id, { sendHour: Number(ev.target.value) })}>
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')}:00 МСК</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Произвольное уведомление: композер + сохранённый список */}
      <div className="card">
        <div className="card-t">Произвольное уведомление <span className="dim">(разовая рассылка всем резидентам)</span></div>

        <div className="nf-ev nf-compose">
          <input
            className="input" value={draft.title} maxLength={120}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Заголовок (для себя, не отправляется)"
          />
          <textarea
            className="input nf-tpl" value={draft.text} rows={3}
            onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
            placeholder="Текст уведомления — уйдёт всем резидентам как есть"
          />
          <ImageField
            image={draft.image}
            onPick={async (f) => { const b = await asBanner(f); if (b) setDraft((d) => ({ ...d, image: b })) }}
            onClear={() => setDraft((d) => ({ ...d, image: undefined }))}
          />
          <div className="nf-ev-foot">
            <button className="nf-link" onClick={() => setDraft(emptyDraft())}>Очистить</button>
            <div className="nf-ev-foot-r">
              <button className="btn sm btn-ghost" disabled={busy('test:draft')}
                onClick={() => doTest(draft.text, draft.image, 'test:draft')}>Тест себе</button>
              <button className="btn sm btn-ghost" onClick={addFromDraft}>В список</button>
              <button className="btn sm btn-gold" disabled={busy('send:draft')}
                onClick={() => sendAll(draft.text, draft.image, 'send:draft')}>
                {busy('send:draft') ? 'Отправка…' : 'Отправить всем'}
              </button>
            </div>
          </div>
        </div>

        {cfg.custom.length > 0 && (
          <div className="nf-saved">
            <div className="nf-saved-t">Сохранённые ({cfg.custom.length})</div>
            {cfg.custom.map((c) => {
              const sk = `send:${c.id}`, tk = `test:${c.id}`
              return (
                <div className="nf-ev" key={c.id}>
                  <input className="input" value={c.title} placeholder="Заголовок (для себя)"
                    onChange={(e) => editCustom(c.id, { title: e.target.value })} />
                  <textarea className="input nf-tpl" value={c.text} rows={2}
                    onChange={(e) => editCustom(c.id, { text: e.target.value })} placeholder="Текст" />
                  <ImageField
                    image={c.image}
                    onPick={async (f) => { const b = await asBanner(f); if (b) editCustom(c.id, { image: b }) }}
                    onClear={() => editCustom(c.id, { image: undefined })}
                  />
                  <div className="nf-ev-foot">
                    <button className="nf-link danger" onClick={() => delCustom(c.id)}>Удалить</button>
                    <div className="nf-ev-foot-r">
                      <button className="btn sm btn-ghost" disabled={busy(tk)}
                        onClick={() => doTest(c.text, c.image, tk)}>Тест себе</button>
                      <button className="btn sm btn-gold" disabled={busy(sk)}
                        onClick={() => sendAll(c.text, c.image, sk)}>
                        {busy(sk) ? 'Отправка…' : 'Отправить всем'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Ближайшие события — ручная отправка (гибрид) */}
      <div className="card">
        <div className="card-t">Ближайшие 7 дней <span className="dim">(авто по расписанию · можно отправить вручную)</span></div>
        {data.upcoming.length === 0 ? (
          <div className="td-empty">На неделю событий нет.</div>
        ) : (
          <div className="nf-up">
            {data.upcoming.map((o) => {
              const key = `${o.eventId}:${o.dateKey}`
              return (
                <div className={`nf-up-row ${o.enabled ? '' : 'off'}`} key={key}>
                  <div className="nf-up-when">
                    <span className="nf-up-date">{o.dateLabel}</span>
                    <span className="nf-up-ev">{o.title}</span>
                    <span className="nf-up-hour">→ {String(o.sendHour).padStart(2, '0')}:00</span>
                  </div>
                  <div className="nf-up-msg">{o.hasImage && <span className="nf-cam" title="С картинкой">📷</span>}{o.message}</div>
                  <div className="nf-up-actions">
                    {o.sent
                      ? <span className="nf-sent">Отправлено ✓</span>
                      : <span className="dim sm">{o.enabled ? 'В очереди' : 'Выключено'}</span>}
                    <button className="btn sm btn-ghost" disabled={busy(key)} onClick={() => send(o, o.sent)}>
                      {busy(key) ? 'Отправка…' : o.sent ? 'Отправить ещё раз' : 'Отправить сейчас'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Поле картинки: превью с «Заменить/Убрать» или кнопка загрузки.
function ImageField({ image, onPick, onClear }: {
  image?: string
  onPick: (file?: File) => void
  onClear: () => void
}) {
  return (
    <div className="nf-ev-img">
      {image ? (
        <div className="nf-thumb">
          <img src={image} alt="баннер" />
          <div className="nf-thumb-actions">
            <label className="nf-link">
              Заменить
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => onPick(e.target.files?.[0])} />
            </label>
            <button className="nf-link danger" onClick={onClear}>Убрать</button>
          </div>
        </div>
      ) : (
        <label className="nf-upload">
          <span>📷 Добавить картинку (JPG, PNG…)</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
      )}
    </div>
  )
}

function reportText(r: SendReport): string {
  if (r.alreadySent) return 'Уже отправляли сегодня (нажми «Отправить ещё раз» для повтора)'
  if (r.error === 'no_token') return `BOT_TOKEN не задан — отправка не выполнена (получателей: ${r.total})`
  if (r.error === 'no_occurrence') return 'В этот день события нет'
  if (r.error === 'empty') return 'Пустое уведомление — добавь текст или картинку'
  if (!r.ok) return `Ошибка отправки${r.error ? `: ${r.error}` : ''}`
  return `Готово: доставлено ${r.delivered}, пропущено ${r.skipped}, ошибок ${r.failed} (из ${r.total})`
}

function channelErrText(error?: string): string {
  if (error === 'no_channel') return 'CHANNEL_ID не задан на сервере'
  if (error === 'no_token') return 'BOT_TOKEN не задан'
  if (/chat not found/i.test(error ?? '')) return 'Канал не найден — проверь CHANNEL_ID и что бот добавлен в канал'
  if (/not enough rights|administrator|forbidden/i.test(error ?? '')) return 'Недостаточно прав — добавь бота админом канала (публикация + закрепление)'
  return error ? `Ошибка: ${error}` : 'Ошибка канала'
}

function testErrText(error?: string): string {
  if (error === 'no_token') return 'BOT_TOKEN не задан — тест не отправлен'
  if (/chat not found|can't initiate|Forbidden|400|403/i.test(error ?? ''))
    return 'Не доставлено: проверь ID и нажми «Start» у бота'
  return `Ошибка теста${error ? `: ${error}` : ''}`
}
