import { FORCE_DEMO } from './supabaseConfig'

/**
 * 백엔드 연결 상태.
 *
 * - 'live' : Supabase에 연결돼요 (VITE_MOA_DEMO=false 로 빌드할 때). 회원가입·로그인은 진짜 계정(이메일+비밀번호)이고,
 *            내 프로필은 서버에 저장돼 다른 기기에서도 이어져요. 가입자 수는 모든 방문자가 같은 숫자를 봐요.
 * - 'demo' : 서버 없이 이 브라우저 안에서만 동작해요. ← 지금 기본값 (가상 앱)
 *
 * 두 모드 모두 추천 상대는 Moa가 만든 캐릭터 40명이고, 대화는 캐릭터의 자동 답장이에요.
 * 좋아요·대화·차단 기록은 아직 이 브라우저에만 저장돼요 (2단계에서 서버로 옮길 예정).
 */
export type BackendMode = 'demo' | 'live'

export const BACKEND: { mode: BackendMode } = {
  mode: FORCE_DEMO ? 'demo' : 'live',
}

export const IS_LIVE = BACKEND.mode === 'live'
