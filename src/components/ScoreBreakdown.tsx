import type { ScoreResult } from '../matching'
import { DEFAULT_SCORE_TABLE } from '../matching'
import { CATEGORY_COLOR } from './visuals'

/** 항목별 획득 점수 표 — 점수표 순서 그대로, 사용하지 않은 항목은 흐리게 */
export function ScoreBreakdown({ score }: { score: ScoreResult }) {
  return (
    <div className="breakdown">
      <ul>
        {score.categories.map((c) => {
          const rule = DEFAULT_SCORE_TABLE[c.key]
          const pct = c.max ? (c.earned / c.max) * 100 : 0
          return (
            <li key={c.key} className={c.used ? '' : 'is-unused'}>
              <div className="bd-head">
                <span className="bd-dot" style={{ background: CATEGORY_COLOR[c.key] }} />
                <span className="bd-label">{c.label}</span>
                <span className="bd-rule">{rule.type === 'perItem' ? `항목당 ${rule.perItem}점` : `일치 시 ${rule.points}점`}</span>
                <span className="bd-score">
                  {c.used ? (
                    <>
                      <b>{c.earned}</b>
                      <small> / {c.max}</small>
                    </>
                  ) : (
                    <small className="bd-off">미사용</small>
                  )}
                </span>
              </div>
              <div className="bd-bar" aria-hidden="true">
                <span style={{ width: `${pct}%`, background: CATEGORY_COLOR[c.key] }} />
              </div>
              <div className="bd-detail">
                {c.matched.length > 0 && c.key !== 'age' && (
                  <span className="bd-matched">
                    {c.matched.map((m) => (
                      <em key={m}>{m}</em>
                    ))}
                  </span>
                )}
                <span>{c.detail}</span>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="bd-total">
        <span>합계</span>
        <span className="bd-sum">
          {score.categories.map((c, i) => (
            <span key={c.key} className={c.earned ? '' : 'is-zero'}>
              {i > 0 && ' + '}
              {c.earned}
            </span>
          ))}
          {' = '}
          <b>{score.total}점</b>
        </span>
      </div>
      {score.maxPossible < score.tableMax && (
        <p className="bd-note">
          설정하지 않은 항목이 있어 이 조건에서 받을 수 있는 최대 점수는 {score.maxPossible}점이에요. 프로필에서 항목을 채우면 더 정확해져요.
        </p>
      )}
    </div>
  )
}
