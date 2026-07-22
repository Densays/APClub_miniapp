import { useRef, useState } from 'react'
import './RichTextEditor.css'

// Мини-редактор Telegram-разметки (HTML-подмножество, которое понимает Bot API
// с parse_mode=HTML): жирный/курсив/цитата/моноширинный/ссылка + вставка эмодзи.
// Никакого contentEditable — просто textarea, куда тулбар оборачивает/вставляет
// теги вокруг выделения. Это даёт ровно ту разметку, которую примет Telegram,
// без риска конвертации из «браузерного» HTML.

const EMOJI = [
  '🎉', '🚀', '🔥', '✨', '👋', '🙏', '😊', '❤️', '👍', '🎯',
  '💎', '⚡', '🔔', '📣', '💬', '🔑', '📈', '💰', '🏆', '🎁',
  '📅', '⏰', '✅', '❌', '⭐', '🎓', '🧠', '🤝', '📸', '🎥',
  '🎙️', '📝', '🌟', '💡', '📌', '👏', '💪', '🥳', '😉', '☕',
]

export default function RichTextEditor({ value, onChange, rows = 3, placeholder }: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const savedSel = useRef<{ start: number; end: number } | null>(null)
  const [showLink, setShowLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [preview, setPreview] = useState(false)

  // Оборачивает выделение (или плейсхолдер, если ничего не выделено) тегами и
  // сразу выделяет вставленный кусок — можно печатать поверх без лишних кликов.
  function wrap(before: string, after: string, placeholderText = 'текст') {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const selected = value.slice(start, end) || placeholderText
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
    const caretStart = start + before.length
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caretStart, caretStart + selected.length) })
  }

  function insertAtCursor(text: string) {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    const pos = start + text.length
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(pos, pos) })
  }

  function openLink() {
    const ta = taRef.current
    if (ta) savedSel.current = { start: ta.selectionStart, end: ta.selectionEnd }
    setLinkUrl(''); setShowEmoji(false); setShowLink(true)
  }

  function confirmLink() {
    const url = linkUrl.trim()
    if (!url) { setShowLink(false); return }
    const ta = taRef.current
    const sel = savedSel.current
    if (ta && sel) ta.setSelectionRange(sel.start, sel.end)
    wrap(`<a href="${url}">`, '</a>', 'ссылка')
    setShowLink(false)
  }

  return (
    <div className="rte">
      <div className="rte-toolbar">
        <button type="button" className="rte-btn" title="Жирный" onClick={() => wrap('<b>', '</b>')}><b>Ж</b></button>
        <button type="button" className="rte-btn" title="Курсив" onClick={() => wrap('<i>', '</i>')}><i>К</i></button>
        <button type="button" className="rte-btn" title="Цитата" onClick={() => wrap('<blockquote>', '</blockquote>', 'цитата')}>❝</button>
        <button type="button" className="rte-btn rte-mono" title="Моноширинный" onClick={() => wrap('<code>', '</code>', 'код')}>{'</>'}</button>
        <button type="button" className={`rte-btn${showLink ? ' active' : ''}`} title="Ссылка" onClick={() => (showLink ? setShowLink(false) : openLink())}>🔗</button>
        <div className="rte-pop-wrap">
          <button type="button" className={`rte-btn${showEmoji ? ' active' : ''}`} title="Эмодзи" onClick={() => { setShowLink(false); setShowEmoji((s) => !s) }}>🙂</button>
          {showEmoji && (
            <div className="rte-emoji-pop">
              {EMOJI.map((e) => (
                <button type="button" key={e} className="rte-emoji-item" onClick={() => { insertAtCursor(e); setShowEmoji(false) }}>{e}</button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className={`rte-btn rte-preview-btn${preview ? ' active' : ''}`} title="Превью" onClick={() => setPreview((p) => !p)}>👁</button>
      </div>

      {showLink && (
        <div className="rte-linkbar">
          <input
            className="input" autoFocus placeholder="https://…" value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); confirmLink() }
              if (e.key === 'Escape') setShowLink(false)
            }}
          />
          <button type="button" className="btn sm btn-gold" onClick={confirmLink}>Вставить</button>
          <button type="button" className="btn sm btn-ghost" onClick={() => setShowLink(false)}>Отмена</button>
        </div>
      )}

      {preview ? (
        <div className="input nf-tpl rte-preview" dangerouslySetInnerHTML={{ __html: value || '<span class="dim">Пусто</span>' }} />
      ) : (
        <textarea
          ref={taRef} className="input nf-tpl" rows={rows} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        />
      )}
    </div>
  )
}
