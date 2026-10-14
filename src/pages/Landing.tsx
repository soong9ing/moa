import type { CSSProperties } from 'react'
import { Logo, DemoBadge } from '../components/Shell'
import { Avatar, Disclaimer } from '../components/visuals'
import { MOCK_PROFILES } from '../data/mockProfiles'
import { Icon } from '../lib/icons'
import { Link } from '../lib/router'
import { DEFAULT_SCORE_TABLE, SCORE_KEYS, ruleMax, tableTotal } from '../matching'
import { CATEGORY_COLOR } from '../components/visuals'
import { useApp } from '../store/AppStore'

export function Landing() {
  const { user, profile } = useApp()
  const cta = user ? (profile ? '/feed' : '/profile') : '/login'
  const orbit = MOCK_PROFILES.slice(0, 8)

  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <div className="landing-nav-right">
          <DemoBadge />
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
            성격·취미·음악·여행 취향을 고르면, Moa가 정해진 점수표로 한 명 한 명 비교해요. 왜 그 사람이 1위인지 항목별 점수까지 모두 보여 드려요.
          </p>
          <div className="hero-cta">
            <Link to={cta} className="btn btn-primary btn-lg">
              {user ? '추천 보러 가기' : '내 취향 모으기 시작'}
              <Icon name="chevron" size={18} />
            </Link>
            <a href="#how" className="btn btn-ghost btn-lg" onClick={(e) => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }) }}>
              점수는 어떻게 매겨요?
            </a>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="orbit">
            {orbit.map((p, i) => (
              <span key={p.id} className="orbit-item" style={{ '--i': i, '--n': orbit.length } as CSSProperties}>
                <Avatar profile={p} size={54} />
              </span>
            ))}
            <div className="orbit-core">
              <strong>87</strong>
              <span>취향 궁합</span>
            </div>
          </div>
          <p className="hero-art-note">그림 속 인물은 모두 가상 프로필이에요</p>
        </div>
      </section>

      <section id="how" className="how">
        <h2>세 단계로 끝나요</h2>
        <ol className="steps">
          <li>
            <span className="step-n">1</span>
            <h3>취향 모으기</h3>
            <p>성격·취미·음악·여행 취향과 찾는 상대 조건을 골라요. 고르지 않은 항목은 점수에도 필터에도 쓰지 않아요.</p>
          </li>
          <li>
            <span className="step-n">2</span>
            <h3>필수 조건 거르기</h3>
            <p>"필수"로 켠 조건에 맞지 않는 후보는 먼저 빠지고, 누가 왜 빠졌는지 그대로 보여 줘요.</p>
          </li>
          <li>
            <span className="step-n">3</span>
            <h3>점수로 비교하기</h3>
            <p>남은 후보를 아래 점수표로 계산해 높은 순서로 정렬해요. 1위가 된 이유도 숫자로 설명해요.</p>
          </li>
        </ol>
      </section>

      <section className="table-preview">
        <div className="tp-head">
          <h2>Moa 점수표</h2>
          <p>총 {tableTotal()}점 · 모든 추천이 이 표 하나로만 계산돼요</p>
        </div>
        <ul className="tp-list">
          {SCORE_KEYS.map((k) => {
            const r = DEFAULT_SCORE_TABLE[k]
            return (
              <li key={k}>
                <span className="tp-bar" style={{ width: `${ruleMax(r) * 3}%`, background: CATEGORY_COLOR[k] }} />
                <span className="tp-label">{r.label}</span>
                <span className="tp-desc">{r.description}</span>
                <b>{ruleMax(r)}점</b>
              </li>
            )
          })}
        </ul>
        <Disclaimer />
      </section>

      <footer className="landing-foot">
        <Logo small />
        <p>Moa는 개인 프로젝트 데모예요. 등장하는 {MOCK_PROFILES.length}명의 프로필은 모두 지어낸 가상 인물이고, 실제 사진을 쓰지 않았어요.</p>
      </footer>
    </div>
  )
}
