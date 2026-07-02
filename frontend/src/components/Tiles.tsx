import './Tiles.css'
import { LINKS, openLink } from '../mock'

type Tile = {
  id: string
  tag: string
  title: string
  desc: string
  cta: string
  onClick?: () => void
}

const TILES: Tile[] = [
  {
    id: 'arsenal',
    tag: 'Контент',
    title: 'Арсенал',
    desc: 'Уроки, материалы, шаблоны и доступы к сервисам — всё для роста в одном месте.',
    cta: 'Открыть арсенал',
    onClick: () => openLink(LINKS.arsenal),
  },
  {
    id: 'streams',
    tag: 'Видео',
    title: 'Записи эфиров',
    desc: 'Разборы сделок, практика и анализ возможностей с наших живых встреч.',
    cta: 'Смотреть записи',
    onClick: () => openLink(LINKS.streams),
  },
]

export default function Tiles() {
  return (
    <div className="tiles">
      {TILES.map((t) => (
        <button key={t.id} className="tile" onClick={t.onClick}>
          <span className="tile-tag">{t.tag}</span>
          <span className="tile-title">{t.title}</span>
          <span className="tile-desc">{t.desc}</span>
          <span className="tile-cta">{t.cta} <span className="tile-cta-arrow">›</span></span>
        </button>
      ))}
    </div>
  )
}
