import type { Preferences, Profile } from '../types'
import type { SessionUser } from './auth'

/**
 * 발표·시연용 계정.
 * 주소 뒤에 ?demo=1 을 붙이거나 첫 화면의 "시연 계정으로 둘러보기"를 누르면
 * 로그인 없이 이 계정으로 들어가서 바로 추천 화면을 보여 줘요.
 *
 * - 매번 깨끗한 상태로 시작해요 (좋아요·대화·차단 기록 없음).
 * - 취향을 Moa 캐릭터 '아이스라떼'와 똑같이 맞춰 둬서 1위가 100점으로 나오고,
 *   Moa의 한마디도 겹치는 취향(영화·산책·사진, 계획형 여행)으로 이야기할 거리가 많아요.
 * - 나이·키 필수 조건을 켜 둬서 "필수 조건으로 제외된 후보" 화면도 함께 보여 줄 수 있어요.
 */
export const DEMO_EMAIL = 'demo@moa.app'

export const DEMO_USER: SessionUser = { id: 'user-demo', email: DEMO_EMAIL, nickname: '하루' }

export const DEMO_PROFILE: Profile = {
  id: DEMO_USER.id,
  kind: 'user',
  nickname: '하루',
  age: 24,
  height: 163,
  gender: '여성',
  bio: '주말엔 카메라 들고 동네 산책하고, 저녁엔 영화 한 편 보는 게 행복이에요. 약속은 미리 잡는 편이에요.',
  tagline: '산책과 영화를 좋아하는 계획형',
  personality: ['다정함', '유머러스', '차분함'],
  hobbies: ['영화', '산책', '사진', '요리', '드라마'],
  music: ['발라드', 'R&B', '팝', '재즈'],
  travel: '계획형',
  styles: ['캐주얼', '미니멀'],
  religion: null,
  income: null,
}

export const DEMO_PREFS: Preferences = {
  gender: '남성',
  ageMin: 23,
  ageMax: 28,
  ageRequired: true,
  heightMin: 172,
  heightMax: 185,
  heightRequired: true,
  religion: '기독교',
  religionRequired: false,
  styleTags: ['댄디'],
  incomeBands: [],
  travelRequired: false,
}

/** 이 브라우저에 시연 계정을 깨끗한 상태로 만들고 로그인해 둬요 */
export function seedDemoAccount() {
  try {
    const accounts = JSON.parse(localStorage.getItem('moa.v1.accounts') ?? '{}') as Record<string, SessionUser>
    accounts[DEMO_EMAIL] = DEMO_USER
    localStorage.setItem('moa.v1.accounts', JSON.stringify(accounts))
    localStorage.setItem('moa.v1.session', JSON.stringify(DEMO_USER))
    localStorage.setItem(
      `moa.v1.data.${DEMO_USER.id}`,
      JSON.stringify({ profile: DEMO_PROFILE, prefs: DEMO_PREFS, likes: [], chats: {}, blocked: [] }),
    )
  } catch {
    /* 저장이 막힌 브라우저면 일반 로그인 화면이 보여요 */
  }
}

/** 시연 계정으로 바로 추천 화면을 열어요 (새로고침해서 깨끗한 상태로 시작) */
export function startDemo() {
  seedDemoAccount()
  window.location.hash = '#/feed'
  window.location.reload()
}
