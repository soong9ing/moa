/**
 * 궁합 점수표 — 점수를 바꾸고 싶으면 이 파일만 고치면 돼요.
 *
 * type
 *  - 'flat'    : 조건이 맞으면 points 점 (한 번만)
 *  - 'perItem' : 겹치는 항목 하나당 perItem 점, 최대 max 점
 *
 * 기본 점수표 (총 100점)
 *  선호 나이 범위        15
 *  성격 유형 일치  2×9 = 18
 *  공통 취미       3×10 = 30
 *  음악 취향 일치  2×8 = 16
 *  여행 취향 일치        10
 *  종교 선호 일치         6
 *  스타일 선호 태그       5
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
    perItem: 2,
    max: 18,
    description: '서로 고른 성격 유형이 겹칠 때마다 2점 (최대 18점)',
  },
  hobbies: {
    type: 'perItem',
    label: '공통 취미',
    perItem: 3,
    max: 30,
    description: '공통 취미 하나당 3점 (최대 30점)',
  },
  music: {
    type: 'perItem',
    label: '음악 취향 일치',
    perItem: 2,
    max: 16,
    description: '좋아하는 음악 장르가 겹칠 때마다 2점 (최대 16점)',
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

/** 점수표 전체 최대 점수 (기본표 = 100) */
export function tableTotal(table: ScoreTable = DEFAULT_SCORE_TABLE): number {
  return SCORE_KEYS.reduce((sum, k) => sum + ruleMax(table[k]), 0)
}
