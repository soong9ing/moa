import type { RankedCandidate } from '../matching'
import { Link } from '../lib/router'
import { Icon } from '../lib/icons'
import { useApp } from '../store/AppStore'
import { Avatar, CATEGORY_COLOR } from './visuals'

/** 추천 피드 목록용 카드 — 순위, 프로필 요약, 점수 막대(항목별 색) */
export function CandidateCard({ item, index = 0 }: { item: RankedCandidate; index?: number }) {
  const { likes, toggleLike, notify } = useApp()
  const p = item.profile
  const liked = likes.includes(p.id)
  return (
    <article className="cand" style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}>
      <Link to={`/match/${p.id}`} className="cand-main" aria-label={`${p.nickname} 궁합 상세 보기`}>
        <span className="cand-rank">{item.rank}</span>
        <Avatar profile={p} size={52} />
        <div className="cand-info">
          <div className="cand-name">
            <strong>{p.nickname}</strong>
            <span className="muted">
              {p.age}세 · {p.height}cm
            </span>
          </div>
          <p className="cand-tag">{p.tagline ?? p.bio}</p>
          <div className="cand-bar" aria-hidden="true">
            {item.score.categories
              .filter((c) => c.earned > 0)
              .map((c) => (
                <span key={c.key} style={{ width: `${c.earned}%`, background: CATEGORY_COLOR[c.key] }} title={`${c.label} ${c.earned}점`} />
              ))}
          </div>
          {item.commonHobbies.length > 0 && <p className="cand-common">공통 취미 · {item.commonHobbies.join(', ')}</p>}
        </div>
        <div className="cand-score">
          <b>{item.score.total}</b>
          <small>점</small>
        </div>
      </Link>
      <button
        type="button"
        className={`icon-btn like-btn${liked ? ' is-on' : ''}`}
        aria-pressed={liked}
        aria-label={liked ? `${p.nickname} 좋아요 취소` : `${p.nickname} 좋아요`}
        onClick={() => {
          toggleLike(p.id)
          notify(liked ? `${p.nickname}님 좋아요를 취소했어요` : `${p.nickname}님을 좋아요 목록에 담았어요`)
        }}
      >
        <Icon name={liked ? 'heartFill' : 'heart'} />
      </button>
    </article>
  )
}
