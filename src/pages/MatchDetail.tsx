import { FILTER_LABEL, RELAX } from '../components/FilterPanels'
import { ScoreBreakdown } from '../components/ScoreBreakdown'
import { Avatar, Chip, Disclaimer, EmptyState, KindBadge, ScoreRing } from '../components/visuals'
import { findMockProfile } from '../data/mockProfiles'
import { Icon } from '../lib/icons'
import { Link, navigate } from '../lib/router'
import { explainTop } from '../matching'
import { useApp } from '../store/AppStore'
import type { Profile } from '../types'

function compare(mine: readonly string[], theirs: readonly string[]) {
  return theirs.map((t) => ({ value: t, match: mine.includes(t) }))
}

export function MatchDetail({ id }: { id: string }) {
  const { profile: me, recommendation: rec, likes, toggleLike, startChat, notify, updatePrefs } = useApp()
  const p = findMockProfile(id)

  if (!p) {
    return (
      <div className="page">
        <EmptyState icon="alert" title="프로필을 찾을 수 없어요" action={<Link to="/feed" className="btn btn-primary">추천으로 돌아가기</Link>} />
      </div>
    )
  }
  if (!me || !rec) {
    return (
      <div className="page">
        <EmptyState icon="user" title="궁합을 보려면 내 프로필이 필요해요" action={<Link to="/profile" className="btn btn-primary">프로필 등록하기</Link>} />
      </div>
    )
  }

  const ranked = rec.ranked.find((r) => r.profile.id === id)
  const excluded = rec.excluded.find((e) => e.profile.id === id)
  const liked = likes.includes(id)
  const isTop = rec.top?.profile.id === id

  return (
    <div className="page detail">
      <button type="button" className="back-link" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/feed'))}>
        <Icon name="back" size={18} /> 뒤로
      </button>

      <section className="card detail-head">
        <div className="dh-person">
          <Avatar profile={p} size={104} />
          <div>
            <div className="dh-name">
              <h1>{p.nickname}</h1>
              <KindBadge kind={p.kind} />
              {ranked && <span className={`rank-pill${isTop ? ' is-top' : ''}`}>{isTop ? '1위 추천' : `${ranked.rank}위`}</span>}
            </div>
            <p className="muted">
              {p.age}세 · {p.height}cm{p.gender ? ` · ${p.gender}` : ''}
            </p>
            {p.tagline && <p className="dh-tag">“{p.tagline}”</p>}
            <p className="dh-bio">{p.bio}</p>
          </div>
        </div>
        <div className="dh-actions">
          <button
            type="button"
            className={`btn ${liked ? 'btn-ghost is-liked' : 'btn-primary'}`}
            aria-pressed={liked}
            onClick={() => {
              toggleLike(id)
              notify(liked ? '좋아요를 취소했어요' : `${p.nickname}님을 좋아요 목록에 담았어요`)
            }}
          >
            <Icon name={liked ? 'heartFill' : 'heart'} size={18} /> {liked ? '좋아요함' : '좋아요'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              startChat(id)
              navigate(`/chats/${id}`)
            }}
          >
            <Icon name="chat" size={18} /> 데모 대화
          </button>
        </div>
      </section>

      {excluded ? (
        <section className="card excluded-detail">
          <h2>
            <Icon name="filter" size={20} /> 필수 조건에서 제외된 후보예요
          </h2>
          <p className="sub">필수 조건을 통과하지 못한 후보는 점수를 계산하지 않아요. 아래 조건 때문에 빠졌어요.</p>
          <ul>
            {excluded.reasons.map((r, i) => (
              <li key={i}>
                <span>
                  <b>{FILTER_LABEL[r.key]}</b> {r.message}
                </span>
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => {
                    updatePrefs(RELAX[r.key])
                    notify(`'${FILTER_LABEL[r.key]}' 필수 조건을 풀었어요`)
                  }}
                >
                  이 조건 풀기
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : ranked ? (
        <>
          <section className="card analysis">
            <div className="an-ring">
              <ScoreRing categories={ranked.score.categories} total={ranked.score.total} tableMax={ranked.score.tableMax} size={168} stroke={16} />
              <p className="muted small">
                {rec.ranked.length}명 중 {ranked.rank}위
              </p>
            </div>
            <div className="an-table">
              <h2>항목별 궁합 점수</h2>
              <ScoreBreakdown score={ranked.score} />
            </div>
          </section>

          {isTop && (
            <section className="card why">
              <h3>
                <Icon name="sparkle" size={18} /> 왜 1위인가요?
              </h3>
              <ul>
                {explainTop(rec).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>
          )}
          {!isTop && rec.top && (
            <section className="card why is-soft">
              <h3>1위와 비교하면</h3>
              <p>
                1위 {rec.top.profile.nickname}({rec.top.score.total}점)보다 {rec.top.score.total - ranked.score.total}점 낮아요.{' '}
                {ranked.score.total === rec.top.score.total && '점수는 같지만 정렬 규칙(공통 취미 수 → 닉네임)으로 순서가 정해졌어요.'}
              </p>
            </section>
          )}
        </>
      ) : null}

      <section className="card compare">
        <h2>취향 나란히 보기</h2>
        <p className="sub">
          <Chip tone="match">겹치는 항목</Chip> 은 나와 같은 선택이에요.
        </p>
        <CompareRow label="성격" mine={me.personality} theirs={p.personality} />
        <CompareRow label="관심사" mine={me.hobbies} theirs={p.hobbies} />
        <CompareRow label="음악" mine={me.music} theirs={p.music} />
        <CompareRow label="여행" mine={me.travel ? [me.travel] : []} theirs={p.travel ? [p.travel] : []} />
        <ProfileFacts p={p} />
      </section>

      <Disclaimer />
    </div>
  )
}

function CompareRow({ label, mine, theirs }: { label: string; mine: readonly string[]; theirs: readonly string[] }) {
  return (
    <div className="cmp-row">
      <span className="cmp-label">{label}</span>
      <div className="chips-inline">
        {theirs.length === 0 && <span className="muted small">정보 없음</span>}
        {compare(mine, theirs).map((c) => (
          <Chip key={c.value} tone={c.match ? 'match' : 'neutral'}>
            {c.match && <Icon name="check" size={12} />}
            {c.value}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function ProfileFacts({ p }: { p: Profile }) {
  return (
    <dl className="facts">
      <div>
        <dt>스타일</dt>
        <dd>{p.styles.join(', ') || '—'}</dd>
      </div>
      <div>
        <dt>종교</dt>
        <dd>{p.religion ?? '밝히지 않음'}</dd>
      </div>
      <div>
        <dt>소득 구간</dt>
        <dd>{p.income ?? '비공개'}</dd>
      </div>
    </dl>
  )
}
