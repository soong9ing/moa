import type { Preferences, Profile } from '../types'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig'

/**
 * 아주 작은 Supabase 클라이언트 (외부 패키지 없이 fetch만 사용).
 *  - 인증: Supabase Auth REST (/auth/v1)
 *  - 데이터: PostgREST (/rest/v1) — profiles 테이블, member_count / delete_my_account 함수
 * 테이블과 보안 규칙은 supabase/schema.sql 에 있어요.
 */

export interface SbUser {
  id: string
  email: string
  nickname: string
}

interface StoredSession {
  access_token: string
  refresh_token: string
  /** 초 단위 유닉스 시간 */
  expires_at: number
  user: SbUser
}

const SESSION_KEY = 'moa.v2.sb-session'

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}
function writeSession(s: StoredSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* 저장이 막혀 있어도 이번 방문 동안은 동작 */
  }
}

/** 저장된 로그인 사용자 (첫 화면 그릴 때 바로 쓰려고 동기로 읽어요) */
export function storedUser(): SbUser | null {
  return readSession()?.user ?? null
}

// ---------- 공통 요청 ----------

export class SbError extends Error {
  status: number
  code: string
  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Supabase가 돌려준 영어 오류를 사용자에게 보여 줄 한국어로 바꿔요 */
export function toKoreanError(e: unknown): string {
  if (!(e instanceof SbError)) {
    return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  }
  const text = `${e.code} ${e.message}`.toLowerCase()
  if (text.includes('invalid login credentials') || text.includes('invalid_credentials')) return '이메일 또는 비밀번호가 맞지 않아요.'
  if (text.includes('email not confirmed') || text.includes('email_not_confirmed')) return '이메일 인증이 아직 끝나지 않았어요. 메일함의 인증 링크를 눌러 주세요.'
  if (text.includes('already registered') || text.includes('user_already_exists') || text.includes('email_exists')) return '이미 가입된 이메일이에요. 로그인 탭을 이용해 주세요.'
  if (text.includes('password') && (text.includes('at least') || text.includes('weak'))) return '비밀번호가 너무 짧거나 쉬워요. 8자 이상으로 정해 주세요.'
  if (text.includes('rate limit') || e.status === 429) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
  if (text.includes('email_address_invalid') || text.includes('invalid format')) return '이메일 형식을 확인해 주세요.'
  if (text.includes('signup') && text.includes('disabled')) return '지금은 회원가입을 받지 않고 있어요.'
  if (e.status === 401 || e.status === 403) return '로그인이 만료됐어요. 다시 로그인해 주세요.'
  return `문제가 생겼어요. 잠시 후 다시 시도해 주세요. (${e.status || '연결 오류'})`
}

async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(SUPABASE_URL + path, {
      method: init.method ?? 'GET',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new SbError('network', 0, 'network')
  }
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  if (!res.ok) {
    const j = (json ?? {}) as Record<string, unknown>
    const msg = String(j.msg ?? j.error_description ?? j.message ?? j.error ?? res.statusText)
    const code = String(j.error_code ?? j.code ?? '')
    throw new SbError(msg, res.status, code)
  }
  return json as T
}

// ---------- 인증 ----------

interface AuthResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  expires_at?: number
  user?: RawUser
  /** 이메일 인증이 켜져 있으면 세션 없이 사용자 정보만 와요 */
  id?: string
  email?: string
}
interface RawUser {
  id: string
  email?: string
  user_metadata?: { nickname?: string }
}

function toUser(u: RawUser): SbUser {
  return { id: u.id, email: u.email ?? '', nickname: u.user_metadata?.nickname ?? '' }
}

function sessionFrom(r: AuthResponse): StoredSession | null {
  if (!r.access_token || !r.refresh_token || !r.user) return null
  const expires_at = r.expires_at ?? Math.floor(Date.now() / 1000) + (r.expires_in ?? 3600)
  return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at, user: toUser(r.user) }
}

/** 이메일 인증 링크를 눌렀을 때 돌아올 주소 (지금 사이트 주소) */
function redirectUrl(): string {
  return window.location.origin + window.location.pathname
}

export type SignUpResult = { kind: 'signedIn'; user: SbUser } | { kind: 'confirmEmail'; email: string }

