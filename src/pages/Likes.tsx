import { Avatar, EmptyState } from '../components/visuals'
import { findMockProfile } from '../data/mockProfiles'
import { Icon } from '../lib/icons'
import { Link, navigate } from '../lib/router'
import { useApp } from '../store/AppStore'

export function Likes() {
  const { likes, recommendation: rec, toggleLike, startChat, notify } = useApp()
  const people = likes.map((id) => findMockProfile(id)).filter((p) => p != null)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">좋아요</p>
          <h1>마음에 담아 둔 사람</h1>
          <p className="sub">{people.length}명 · 점수와 순위는 지금 내 조건 기준이에요.</p>
        </div>
      </div>

      {people.length === 0 ? (
        <EmptyState icon="heart" title="아직 좋아요한 사람이 없어요" action={<Link to="/feed" className="btn btn-primary">추천 보러 가기</Link>}>
          추천 카드의 하트를 누르면 여기에 모여요.
        </EmptyState>
      ) : (
        <div className="like-grid">
          {people.map((p, i) => {
            const r = rec?.ranked.find((x) => x.profile.id === p.id)
            const ex = rec?.excluded.find((x) => x.profile.id === p.id)
            return (
              <article key={p.id} className="like-card card" style={{ animationDelay: `${i * 50}ms` }}>
                <Link to={`/match/${p.id}`} className="like-top">
                  <Avatar profile={p} size={64} />
                  <div>
                    <strong>{p.nickname}</strong>
                    <span className="muted small">
                      {p.age}세 · {p.tagline}
                    </span>
                  </div>
                  <div className="like-score">
                    {r ? (
                      <>
                        <b>{r.score.total}</b>
                        <small>{r.rank}위</small>
                      </>
                    ) : ex ? (
                      <small className="warn">조건 밖</small>
                    ) : (
                      <small className="muted">—</small>
                    )}
                  </div>
                </Link>
                <div className="like-actions">
                  <button
                    type="button"
                    className="btn btn-small btn-ghost"
                    onClick={() => {
                      startChat(p.id)
                      navigate(`/chats/${p.id}`)
                    }}
                  >
                    <Icon name="chat" size={16} /> 대화하기
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-ghost"
                    onClick={() => {
                      toggleLike(p.id)
                      notify(`${p.nickname}님 좋아요를 취소했어요`)
                    }}
                  >
                    <Icon name="close" size={16} /> 취소
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
