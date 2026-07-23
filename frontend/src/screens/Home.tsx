import './Home.css'
import Header from '../components/Header'
import UserCard from '../components/UserCard'
import Calendar from '../components/Calendar'
import Countdown from '../components/Countdown'
import { BuddyButton } from '../components/Cards'
import Tiles from '../components/Tiles'
import Community from '../components/Community'
import Arbix from '../components/Arbix'
import { getNextMeeting, LINKS, openLink } from '../mock'

export default function Home({
  onOpenOnboarding,
  onOpenProfile,
  onOpenBuddy,
}: {
  onOpenOnboarding?: () => void
  onOpenProfile?: () => void
  onOpenBuddy?: () => void
}) {
  return (
    <div className="home">
      <Header title="APClub" />

      <div className="home-body">
        <div className="home-top-row">
          <img className="home-logo" src="/logo.png" alt="AP Crypto Club" />
          <button className="onboarding-btn" onClick={onOpenOnboarding}>
            <span className="onboarding-icon">🚀</span>
            <span>ОНБОРДИНГ</span>
          </button>
        </div>

        <UserCard onClick={onOpenProfile} />

        <Calendar date={new Date()} />

        <div className="home-meeting-row">
          <Countdown to={getNextMeeting()} />
          <BuddyButton onClick={onOpenBuddy} />
        </div>

        <button className="home-review-btn" onClick={() => openLink(LINKS.razbor)}>
          🎥 Подготовиться к разбору
        </button>

        <Tiles />

        <Community onChat={() => openLink(LINKS.chat)} />

        <Arbix onClick={() => openLink(LINKS.arbix)} />
      </div>
    </div>
  )
}
