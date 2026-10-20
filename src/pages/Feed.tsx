import { CandidateCard } from '../components/CandidateCard'
import { ActiveFilterChips, ExcludedList, FILTER_LABEL, RELAX, ZeroCandidates } from '../components/FilterPanels'
import { Avatar, CATEGORY_COLOR, Chip, Disclaimer, EmptyState, ScoreRing } from '../components/visuals'
import { Icon } from '../lib/icons'
import { Link, navigate } from '../lib/router'
import { explainTop, type FilterKey } from '../matching'
import { useApp } from '../store/AppStore'

export function Feed() {
  const { profile, recommendation: rec, updatePrefs, notify, likes, toggleLike, startChat } = useApp()

  if (!profile || !rec) {
    return (
      <div className="page">
        <EmptyState
          icon="user"
          title="먼저 내 취향을 모아 주세요"
          action={
            <Link to="/profile" className="btn btn-primary">
              프로필 등록하기
            </Link>
          }
        >
          프로필과 찾는 상대 조건을 저장하면, Moa에 있는 사람들 중에서 잘 맞는 사람을 점수로 골라 드려요.
        </EmptyState>
      </div>
    )
  }

  const relax = (key: FilterKey) => {
    updatePrefs(RELAX[key])
    notify(`'${FILTER_LABEL[key]}' 필수 조건을 풀었어요`)
  }

  const top = rec.top
  const rest = rec.ranked.slice(1)
  const reasons = explainTop(rec)
  const liked = top ? likes.includes(top.profile.id) : false

  return (
    <div className="page feed">
      <div className="page-head">
        <div>
          <p className="eyebrow">오늘의 추천</p>
          <h1>{profile.nickname}님과 취향이 닮은 사람</h1>
          <p className="sub">
            {rec.poolSize}명 중 <b>{rec.ranked.length}명</b>이 필수 조건을 통과했어요
            {rec.excluded.length > 0 && <> · {rec.excluded.length}명 제외</>}
          </p>
        </div>
        <Link to="/profile" className="btn btn-ghost">
          <Icon name="sliders" size={18} /> 조건 수정
        </Link>
      </div>

      <div className="filter-bar">
        <ActiveFilterChips filters={rec.activeFilters} />
      </div>

      {!top ? (
        <>
          <ZeroCandidates excluded={rec.excluded} onRelax={relax} />
          <ExcludedList excluded={rec.excluded} defaultOpen onRelax={relax} />
        </>
      ) : (
        <>
          <section className="hero-pick card">
            <div className="pick-ribbon">
              <Icon name="trophy" size={16} /> 1위 추천
            </div>
            <div className="pick-grid">
              <div className="pick-person">
                <Avatar profile={top.profile} size={96} />
                <div>
                  <h2>
                    {top.profile.nickname}
                  </h2>
                  <p className="muted">
                    {top.profile.age}세 · {top.profile.height}cm{top.profile.travel ? ` · ${top.profile.travel} 여행` : ''}
                  </p>
                  <p className="pick-bio">{top.profile.bio}</p>
                  {top.commonHobbies.length > 0 && (
                    <div className="chips-inline">
                      <span className="muted small">공통 관심사</span>
                      {top.commonHobbies.map((h) => (
                        <Chip key={h} tone="match">
                          {h}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pick-score">
                <ScoreRing categories={top.score.categories} total={top.score.total} tableMax={top.score.tableMax} size={148} stroke={14} />
                <ul className="legend">
                  {top.score.categories
                    .filter((c) => c.used)
                    .map((c) => (
                      <li key={c.key} className={c.earned ? '' : 'is-zero'}>
                        <span className="bd-dot" style={{ background: CATEGORY_COLOR[c.key] }} />
                        {c.label}
                        <b>
                          {c.earned}/{c.max}
                        </b>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            <div className="why">
              <h3>
                <Icon name="sparkle" size={18} /> 왜 1위인가요?
              </h3>
              <ul>
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="pick-actions">
              <Link to={`/match/${top.profile.id}`} className="btn btn-primary">
                궁합 분석 자세히 <Icon name="chevron" size={18} />
              </Link>
              <button
                type="button"
                className={`btn btn-ghost${liked ? ' is-liked' : ''}`}
                aria-pressed={liked}
                onClick={() => {
                  toggleLike(top.profile.id)
                  notify(liked ? '좋아요를 취소했어요' : `${top.profile.nickname}님을 좋아요 목록에 담았어요`)
                }}
              >
                <Icon name={liked ? 'heartFill' : 'heart'} size={18} /> {liked ? '좋아요함' : '좋아요'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  startChat(top.profile.id)
                  navigate(`/chats/${top.profile.id}`)
                }}
              >
                <Icon name="chat" size={18} /> 대화하기
              </button>
            </div>
            <Disclaimer compact />
          </section>

          {rest.length > 0 && (
            <section className="ranked">
              <h2 className="section-title">
                이어지는 추천 <small>{rest.length}명 · 점수 높은 순</small>
              </h2>
              <div className="cand-list">
                {rest.map((item, i) => (
                  <CandidateCard key={item.profile.id} item={item} index={i} />
                ))}
              </div>
              <p className="muted small sort-note">정렬 규칙: 총점이 높은 순 → 동점이면 공통 취미가 많은 순 → 그래도 같으면 닉네임 가나다순</p>
            </section>
          )}

          <ExcludedList excluded={rec.excluded} onRelax={relax} />
        </>
      )}
    </div>
  )
}
