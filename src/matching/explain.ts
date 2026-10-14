import type { ExcludedCandidate, FilterKey } from './filters'
import type { RankedCandidate, Recommendation } from './recommend'
import { josa } from '../lib/josa'

/**
 * 계산 결과만으로 "왜 1위인가"를 문장으로 만들어요.
 * 추측이나 꾸밈 없이 숫자 비교에서 나온 내용만 써요.
 */
export function explainTop(rec: Recommendation): string[] {
  const top = rec.top
  if (!top) return []
  const lines: string[] = []
  const s = top.score
  const n = rec.ranked.length

  lines.push(
    `필수 조건을 통과한 ${n}명 중 총점 ${s.total}점으로 가장 높아요. ` +
      `(설정한 항목 기준 최대 ${s.maxPossible}점, 점수표 전체 ${s.tableMax}점)`,
  )

  const strong = s.categories
    .filter((c) => c.used && c.earned > 0)
    .sort((a, b) => b.earned - a.earned)
    .slice(0, 3)
  if (strong.length > 0) {
    lines.push('점수를 가장 많이 얻은 항목: ' + strong.map((c) => `${c.label} ${c.earned}점`).join(', ') + '.')
  }

  const second = rec.ranked[1]
  if (second) {
    lines.push(...compareWithRunnerUp(top, second))
  } else {
    lines.push('필수 조건을 통과한 후보가 이 한 명뿐이라 비교 대상이 없어요.')
  }
  return lines
}

function compareWithRunnerUp(top: RankedCandidate, second: RankedCandidate): string[] {
  const gap = top.score.total - second.score.total
  const lines: string[] = []
  if (gap > 0) {
    const diffs = top.score.categories
      .map((c) => {
        const other = second.score.categories.find((o) => o.key === c.key)
        return { label: c.label, diff: c.earned - (other?.earned ?? 0) }
      })
      .filter((d) => d.diff !== 0)
      .sort((a, b) => b.diff - a.diff)
    const ahead = diffs.filter((d) => d.diff > 0)
    const behind = diffs.filter((d) => d.diff < 0)
    let line = `2위 ${second.profile.nickname}(${second.score.total}점)보다 ${gap}점 앞서요.`
    if (ahead.length) line += ` 앞선 항목: ${ahead.map((d) => `${d.label} +${d.diff}`).join(', ')}.`
    if (behind.length) line += ` 뒤처진 항목: ${behind.map((d) => `${d.label} ${d.diff}`).join(', ')}.`
    lines.push(line)
  } else {
    // 동점 → 정렬 규칙으로 결정
    if (top.commonHobbies.length !== second.commonHobbies.length) {
      lines.push(
        `2위 ${josa(second.profile.nickname, '과', '와')} ${top.score.total}점 동점이지만, 동점일 때는 공통 취미가 많은 쪽을 앞에 두는 규칙에 따라 ` +
          `공통 취미 ${top.commonHobbies.length}개 대 ${second.commonHobbies.length}개로 1위가 됐어요.`,
      )
    } else {
      lines.push(
        `2위 ${josa(second.profile.nickname, '과', '와')} 점수·공통 취미 수가 모두 같아 닉네임 가나다순으로 정렬했어요. 사실상 공동 1위예요.`,
      )
    }
  }
  return lines
}

/** 필터별로 몇 명이 걸렸는지 — 후보 0명일 때 어떤 조건을 풀면 좋을지 안내용 */
export function exclusionStats(excluded: ExcludedCandidate[]): { key: FilterKey; count: number; onlyReason: number }[] {
  const map = new Map<FilterKey, { count: number; onlyReason: number }>()
  for (const e of excluded) {
    for (const r of e.reasons) {
      const cur = map.get(r.key) ?? { count: 0, onlyReason: 0 }
      cur.count += 1
      if (e.reasons.length === 1) cur.onlyReason += 1
      map.set(r.key, cur)
    }
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.onlyReason - a.onlyReason || b.count - a.count)
}
