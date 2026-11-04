/**
 * 궁합 점수표 — 점수를 바꾸고 싶으면 이 파일만 고치면 돼요.
 *
 * type
 *  - 'flat'    : 조건이 맞으면 points 점 (한 번만)
 *  - 'perItem' : 겹치는 항목 하나당 perItem 점, 최대 max 점
 *
 * 기본 점수표 (총 100점)
 *  선호 나이 범위             15
 *  성격 유형 일치  최대 3개 × 6 = 18
 *  공통 취미       최대 5개 × 6 = 30
 *  음악 취향 일치  최대 4개 × 4 = 16
 *  여행 취향 일치             10
 *  종교 선호 일치              6
 *  스타일 선호 태그            5
 *
 * 'perItem' 항목의 선택 한도는 max ÷ perItem 으로 정해져요 (selectionLimit).
 * 프로필 화면도 이 한도만큼만 고를 수 있어서, 취향이 완벽히 맞으면 실제로 100점이 나와요.
 */

export type ScoreKey = 'age' | 'personality' | 'hobbies' | 'music' | 'travel' | 'religion' | 'style'

export type ScoreRule =
  | { type: 'flat'; label: string; points: number; description: string }
  | { type: 'perItem'; label: string; perItem: number; max: number; description: string }

export type ScoreTable = Record<ScoreKey, ScoreRule>

export const SCORE_KEYS: readonly ScoreKey[] = ['age', 'personality', 'hobbies', 'music', 'travel', 'religion', 'style']

export const DEFAULT_SCORE_TABLE: ScoreTable = {
  age: {
    type: 'flat',
    label: '선호 나이 범위',
    points: 15,
    description: '상대 나이가 내가 설정한 선호 나이 범위 안에 있으면 15점',
  },
  personality: {
    type: 'perItem',
    label: '성격 유형 일치',
    perItem: 6,
    max: 18,
    description: '성격을 최대 3개 골라, 겹칠 때마다 6점 (최대 18점)',
  },
  hobbies: {
    type: 'perItem',
    label: '공통 취미',
    perItem: 6,
    max: 30,
    description: '취미를 최대 5개 골라, 공통 취미 하나당 6점 (최대 30점)',
  },
  music: {
    type: 'perItem',
    label: '음악 취향 일치',
    perItem: 4,
    max: 16,
    description: '음악 장르를 최대 4개 골라, 겹칠 때마다 4점 (최대 16점)',
  },
  travel: {
    type: 'flat',
    label: '여행 취향 일치',
    points: 10,
    description: '즉흥형/계획형 여행 취향이 같으면 10점',
  },
  religion: {
    type: 'flat',
    label: '종교 선호 일치',
    points: 6,
    description: '상대 종교가 내가 선호한 종교와 같으면 6점',
  },
  style: {
    type: 'flat',
    label: '스타일 선호 태그',
    points: 5,
    description: '내가 바라는 스타일 태그가 상대 스타일에 하나라도 있으면 5점',
  },
}

/** 규칙 하나의 최대 점수 */
export function ruleMax(rule: ScoreRule): number {
  return rule.type === 'flat' ? rule.points : rule.max
}

/** 여러 개 고르는 항목의 선택 한도 (예: 취미 30 ÷ 6 = 5개) */
export function selectionLimit(rule: ScoreRule): number {
  return rule.type === 'perItem' ? Math.floor(rule.max / rule.perItem) : 1
}

/** 점수표 전체 최대 점수 (기본표 = 100) */
export function tableTotal(table: ScoreTable = DEFAULT_SCORE_TABLE): number {
  return SCORE_KEYS.reduce((sum, k) => sum + ruleMax(table[k]), 0)
}
