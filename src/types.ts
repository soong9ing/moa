import type {
  Gender,
  Hobby,
  IncomeBand,
  MusicGenre,
  Personality,
  Religion,
  StyleTag,
  TravelStyle,
} from './data/options'

/**
 * 프로필 출처.
 * - 'mock': 앱에 내장된 가상 인물 (실존 인물 아님, 사진 없음)
 * - 'user': 이 기기에서 가입한 실제 사용자
 */
export type ProfileKind = 'mock' | 'user'

export interface Profile {
  id: string
  kind: ProfileKind
  nickname: string
  age: number
  /** cm */
  height: number
  bio: string
  gender: Gender | null
  personality: Personality[]
  hobbies: Hobby[]
  music: MusicGenre[]
  travel: TravelStyle | null
  /** 본인의 평소 스타일 */
  styles: StyleTag[]
  religion: Religion | null
  /** null = 비공개 */
  income: IncomeBand | null
  /** 화면 표시용 짧은 소개 (예: "주말엔 카메라 들고 산책") */
  tagline?: string
}

/**
 * 내가 찾는 상대 조건.
 * - "선호" 값은 점수 계산에 쓰이고
 * - "필수" 토글을 켠 값만 필터(제외)로 쓰여요.
 * 값이 비어 있으면(null / 빈 배열) 점수에도 필터에도 쓰지 않아요.
 */
export interface Preferences {
  /** 상대 성별. null = 상관없음 (필터 미사용) */
  gender: Gender | null

  ageMin: number | null
  ageMax: number | null
  /** 켜면 나이 범위 밖 후보를 제외 */
  ageRequired: boolean

  heightMin: number | null
  heightMax: number | null
  /** 켜면 키 범위 밖 후보를 제외 (키는 점수표에 없어서 필터 전용) */
  heightRequired: boolean

  /** 선호 종교. null = 상관없음 */
  religion: Religion | null
  religionRequired: boolean

  /** 상대에게 바라는 스타일 태그 (점수 전용) */
  styleTags: StyleTag[]

  /** 허용할 소득 구간. 빈 배열 = 상관없음 (필터 전용) */
  incomeBands: IncomeBand[]

  /** 켜면 내 여행 취향과 같은 후보만 남김 */
  travelRequired: boolean
}

export const EMPTY_PREFERENCES: Preferences = {
  gender: null,
  ageMin: null,
  ageMax: null,
  ageRequired: false,
  heightMin: null,
  heightMax: null,
  heightRequired: false,
  religion: null,
  religionRequired: false,
  styleTags: [],
  incomeBands: [],
  travelRequired: false,
}
