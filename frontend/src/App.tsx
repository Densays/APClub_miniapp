import { useEffect, useRef, useState } from 'react'
import { recordLaunch, getMyProfile, type ProfileData } from './api'
import Register from './screens/Register'
import Home from './screens/Home'
import Profile from './screens/Profile'
import EditProfile from './screens/EditProfile'
import Community from './screens/Community'
import MemberProfile from './screens/MemberProfile'
import Achievements from './screens/Achievements'
import Leaderboard from './screens/Leaderboard'
import Buddy from './screens/Buddy'
import Showcase from './screens/Showcase'
import Admin from './screens/Admin'
import BottomNav from './components/BottomNav'

type Screen = 'home' | 'profile' | 'edit' | 'community' | 'member' | 'achievements' | 'leaderboard' | 'buddy' | 'showcase' | 'admin'

export default function App() {
  const [tab, setTab] = useState('home')
  const [screen, setScreen] = useState<Screen>('home')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [memberBack, setMemberBack] = useState<Screen>('community')

  // Гейт входа: 'loading' → проверяем регистрацию; 'register' → онбординг; 'ready' → приложение.
  const [gate, setGate] = useState<'loading' | 'register' | 'ready'>('loading')
  const [initProfile, setInitProfile] = useState<ProfileData | null>(null)

  // Один запуск на загрузку приложения (guard от двойного вызова в StrictMode).
  const launched = useRef(false)
  useEffect(() => {
    if (launched.current) return
    launched.current = true
    recordLaunch()
    getMyProfile()
      .then(({ profile, registered }) => {
        setInitProfile(profile)
        setGate(registered ? 'ready' : 'register')
      })
      .catch(() => setGate('ready')) // при сбое не запираем вход
  }, [])

  const openMember = (id: string, from: Screen) => {
    setMemberId(id)
    setMemberBack(from)
    setScreen('member')
  }

  function renderScreen() {
    if (screen === 'edit') {
      return (
        <EditProfile
          onBack={() => setScreen('profile')}
          onSaved={() => setScreen('profile')}
        />
      )
    }
    if (screen === 'achievements') {
      return <Achievements onBack={() => setScreen('profile')} />
    }
    if (screen === 'leaderboard') {
      return (
        <Leaderboard
          onBack={() => setScreen('profile')}
          onOpenMember={(id) => openMember(id, 'leaderboard')}
        />
      )
    }
    if (screen === 'buddy') {
      return (
        <Buddy
          onBack={() => setScreen('home')}
          onOpenMember={(id) => openMember(id, 'buddy')}
        />
      )
    }
    if (screen === 'showcase') {
      return <Showcase onBack={() => setScreen('profile')} />
    }
    if (screen === 'admin') {
      return <Admin onBack={() => setScreen('profile')} />
    }
    if (screen === 'profile') {
      return (
        <Profile
          onBack={() => setScreen('home')}
          onEdit={() => setScreen('edit')}
          onOpenAchievements={() => setScreen('achievements')}
          onOpenLeaderboard={() => setScreen('leaderboard')}
          onOpenShowcase={() => setScreen('showcase')}
          onOpenAdmin={() => setScreen('admin')}
        />
      )
    }
    if (screen === 'member' && memberId) {
      return <MemberProfile userId={memberId} onBack={() => setScreen(memberBack)} />
    }
    if (screen === 'community') {
      return (
        <Community
          onOpenMember={(id) => openMember(id, 'community')}
        />
      )
    }
    return (
      <Home
        onOpenOnboarding={() => { window.location.href = '/onboarding.html' }}
        onOpenProfile={() => setScreen('profile')}
        onOpenBuddy={() => setScreen('buddy')}
      />
    )
  }

  if (gate === 'loading') {
    return <div className="app-gate-loading">Загрузка…</div>
  }
  if (gate === 'register') {
    return <Register initial={initProfile} onDone={() => setGate('ready')} />
  }

  return (
    <>
      {renderScreen()}
      <BottomNav
        active={tab}
        onSelect={(id) => {
          setTab(id)
          setScreen(id === 'community' ? 'community' : 'home')
        }}
      />
    </>
  )
}
