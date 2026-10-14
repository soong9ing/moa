import type { Preferences, Profile } from '../types'

/**
 * 필수 조건 필터 — 점수 계산과 완전히 분리된 단계예요.
 * 여기서 걸러진 후보는 점수를 매기지 않아요.
 *
 * 원칙
 *  - 사용자가 직접 켜거나 고른 조건만 필터로 써요.
 *  - 값이 비어 있는 조건(null, 빈 배열, 범위 미입력)은 필터로 쓰지 않아요.
 *  - 나 자신은 항상 후보에서 빠져요 (제외 목록에는 표시하지 않아요).
 */

export type FilterKey = 'gender' | 'age' | 'height' | 'religion' | 'income' | 'travel'

export interface ActiveFilter {
  key: FilterKey
  label: string
  /** 사람이 읽을 수 있는 조건 설명 (예: "25~32세") */
  condition: string
}

export interface ExclusionReason {
  key: FilterKey
  message: string
}

export interface ExcludedCandidate {
  profile: Profile
  reasons: ExclusionReason[]
}

export interface FilterResult {
  passed: Profile[]
  excluded: ExcludedCandidate[]
  activeFilters: ActiveFilter[]
  /** 후보 목록에 내 프로필이 섞여 있어서 뺀 경우 true */
  selfRemoved: boolean
}

export function rangeText(min: number | null, max: number | null, unit: string): string {
  if (min != null && max != null) return `${min}~${max}${unit}`
  if (min != null) return `${min}${unit} 이상`
  if (max != null) return `${max}${unit} 이하`
  return '범위 없음'
}

function inRange(value: number, min: number | null, max: number | null): boolean {
  if (min != null && value < min) return false
  if (max != null && value > max) return false
  return true
}

/** 지금 설정으로 실제 적용되는 필수 필터 목록 */
export function getActiveFilters(me: Profile, prefs: Preferences): ActiveFilter[] {
  const list: ActiveFilter[] = []
  if (prefs.gender) {
    list.push({ key: 'gender', label: '상대 성별', condition: prefs.gender })
  }
  if (prefs.ageRequired && (prefs.ageMin != null || prefs.ageMax != null)) {
    list.push({ key: 'age', label: '나이', condition: rangeText(prefs.ageMin, prefs.ageMax, '세') })
  }
  if (prefs.heightRequired && (prefs.heightMin != null || prefs.heightMax != null)) {
    list.push({ key: 'height', label: '키', condition: rangeText(prefs.heightMin, prefs.heightMax, 'cm') })
  }
  if (prefs.religionRequired && prefs.religion) {
    list.push({ key: 'religion', label: '종교', condition: prefs.religion })
  }
  if (prefs.incomeBands.length > 0) {
    list.push({ key: 'income', label: '소득 구간', condition: prefs.incomeBands.join(', ') })
  }
  if (prefs.travelRequired && me.travel) {
    list.push({ key: 'travel', label: '여행 취향', condition: `${me.travel}만` })
  }
  return list
}

/** 후보 한 명이 어떤 필수 조건에 걸리는지 이유 목록 (빈 배열 = 통과) */
export function checkCandidate(candidate: Profile, active: ActiveFilter[], me: Profile, prefs: Preferences): ExclusionReason[] {
  const reasons: ExclusionReason[] = []
  for (const f of active) {
    switch (f.key) {
      case 'gender':
        if (candidate.gender == null) reasons.push({ key: 'gender', message: '성별 정보가 없어요' })
        else if (candidate.gender !== prefs.gender)
          reasons.push({ key: 'gender', message: `${candidate.gender} (조건: ${prefs.gender})` })
        break
      case 'age':
        if (!inRange(candidate.age, prefs.ageMin, prefs.ageMax))
          reasons.push({ key: 'age', message: `${candidate.age}세 (조건: ${f.condition})` })
        break
      case 'height':
        if (!inRange(candidate.height, prefs.heightMin, prefs.heightMax))
          reasons.push({ key: 'height', message: `${candidate.height}cm (조건: ${f.condition})` })
        break
      case 'religion':
        if (candidate.religion == null) reasons.push({ key: 'religion', message: '종교 정보가 없어요' })
        else if (candidate.religion !== prefs.religion)
          reasons.push({ key: 'religion', message: `${candidate.religion} (조건: ${prefs.religion})` })
        break
      case 'income':
        if (candidate.income == null) reasons.push({ key: 'income', message: '소득 구간 비공개' })
        else if (!prefs.incomeBands.includes(candidate.income))
          reasons.push({ key: 'income', message: `${candidate.income} (조건: ${f.condition})` })
        break
      case 'travel':
        if (candidate.travel == null) reasons.push({ key: 'travel', message: '여행 취향 정보가 없어요' })
        else if (candidate.travel !== me.travel)
          reasons.push({ key: 'travel', message: `${candidate.travel} (조건: ${f.condition})` })
        break
    }
  }
  return reasons
}

export function applyFilters(me: Profile, prefs: Preferences, pool: Profile[]): FilterResult {
  const activeFilters = getActiveFilters(me, prefs)
  const passed: Profile[] = []
  const excluded: ExcludedCandidate[] = []
  let selfRemoved = false

  for (const candidate of pool) {
    if (candidate.id === me.id) {
      selfRemoved = true
      continue
    }
    const reasons = checkCandidate(candidate, activeFilters, me, prefs)
    if (reasons.length === 0) passed.push(candidate)
    else excluded.push({ profile: candidate, reasons })
  }
  return { passed, excluded, activeFilters, selfRemoved }
}
