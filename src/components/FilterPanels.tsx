import { useState } from 'react'
import type { ActiveFilter, ExcludedCandidate, FilterKey } from '../matching'
import { exclusionStats } from '../matching'
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

/** 필터에서 제외된 후보와 이유 */
export function ExcludedList({ excluded, defaultOpen = false }: { excluded: ExcludedCandidate[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  if (excluded.length === 0) return null
  return (
    <section className="card excluded">
      <button type="button" className="excluded-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <Icon name="filter" size={18} /> 필수 조건으로 제외된 후보 <b>{excluded.length}명</b>
        </span>
        <Icon name="chevron" size={18} className={`chev${open ? ' is-open' : ''}`} />
      </button>
      {open && (
        <ul className="excluded-list">
          {excluded.map((e) => (
            <li key={e.profile.id}>
              <Link to={`/match/${e.profile.id}`} className="ex-person">
                <Avatar profile={e.profile} size={36} />
                <span>
                  <strong>{e.profile.nickname}</strong>
                  <small>{e.profile.age}세</small>
                </span>
              </Link>
              <div className="ex-reasons">
                {e.reasons.map((r, i) => (
                  <span key={i} className="reason">
                    <b>{FILTER_LABEL[r.key]}</b> {r.message}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
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
