// 프로필·조건 화면에서 선택할 수 있는 항목 목록.
// 점수표의 "최대점"은 이 목록의 길이와 맞물려 있어요
// (예: 취미 10개 × 3점 = 30점). 목록을 바꾸면 scoreTable.ts의 max도 함께 확인하세요.

export const PERSONALITIES = [
  '외향적',
  '내향적',
  '다정함',
  '차분함',
  '유머러스',
  '솔직함',
  '감성적',
  '이성적',
  '열정적',
] as const

export const HOBBIES = ['운동', '드라마', '독서', '게임', '사진', '그림', '요리', '산책', '영화', '캠핑'] as const

export const MUSIC_GENRES = ['발라드', '힙합', 'R&B', '팝', '락', '트로트', '클래식', '재즈'] as const

export const TRAVEL_STYLES = ['즉흥형', '계획형'] as const

export const STYLE_TAGS = ['캐주얼', '미니멀', '스트릿', '클래식', '스포티', '빈티지', '댄디', '러블리'] as const

export const RELIGIONS = ['무교', '기독교', '천주교', '불교', '기타'] as const

export const INCOME_BANDS = ['3천만 원 미만', '3천~5천만 원', '5천~8천만 원', '8천만 원 이상'] as const

export const GENDERS = ['여성', '남성'] as const

export type Personality = (typeof PERSONALITIES)[number]
export type Hobby = (typeof HOBBIES)[number]
export type MusicGenre = (typeof MUSIC_GENRES)[number]
export type TravelStyle = (typeof TRAVEL_STYLES)[number]
export type StyleTag = (typeof STYLE_TAGS)[number]
export type Religion = (typeof RELIGIONS)[number]
export type IncomeBand = (typeof INCOME_BANDS)[number]
export type Gender = (typeof GENDERS)[number]

/** 서비스 이용 최소 나이 (성인만 이용) */
export const MIN_AGE = 19
export const MAX_AGE = 60