export async function signUp(email: string, password: string, nickname: string): Promise<SignUpResult> {
  const r = await request<AuthResponse>(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectUrl())}`, {
    method: 'POST',
    body: { email, password, data: { nickname } },
  })
  const s = sessionFrom(r)
  if (s) {
    writeSession(s)
    return { kind: 'signedIn', user: s.user }
  }
  return { kind: 'confirmEmail', email }
}

export async function signIn(email: string, password: string): Promise<SbUser> {
  const r = await request<AuthResponse>('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })
  const s = sessionFrom(r)
  if (!s) throw new SbError('no session', 500, 'no_session')
  writeSession(s)
  return s.user
}

export async function signOut(): Promise<void> {
  const s = readSession()
  writeSession(null)
  if (s) {
    try {
      await request('/auth/v1/logout', { method: 'POST', token: s.access_token })
    } catch {
      /* 이미 만료된 세션이어도 로그아웃은 끝난 것으로 봐요 */
    }
  }
}

/** 만료가 가까우면 새로 받아서, 쓸 수 있는 access token을 돌려줘요 */
async function accessToken(): Promise<string> {
  const s = readSession()
  if (!s) throw new SbError('not signed in', 401, 'no_session')
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token
  const r = await request<AuthResponse>('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } })
  const next = sessionFrom(r)
  if (!next) throw new SbError('refresh failed', 401, 'refresh_failed')
  writeSession(next)
  return next.access_token
}

/**
 * 이메일 인증 링크로 돌아왔을 때 주소의 #access_token=... 을 읽어 로그인시켜요.
 * 처리했으면 사용자(또는 오류 문구)를, 해당 없으면 null을 돌려줘요.
 */
export async function consumeAuthRedirect(): Promise<{ user?: SbUser; error?: string } | null> {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.includes('access_token=') && !hash.includes('error=')) return null
  const params = new URLSearchParams(hash)
  if (params.get('error')) {
    return { error: '인증 링크가 만료됐거나 잘못됐어요. 로그인하거나 다시 가입해 주세요.' }
  }
  const access_token = params.get('access_token') ?? ''
  const refresh_token = params.get('refresh_token') ?? ''
  const expires_at = Number(params.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(params.get('expires_in') ?? 3600)
  try {
    const raw = await request<RawUser>('/auth/v1/user', { token: access_token })
    const s: StoredSession = { access_token, refresh_token, expires_at, user: toUser(raw) }
    writeSession(s)
    return { user: s.user }
  } catch (e) {
    return { error: toKoreanError(e) }
  }
}

// ---------- 데이터 ----------

interface ProfileRow {
  id: string
  nickname: string
  age: number | null
  height: number | null
  bio: string | null
  tagline: string | null
  gender: Profile['gender']
  personality: Profile['personality'] | null
  hobbies: Profile['hobbies'] | null
  music: Profile['music'] | null
  travel: Profile['travel']
  styles: Profile['styles'] | null
  religion: Profile['religion']
  income: Profile['income']
  prefs: Partial<Preferences> | null
}

/** 내 프로필 불러오기. 아직 취향을 저장하지 않았으면(나이 없음) profile은 null */
export async function loadMyProfile(userId: string): Promise<{ profile: Profile | null; prefs: Partial<Preferences> | null }> {
  const token = await accessToken()
  const rows = await request<ProfileRow[]>(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, { token })
  const r = rows[0]
  if (!r || r.age == null) return { profile: null, prefs: r?.prefs ?? null }
  const profile: Profile = {
    id: r.id,
    kind: 'user',
    nickname: r.nickname,
    age: r.age,
    height: r.height ?? 0,
    bio: r.bio ?? '',
    tagline: r.tagline ?? '',
    gender: r.gender,
    personality: r.personality ?? [],
    hobbies: r.hobbies ?? [],
    music: r.music ?? [],
    travel: r.travel,
    styles: r.styles ?? [],
    religion: r.religion,
    income: r.income,
  }
  return { profile, prefs: r.prefs }
}

export async function saveMyProfile(profile: Profile, prefs: Preferences): Promise<void> {
  const token = await accessToken()
  const row: Omit<ProfileRow, 'prefs'> & { prefs: Preferences; updated_at: string } = {
    id: profile.id,
    nickname: profile.nickname,
    age: profile.age,
    height: profile.height,
    bio: profile.bio,
    tagline: profile.tagline ?? '',
    gender: profile.gender,
    personality: profile.personality,
    hobbies: profile.hobbies,
    music: profile.music,
    travel: profile.travel,
    styles: profile.styles,
    religion: profile.religion,
    income: profile.income,
    prefs,
    updated_at: new Date().toISOString(),
  }
  await request('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    token,
    body: row,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  })
}

/** 현재 가입자 수 (누구나 볼 수 있는 숫자 하나만 돌려주는 함수) */
export async function memberCount(): Promise<number> {
  const n = await request<number>('/rest/v1/rpc/member_count', { method: 'POST', body: {} })
  return typeof n === 'number' ? n : Number(n) || 0
}

/** 회원 탈퇴 — 계정과 프로필을 서버에서 지워요 */
export async function deleteMyAccount(): Promise<void> {
  const token = await accessToken()
  await request('/rest/v1/rpc/delete_my_account', { method: 'POST', token, body: {} })
  writeSession(null)
}
