import { useState } from 'react'
import type { ActiveFilter, ExcludedCandidate, FilterKey } from '../matching'
import { exclusionStats, groupByFilter } from '../matching'
import { Icon } from '../lib/icons'
import { Link } from '../lib/router'
import type { Preferences } from '../types'
import { Avatar } from './visuals'

export const FILTER_LABEL: Record<FilterKey, string> = {
  gender: '상대 성별',
  age: '나이',
  height: '키',
  religion: '종교',
  income: '소득 구간',
  travel: '여행 취향',
}

/** 필터 하나를 끄는 데 필요한 설정 변경 */
export const RELAX: Record<FilterKey, Partial<Preferences>> = {
  gender: { gender: null },
  age: { ageRequired: false },
  height: { heightRequired: false },
  religion: { religionRequired: false },
  income: { incomeBands: [] },
  travel: { travelRequired: false },
}

export function ActiveFilterChips({ filters }: { filters: ActiveFilter[] }) {
  if (filters.length === 0) return <span className="muted small">적용 중인 필수 조건 없음</span>
  return (
    <div className="filter-chips">
      {filters.map((f) => (
        <span key={f.key} className="fchip">
          <Icon name="filter" size={13} />
          {f.label} · {f.condition}
        </span>
      ))}
    </div>
  )
}

/** 필터에서 제외된 후보 — 필수 조건(카테고리)별 탭으로 나눠 보여 줘요 */
export function ExcludedList({
  excluded,
  defaultOpen = false,
  onRelax,
}: {
  excluded: ExcludedCandidate[]
  defaultOpen?: boolean
  onRelax?: (key: FilterKey) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const groups = groupByFilter(excluded)
  const [selected, setSelected] = useState<FilterKey | null>(null)
  if (excluded.length === 0) return null

  // 선택한 탭이 사라졌으면(조건을 풀었으면) 가장 많은 탭으로
  const active = groups.find((g) => g.key === selected) ?? groups[0]

  return (
    <section className="card excluded">
      <button type="button" className="excluded-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <Icon name="filter" size={18} /> 필수 조건으로 제외된 후보 <b>{excluded.length}명</b>
        </span>
        <Icon name="chevron" size={18} className={`chev${open ? ' is-open' : ''}`} />
      </button>
      {open && (
        <div className="ex-body">
          <div className="ex-tabs" role="tablist" aria-label="필수 조건별 제외 후보">
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={g.key === active.key}
                className={`ex-tab${g.key === active.key ? ' is-on' : ''}`}
                onClick={() => setSelected(g.key)}
              >
                {FILTER_LABEL[g.key]}
                <em>{g.items.length}</em>
              </button>
            ))}
          </div>

          <div className="ex-panel" role="tabpanel">
            <div className="ex-panel-head">
              <p>
                <b>{FILTER_LABEL[active.key]}</b> 조건에 맞지 않아 제외된 {active.items.length}명
                {active.onlyCount > 0 && <span className="muted"> · 이 조건만 풀면 {active.onlyCount}명이 다시 후보가 돼요</span>}
              </p>
              {onRelax && (
                <button type="button" className="btn btn-small btn-ghost" onClick={() => onRelax(active.key)}>
                  이 조건 풀기
                </button>
              )}
            </div>
            <ul className="excluded-list">
              {active.items.map(({ candidate, reason, others }) => (
                <li key={candidate.profile.id}>
                  <Link to={`/match/${candidate.profile.id}`} className="ex-person">
                    <Avatar profile={candidate.profile} size={36} />
                    <span>
                      <strong>{candidate.profile.nickname}</strong>
                      <small>{candidate.profile.age}세</small>
                    </span>
                  </Link>
                  <div className="ex-reasons">
                    <span className="reason">{reason.message}</span>
                    {others.length > 0 && <span className="reason-other">그 외 {others.map((o) => FILTER_LABEL[o.key]).join(', ')} 조건에도 걸려요</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

/** 후보가 0명일 때: 어떤 조건이 얼마나 걸렀는지 + 바로 풀 수 있는 버튼 */
export function ZeroCandidates({
  excluded,
  onRelax,
}: {
  excluded: ExcludedCandidate[]
  onRelax: (key: FilterKey) => void
}) {
  const stats = exclusionStats(excluded)
  return (
    <section className="card zero">
      <div className="zero-icon">
        <Icon name="filter" size={28} />
      </div>
      <h2>지금 조건에 맞는 사람이 없어요</h2>
      <p className="sub">
        억지로 추천하지 않을게요. 필수 조건 {stats.length}개가 후보 {excluded.length}명을 모두 걸렀어요. 아래에서 조건을 하나씩 풀어 보세요.
      </p>
      <ul className="zero-stats">
        {stats.map((s) => (
          <li key={s.key}>
            <div>
              <strong>{FILTER_LABEL[s.key]}</strong>
              <span>
                {s.count}명 제외
                {s.onlyReason > 0 && ` · 이 조건만 풀면 ${s.onlyReason}명이 다시 후보가 돼요`}
              </span>
            </div>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => onRelax(s.key)}>
              이 조건 풀기
            </button>
          </li>
        ))}
      </ul>
      <Link to="/profile" className="btn btn-primary">
        <Icon name="sliders" size={18} /> 프로필에서 조건 자세히 고치기
      </Link>
    </section>
  )
}
