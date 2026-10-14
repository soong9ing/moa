/**
 * 인증·채팅 서비스 인터페이스.
 * 앱 화면은 이 인터페이스만 사용하므로, 나중에 실제 서비스(Supabase 등)로
 * 구현체만 바꿔 끼우면 매칭 기능을 건드리지 않고 로그인·채팅을 붙일 수 있어요.
 */

export interface SessionUser {
  id: string
  email: string
  nickname: string
}

export interface AuthService {
  signUp(email: string, nickname: string): Promise<SessionUser>
  logIn(email: string): Promise<SessionUser>
  logOut(): Promise<void>
}

export interface ChatMessage {
  id: string
  from: 'me' | 'them'
  text: string
  at: number
  /** 데모 자동 응답으로 만들어진 메시지 */
  demo?: boolean
}

const ACCOUNTS_KEY = 'moa.v1.accounts'

function readAccounts(): Record<string, SessionUser> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '{}') as Record<string, SessionUser>
  } catch {
    return {}
  }
}

function writeAccounts(a: Record<string, SessionUser>) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a))
  } catch {
    /* 저장 공간이 막혀 있어도 앱은 계속 동작 */
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function newId(): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `user-${rnd}`
}

/**
 * 데모 인증: 이 기기 안에서만 계정을 구분해요.
 * 비밀번호가 없으므로 보안 기능이 아니에요 — 화면에도 그렇게 안내해요.
 */
export const demoAuth: AuthService = {
  async signUp(email, nickname) {
    const key = normalizeEmail(email)
    if (!isValidEmail(key)) throw new Error('이메일 형식을 확인해 주세요.')
    if (!nickname.trim()) throw new Error('닉네임을 입력해 주세요.')
    const accounts = readAccounts()
    if (accounts[key]) throw new Error('이 기기에 이미 같은 이메일의 데모 계정이 있어요. 로그인 탭을 이용해 주세요.')
    const user: SessionUser = { id: newId(), email: key, nickname: nickname.trim() }
    accounts[key] = user
    writeAccounts(accounts)
    return user
  },
  async logIn(email) {
    const key = normalizeEmail(email)
    const user = readAccounts()[key]
    if (!user) throw new Error('이 기기에 해당 이메일의 데모 계정이 없어요. 회원가입을 먼저 해 주세요.')
    return user
  },
  async logOut() {
    /* 데모 모드: 세션만 지우면 끝 */
  },
}
