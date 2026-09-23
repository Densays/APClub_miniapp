import './ArbixJournal.css'
import Header from '../components/Header'

const JOURNAL_URL = 'https://trade-journal-arbix.vercel.app/miniapp/dashboard'

export default function ArbixJournal({ onBack }: { onBack: () => void }) {
  return (
    <div className="arbix-journal">
      <Header title="Arbix Stats" onBack={onBack} />
      <div className="arbix-journal-frame">
        <iframe
          src={JOURNAL_URL}
          title="Arbix Stats"
          allow="clipboard-write"
        />
      </div>
    </div>
  )
}
