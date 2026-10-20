import type { Preferences, Profile } from '../types'
import { DEFAULT_SCORE_TABLE, SCORE_KEYS, ruleMax, type ScoreKey, type ScoreRule, type ScoreTable } from './scoreTable'

/**
 * 궁합 점수 계산 — 필터를 통과한 후보에게만 사용해요.
 *
 * "사용하지 않는 항목" 규칙
 *  - 내가 값을 고르지 않은 항목은 used=false, 0점이에요.
 *    (예: 선호 나이를 비워 두면 나이 15점은 아무에게도 주지 않아요.)
 *  - 그래서 "설정한 항목 기준 최대 점수(maxPossible)"를 따로 알려 줘요.
 */

export interface CategoryScore {
  key: ScoreKey
  label: string
  earned: number
  max: number
  used: boolean
  /** 겹친 항목들 (취미·음악·성격·스타일) 또는 일치한 값 */
  matched: string[]
  /** 이 항목 점수가 어떻게 나왔는지 한 줄 설명 */
  detail: string
}

export interface ScoreResult {
  total: number
  /** 기본 점수표 총점 (기본 100) */
  tableMax: number
  /** 내가 설정한 항목만 합친 최대 점수 */
  maxPossible: number
  categories: CategoryScore[]
}

function intersect<T>(a: readonly T[], b: readonly T[]): T[] {
  const setB = new Set(b)
  return [...new Set(a)].filter((x) => setB.has(x))
}

function perItemScore(rule: ScoreRule, count: number): number {
  if (rule.type === 'perItem') return Math.min(count * rule.perItem, rule.max)
  return count > 0 ? rule.points : 0
}

function flatScore(rule: ScoreRule, hit: boolean): number {
  if (!hit) return 0
  return rule.type === 'flat' ? rule.points : Math.min(rule.perItem, rule.max)
}

const NOT_USED = '설정하지 않아 점수에 반영하지 않았어요'

export function scoreCandidate(
  me: Profile,
  prefs: Preferences,
  candidate: Profile,
  table: ScoreTable = DEFAULT_SCORE_TABLE,
): ScoreResult {
  const cats: Record<ScoreKey, CategoryScore> = {} as Record<ScoreKey, CategoryScore>

  const make = (key: ScoreKey, used: boolean, earned: number, matched: string[], detail: string): CategoryScore => ({
    key,
    label: table[key].label,
    earned: used ? earned : 0,
    max: ruleMax(table[key]),
    used,
    matched: used ? matched : [],
    detail: used ? detail : NOT_USED,
  })

  // 1) 선호 나이 범위
  {
    const used = prefs.ageMin != null || prefs.ageMax != null
    const okMin = prefs.ageMin == null || candidate.age >= prefs.ageMin
    const okMax = prefs.ageMax == null || candidate.age <= prefs.ageMax
    const hit = used && okMin && okMax
    cats.age = make(
      'age',
      used,
      flatScore(table.age, hit),
      hit ? [`${candidate.age}세`] : [],
      hit ? `${candidate.age}세 — 선호 범위 안` : `${candidate.age}세 — 선호 범위 밖`,
    )
  }

  // 2) 성격 / 3) 취미 / 4) 음악 — 겹치는 항목 수 기반
  const overlapCat = (key: 'personality' | 'hobbies' | 'music', mine: readonly string[], theirs: readonly string[]) => {
    const used = mine.length > 0
    const common = intersect(mine, theirs)
    const rule = table[key]
    const earned = perItemScore(rule, common.length)
    const per = rule.type === 'perItem' ? rule.perItem : 0
    const detail =
      common.length === 0
        ? '겹치는 항목이 없어요'
        : `${common.length}개 일치 × ${per}점 = ${common.length * per}점` +
          (common.length * per > earned ? ` → 최대 ${earned}점` : '')
    cats[key] = make(key, used, earned, common, detail)
  }
  overlapCat('personality', me.personality, candidate.personality)
  overlapCat('hobbies', me.hobbies, candidate.hobbies)
  overlapCat('music', me.music, candidate.music)

  // 5) 여행 취향
  {
    const used = me.travel != null
    const hit = used && candidate.travel === me.travel
    cats.travel = make(
      'travel',
      used,
      flatScore(table.travel, hit),
      hit && me.travel ? [me.travel] : [],
      hit ? `둘 다 ${me.travel}` : `나는 ${me.travel ?? '-'}, 상대는 ${candidate.travel ?? '정보 없음'}`,
    )
  }

  // 6) 종교 선호
  {
    const used = prefs.religion != null
    const hit = used && candidate.religion === prefs.religion
    cats.religion = make(
      'religion',
      used,
      flatScore(table.religion, hit),
      hit && prefs.religion ? [prefs.religion] : [],
      hit ? `선호 종교(${prefs.religion})와 같아요` : `상대 종교 ${candidate.religion ?? '정보 없음'} (선호: ${prefs.religion ?? '-'})`,
    )
  }

  // 7) 스타일 선호 태그
  {
    const used = prefs.styleTags.length > 0
    const common = intersect(prefs.styleTags, candidate.styles)
    const hit = used && common.length > 0
    cats.style = make(
      'style',
      used,
      flatScore(table.style, hit),
      common,
      hit ? `바라는 스타일 ${common.join(', ')} 일치` : '바라는 스타일 태그와 겹치지 않아요',
    )
  }

  const categories = SCORE_KEYS.map((k) => cats[k])
  const total = categories.reduce((s, c) => s + c.earned, 0)
  const tableMax = categories.reduce((s, c) => s + c.max, 0)
  const maxPossible = categories.reduce((s, c) => s + (c.used ? c.max : 0), 0)
  return { total, tableMax, maxPossible, categories }
}

/**
 * 이 상대에게서 받을 수 있는 가장 높은 점수.
 * 내 취향과 선호 조건이 상대와 완벽하게 맞는다고 가정해요.
 * (성격·취미·음악은 상대가 가진 항목 수만큼만 겹칠 수 있어요.)
 */
export function bestPossibleScore(candidate: Profile, table: ScoreTable = DEFAULT_SCORE_TABLE): number {
  const count: Record<ScoreKey, number> = {
    age: 1,
    personality: candidate.personality.length,
    hobbies: candidate.hobbies.length,
    music: candidate.music.length,
    travel: candidate.travel ? 1 : 0,
    religion: candidate.religion ? 1 : 0,
    style: candidate.styles.length > 0 ? 1 : 0,
  }
  return SCORE_KEYS.reduce((sum, k) => sum + perItemScore(table[k], count[k]), 0)
}

/** 후보 전체 중 현실적으로 받을 수 있는 최고 궁합 점수 */
export function maxAchievableScore(pool: Profile[], table: ScoreTable = DEFAULT_SCORE_TABLE): number {
  return pool.reduce((best, p) => Math.max(best, bestPossibleScore(p, table)), 0)
}
