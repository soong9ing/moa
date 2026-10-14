import type { Preferences, Profile } from '../types'
import { applyFilters, type ActiveFilter, type ExcludedCandidate } from './filters'
import { scoreCandidate, type ScoreResult } from './score'
import { DEFAULT_SCORE_TABLE, type ScoreTable } from './scoreTable'

/**
 * 추천 파이프라인
 *   1. applyFilters   — 필수 조건으로 거르기 (본인 제외 포함)
 *   2. scoreCandidate — 통과한 후보만 점수 계산
 *   3. 정렬           — 총점 ↓, 동점이면 공통 취미 수 ↓, 그래도 같으면 닉네임 가나다순
 */

export interface RankedCandidate {
  rank: number
  profile: Profile
  score: ScoreResult
  commonHobbies: string[]
}

export interface Recommendation {
  ranked: RankedCandidate[]
  top: RankedCandidate | null
  excluded: ExcludedCandidate[]
  activeFilters: ActiveFilter[]
  /** 처음 후보 수 (본인 제외 후) */
  poolSize: number
  selfRemoved: boolean
}

export function compareRanked(a: Omit<RankedCandidate, 'rank'>, b: Omit<RankedCandidate, 'rank'>): number {
  if (b.score.total !== a.score.total) return b.score.total - a.score.total
  if (b.commonHobbies.length !== a.commonHobbies.length) return b.commonHobbies.length - a.commonHobbies.length
  return a.profile.nickname.localeCompare(b.profile.nickname, 'ko')
}

export function recommend(
  me: Profile,
  prefs: Preferences,
  pool: Profile[],
  table: ScoreTable = DEFAULT_SCORE_TABLE,
): Recommendation {
  const filtered = applyFilters(me, prefs, pool)

  const scored = filtered.passed.map((profile) => {
    const score = scoreCandidate(me, prefs, profile, table)
    const commonHobbies = score.categories.find((c) => c.key === 'hobbies')?.matched ?? []
    return { profile, score, commonHobbies }
  })
  scored.sort(compareRanked)

  const ranked = scored.map((s, i) => ({ ...s, rank: i + 1 }))
  return {
    ranked,
    top: ranked[0] ?? null,
    excluded: filtered.excluded,
    activeFilters: filtered.activeFilters,
    poolSize: filtered.passed.length + filtered.excluded.length,
    selfRemoved: filtered.selfRemoved,
  }
}
