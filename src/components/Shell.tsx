import type { ReactNode } from 'react'
import { Icon, type IconName } from '../lib/icons'
import { Link, navigate } from '../lib/router'
import { BACKEND } from '../services/backend'
import { useApp } from '../store/AppStore'

const NAV: { to: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { to: '/feed', label: '추천', icon: 'compass', match: (p) => p === '/feed' || p.startsWith('/match/') },
  { to: '/likes', label: '좋아요', icon: 'heart', match: (p) => p === '/likes' },
  { to: '/chats', label: '대화', icon: 'chat', match: (p) => p.startsWith('/chats') },
  { to: '/profile', label: '내 프로필', icon: 'user', match: (p) => p === '/profile' },
]

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo${small ? ' is-small' : ''}`}>
      <svg viewBox="0 0 40 28" aria-hidden="true">
        <circle cx="13" cy="14" r="11" fill="var(--coral)" />
        <circle cx="27" cy="14" r="11" fill="var(--plum)" opacity="0.85" />
        <circle cx="20" cy="14" r="4" fill="var(--paper)" />
      </svg>
      <span className="logo-word">Moa</span>
    </span>
  )
}

export function DemoBadge() {
  return (
    <span className="demo-badge" title={BACKEND.detail}>
      <span className="demo-dot" />
      {BACKEND.label}
    </span>
  )
}

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const { user, profile, likes, chats, logOut, notify } = useApp()
  const chatCount = Object.keys(chats).length

  const handleLogout = async () => {
    await logOut()
    notify('로그아웃했어요')
    navigate('/')
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/feed" className="sidebar-logo" aria-label="Moa 추천 피드로">
          <Logo />
        </Link>
        <nav aria-label="주요 메뉴">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`nav-item${n.match(path) ? ' is-active' : ''}`} aria-current={n.match(path) ? 'page' : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.to === '/likes' && likes.length > 0 && <em className="count">{likes.length}</em>}
              {n.to === '/chats' && chatCount > 0 && <em className="count">{chatCount}</em>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <DemoBadge />
          <div className="me-mini">
            <div>
              <strong>{profile?.nickname ?? user?.nickname}</strong>
              <small>{user?.email}</small>
            </div>
            <button type="button" className="icon-btn" onClick={handleLogout} aria-label="로그아웃" title="로그아웃">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <Link to="/feed" aria-label="Moa 추천 피드로">
          <Logo small />
        </Link>
        <div className="topbar-right">
          <DemoBadge />
          <button type="button" className="icon-btn" onClick={handleLogout} aria-label="로그아웃">
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <main className="main" key={path.split('/')[1]}>
        {children}
      </main>

      <nav className="tabbar" aria-label="하단 메뉴">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className={`tab${n.match(path) ? ' is-active' : ''}`} aria-current={n.match(path) ? 'page' : undefined}>
            <span className="tab-icon">
              <Icon name={n.match(path) && n.icon === 'heart' ? 'heartFill' : n.icon} size={22} />
              {n.to === '/likes' && likes.length > 0 && <em className="dot" />}
            </span>
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function Toasts() {
  const { toasts } = useApp()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <Icon name="check" size={16} />
          {t.text}
        </div>
      ))}
    </div>
  )
}
