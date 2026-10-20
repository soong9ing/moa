import { CATEGORY_COLOR, Disclaimer } from '../components/visuals'
import { Icon } from '../lib/icons'
import { Link } from '../lib/router'
import { DEFAULT_SCORE_TABLE, SCORE_KEYS, ruleMax, tableTotal } from '../matching'
import { useApp } from '../store/AppStore'

/** 점수 안내 — 추천이 어떻게 계산되는지 한 화면에서 설명해요 */
export function Guide() {
  const { user, profile } = useApp()
  const cta = user ? (profile ? '/feed' : '/profile') : '/login'

  return (
    <div className="page guide">
      <div className="page-head">
        <div>
          <p className="eyebrow">점수 안내</p>
          <h1>Moa는 이렇게 추천해요</h1>
          <p className="sub">모든 추천은 아래 점수표 하나로만 계산돼요. 누가 왜 1위인지 항목별 점수로 확인할 수 있어요.</p>
        </div>
      </div>

      <section className="guide-section">
        <h2>추천은 세 단계로 이뤄져요</h2>
        <ol className="steps">
          <li>
            <span className="step-n">1</span>
            <h3>취향 모으기</h3>
            <p>성격·취미·음악·여행 취향과 찾는 상대 조건을 골라요. 고르지 않은 항목은 점수에도 필터에도 쓰지 않아요.</p>
          </li>
          <li>
            <span className="step-n">2</span>
            <h3>필수 조건 거르기</h3>
            <p>"필수"로 켠 조건에 맞지 않는 사람은 먼저 빠져요. 누가 왜 빠졌는지 추천 화면에서 그대로 보여 줘요.</p>
          </li>
          <li>
            <span className="step-n">3</span>
            <h3>점수로 비교하기</h3>
            <p>남은 사람을 점수표로 계산해 높은 순서로 정렬해요. 1위가 된 이유도 숫자로 설명해요.</p>
          </li>
        </ol>
      </section>

      <section className="table-preview">
        <div className="tp-head">
          <h2>Moa 점수표</h2>
          <p>총 {tableTotal()}점</p>
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
      </section>

      <section className="guide-grid">
        <article className="card guide-card">
          <h3>
            <Icon name="filter" size={18} /> 필수 조건과 선호는 달라요
          </h3>
          <p>
            <b>필수</b>를 켠 조건은 맞지 않는 사람을 추천에서 <b>빼기만</b> 하고 점수는 올려 주지 않아요. 점수는 "찾는 상대"의 <b>선호 나이, 선호 종교, 바라는 스타일</b>을 골라야 들어가요.
          </p>
        </article>
        <article className="card guide-card">
          <h3>
            <Icon name="sparkle" size={18} /> 점수를 높이려면
          </h3>
          <p>
            선호 나이(15점), 선호 종교(6점), 바라는 스타일(5점)을 채우면 받을 수 있는 점수가 26점 늘어나요. 성격·취미·음악을 여러 개 고를수록 겹칠 기회도 많아져요.
          </p>
        </article>
        <article className="card guide-card">
          <h3>
            <Icon name="trophy" size={18} /> 점수가 같으면
          </h3>
          <p>총점이 높은 순 → 공통 취미가 많은 순 → 닉네임 가나다순으로 정렬해요.</p>
        </article>
      </section>

      <Disclaimer />

      <div className="guide-cta">
        <Link to={cta} className="btn btn-primary">
          {user ? (profile ? '추천 보러 가기' : '내 취향 모으기') : '시작하기'} <Icon name="chevron" size={18} />
        </Link>
      </div>
    </div>
  )
}
