import { Logo } from '../components/Shell'
import { SolarSystem } from '../components/SolarSystem'
import { MOCK_PROFILES } from '../data/mockProfiles'
import { Icon, type IconName } from '../lib/icons'
import { Link } from '../lib/router'
import { maxAchievableScore } from '../matching'
import { useApp } from '../store/AppStore'

const HIGHLIGHTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'heart', title: '취향으로 만나요', body: '성격, 취미, 음악, 여행 스타일이 닮은 사람을 먼저 보여 드려요.' },
  { icon: 'sparkle', title: '추천 이유까지', body: '왜 이 사람인지 항목별 점수와 겹치는 취향으로 설명해요.' },
  { icon: 'chat', title: '마음에 들면 대화', body: '좋아요를 누르고 바로 대화를 시작할 수 있어요.' },
]

export function Landing() {
  const { user, profile, pool } = useApp()
  const cta = user ? (profile ? '/feed' : '/profile') : '/login'
  // 현실적으로 받을 수 있는 최고 점수 — 데이터에서 직접 계산해요 (지금은 67점)
  const bestScore = maxAchievableScore(MOCK_PROFILES)

  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <div className="landing-nav-right">
          <Link to="/guide" className="nav-link">
            점수 안내
          </Link>
          <Link to={user ? cta : '/login'} className="btn btn-ghost">
            {user ? '앱으로 가기' : '로그인'}
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">취향 기반 소개팅 · Moa</p>
          <h1>
            취향을 <span className="ink-coral">모아</span>,
            <br />
            맞는 사람을 <span className="underline">알아보다</span>
          </h1>
          <p className="lead">
            성격·취미·음악·여행 취향을 고르면, Moa가 한 명 한 명 비교해 잘 맞는 사람을 추천해요. 왜 그 사람인지 항목별 점수까지 모두 보여 드려요.
          </p>
          <div className="hero-cta">
            <Link to={cta} className="btn btn-primary btn-lg">
              {user ? '추천 보러 가기' : '내 취향 모으기 시작'}
              <Icon name="chevron" size={18} />
            </Link>
            <Link to="/guide" className="btn btn-ghost btn-lg">
              점수는 어떻게 매겨요?
            </Link>
          </div>
        </div>

        <div className="hero-art">
          <SolarSystem profiles={user ? pool : MOCK_PROFILES} me={profile} score={bestScore} />
        </div>
      </section>

      <section className="highlights">
        {HIGHLIGHTS.map((h) => (
          <article key={h.title}>
            <span className="hl-icon">
              <Icon name={h.icon} size={20} />
            </span>
            <h3>{h.title}</h3>
            <p>{h.body}</p>
          </article>
        ))}
      </section>

      <footer className="landing-foot">
        <Logo small />
        <p>Moa에서 만나는 상대 프로필은 모두 Moa가 만든 캐릭터이고, 대화는 캐릭터의 자동 답장으로 이어져요.</p>
      </footer>
    </div>
  )
}
