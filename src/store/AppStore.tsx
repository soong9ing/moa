import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MOCK_PROFILES, findMockProfile } from '../data/mockProfiles'
import { recommend, type Recommendation } from '../matching'
import { demoAuth, type ChatMessage, type SessionUser } from '../services/auth'
import { IS_LIVE } from '../services/backend'
import { demoReply, openingLine } from '../services/demoReplies'
import { navigate } from '../lib/router'
import * as sb from '../services/supabase'
import { EMPTY_PREFERENCES, type Preferences, type Profile } from '../types'

/**
 * 로그인한 사용자 한 명이 가진 데이터.
 * - 프로필·찾는 상대 조건: live 모드에서는 Supabase에 저장 (이 브라우저에도 캐시)
 * - 좋아요·대화·차단: 이 브라우저의 localStorage에만 저장
 */
interface AccountData {
  profile: Profile | null
  prefs: Preferences
  likes: string[]
  chats: Record<string, ChatMessage[]>
  /** 차단한 상대 id — 추천·좋아요·대화에서 모두 숨겨요 */
  blocked: string[]
}

const SESSION_KEY = 'moa.v1.session'
const dataKey = (userId: string) => `moa.v1.data.${userId}`

const emptyData = (): AccountData => ({ profile: null, prefs: { ...EMPTY_PREFERENCES }, likes: [], chats: {}, blocked: [] })

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

interface Toast {
  id: number
  text: string
}

interface AppState {
  user: SessionUser | null
  profile: Profile | null
  prefs: Preferences
  likes: string[]
  chats: Record<string, ChatMessage[]>
  blocked: string[]
  typing: Record<string, boolean>
  /** 매칭 후보 풀 — 차단한 상대는 빠져요 */
  pool: Profile[]
  recommendation: Recommendation | null
  toasts: Toast[]
  /** live 모드의 실제 가입자 수 (불러오기 전이면 null). demo 모드에서는 항상 null */
  memberCount: number | null
  /** live 모드에서 서버의 내 프로필을 불러오는 중 */
  syncing: boolean

  /** 가입 결과: 바로 로그인됐는지, 이메일 인증이 필요한지 */
  signUp(email: string, nickname: string, password?: string): Promise<'signedIn' | 'confirmEmail'>
  logIn(email: string, password?: string): Promise<void>
  logOut(): Promise<void>
  /** 회원 탈퇴 (live 모드) — 서버의 계정·프로필과 이 브라우저의 기록을 지워요 */
  deleteAccount(): Promise<void>
  saveProfile(p: Omit<Profile, 'id' | 'kind'>): void
  savePrefs(p: Preferences): void
  updatePrefs(patch: Partial<Preferences>): void
  toggleLike(profileId: string): void
  startChat(profileId: string): void
  sendMessage(profileId: string, text: string): void
  leaveChat(profileId: string): void
  blockProfile(profileId: string): void
  unblockProfile(profileId: string): void
  notify(text: string): void
  resetMyData(): void
}

const Ctx = createContext<AppState | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => (IS_LIVE ? sb.storedUser() : load<SessionUser | null>(SESSION_KEY, null)))
  const [memberCount, setMemberCount] = useState<number | null>(null)
  /** live 모드에서 서버의 내 프로필을 불러오는 중이면 true (그동안 프로필 화면을 잠가 덮어쓰기를 막아요) */
  const [syncing, setSyncing] = useState<boolean>(() => IS_LIVE && user != null)
  /** 마지막으로 서버와 같다고 확인한 프로필·조건 (이 값과 다를 때만 서버에 저장해요) */
  const serverSnapshot = useRef<string | null>(null)
  const [data, setData] = useState<AccountData>(() => (user ? { ...emptyData(), ...load(dataKey(user.id), emptyData()) } : emptyData()))
  const [typing, setTyping] = useState<Record<string, boolean>>({})
  const [toasts, setToasts] = useState<Toast[]>([])
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])

  // 계정 데이터 저장
  useEffect(() => {
    if (user) save(dataKey(user.id), data)
  }, [user, data])

  const notify = useCallback((text: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  const refreshMemberCount = useCallback(async () => {
    if (!IS_LIVE) return
    try {
      setMemberCount(await sb.memberCount())
    } catch {
      /* 숫자를 못 불러와도 앱은 계속 동작 (태양에는 마지막 값 또는 0) */
    }
  }, [])

  /** 서버에 저장된 내 프로필·조건을 불러와 화면에 반영해요 */
  const pullFromServer = useCallback(async (u: SessionUser) => {
    if (!IS_LIVE) return
    setSyncing(true)
    try {
      const { profile, prefs } = await sb.loadMyProfile(u.id)
      if (userRef.current?.id !== u.id) return
      const nextPrefs: Preferences = { ...EMPTY_PREFERENCES, ...(prefs ?? {}) }
      // 서버 값을 그대로 화면에 반영하고, 이 값을 '서버와 같은 상태'로 기록해요
      serverSnapshot.current = JSON.stringify({ profile, prefs: nextPrefs })
      setData((d) => ({ ...d, profile, prefs: nextPrefs }))
    } catch (e) {
      if (e instanceof sb.SbError && (e.status === 401 || e.code === 'refresh_failed' || e.code === 'no_session')) {
        // 로그인이 만료됐어요 → 로그아웃 처리
        await sb.signOut()
        setUser(null)
        setData(emptyData())
        notify('로그인이 만료됐어요. 다시 로그인해 주세요.')
      } else {
        notify('서버에서 내 프로필을 불러오지 못했어요. 새로고침해 주세요.')
      }
    } finally {
      if (userRef.current?.id === u.id || !userRef.current) setSyncing(false)
    }
  }, [notify])

  const enter = useCallback(
    (u: SessionUser) => {
      if (!IS_LIVE) save(SESSION_KEY, u)
      userRef.current = u
      serverSnapshot.current = null
      setUser(u)
      // 서버 값을 받기 전에는 프로필을 비워 두고, 좋아요·대화·차단만 이 브라우저에서 불러와요
      const local = { ...emptyData(), ...load(dataKey(u.id), emptyData()) }
      setData(IS_LIVE ? { ...local, profile: null, prefs: { ...EMPTY_PREFERENCES } } : local)
      setTyping({})
      void pullFromServer(u)
      void refreshMemberCount()
    },
    [pullFromServer, refreshMemberCount],
  )

  const signUp = useCallback(
    async (email: string, nickname: string, password = ''): Promise<'signedIn' | 'confirmEmail'> => {
      if (!IS_LIVE) {
        enter(await demoAuth.signUp(email, nickname))
        return 'signedIn'
      }
      try {
        const r = await sb.signUp(email.trim().toLowerCase(), password, nickname.trim())
        if (r.kind === 'confirmEmail') return 'confirmEmail'
        enter({ ...r.user, nickname: r.user.nickname || nickname.trim() })
        return 'signedIn'
      } catch (e) {
        throw new Error(sb.toKoreanError(e))
      }
    },
    [enter],
  )

  const logIn = useCallback(
    async (email: string, password = '') => {
      if (!IS_LIVE) return enter(await demoAuth.logIn(email))
      try {
        enter(await sb.signIn(email.trim().toLowerCase(), password))
      } catch (e) {
        throw new Error(sb.toKoreanError(e))
      }
    },
    [enter],
  )

  const logOut = useCallback(async () => {
    if (IS_LIVE) await sb.signOut()
    else await demoAuth.logOut()
    save(SESSION_KEY, null)
    // 화면 이동을 상태 변경과 같은 순간에 처리해야 '로그인 화면으로 튕기기'가 생기지 않아요
    navigate('/', { replace: true })
    userRef.current = null
    serverSnapshot.current = null
    setSyncing(false)
    setUser(null)
    setData(emptyData())
    setTyping({})
  }, [])

  const deleteAccount = useCallback(async () => {
    const u = userRef.current
    if (!u) return
    if (IS_LIVE) {
      try {
        await sb.deleteMyAccount()
      } catch (e) {
        throw new Error(sb.toKoreanError(e))
      }
    }
    save(dataKey(u.id), null)
    navigate('/', { replace: true })
    userRef.current = null
    serverSnapshot.current = null
    setSyncing(false)
    setUser(null)
    setData(emptyData())
    setTyping({})
    void refreshMemberCount()
  }, [refreshMemberCount])

  // 첫 방문: 가입자 수 불러오기 + 이메일 인증 링크로 돌아온 경우 처리 + 저장된 로그인으로 서버 값 불러오기
  useEffect(() => {
    if (!IS_LIVE) return
    void refreshMemberCount()
    const timer = setInterval(() => void refreshMemberCount(), 60_000)
    void (async () => {
      const r = await sb.consumeAuthRedirect()
      if (r?.user) {
        enter(r.user)
        notify('이메일 인증을 마쳤어요. 이제 취향을 모아 볼까요?')
        navigate('/profile', { replace: true })
      } else if (r?.error) {
        notify(r.error)
        navigate('/login', { replace: true })
      } else if (userRef.current) {
        void pullFromServer(userRef.current)
      } else {
        setSyncing(false)
      }
    })()
    return () => clearInterval(timer)
    // 처음 한 번만 실행해요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 프로필·조건이 서버 값과 달라지면 서버에도 저장 (live 모드, 0.6초 모아서 한 번)
  useEffect(() => {
    if (!IS_LIVE || !user || syncing || !data.profile) return
    const snapshot = JSON.stringify({ profile: data.profile, prefs: data.prefs })
    if (snapshot === serverSnapshot.current) return
    const profile = data.profile
    const prefs = data.prefs
    const t = setTimeout(() => {
      sb.saveMyProfile(profile, prefs)
        .then(() => {
          serverSnapshot.current = snapshot
        })
        .catch((e) => notify(`서버에 저장하지 못했어요. ${sb.toKoreanError(e)}`))
    }, 600)
    return () => clearTimeout(t)
  }, [user, syncing, data.profile, data.prefs, notify])

  const saveProfile = useCallback(
    (p: Omit<Profile, 'id' | 'kind'>) => {
      if (!userRef.current) return
      const full: Profile = { ...p, id: userRef.current.id, kind: 'user' }
      setData((d) => ({ ...d, profile: full }))
    },
    [],
  )
  const savePrefs = useCallback((prefs: Preferences) => setData((d) => ({ ...d, prefs })), [])
  const updatePrefs = useCallback((patch: Partial<Preferences>) => setData((d) => ({ ...d, prefs: { ...d.prefs, ...patch } })), [])

  const toggleLike = useCallback(
    (id: string) => {
      setData((d) => {
        const liked = d.likes.includes(id)
        return { ...d, likes: liked ? d.likes.filter((x) => x !== id) : [id, ...d.likes] }
      })
    },
    [],
  )

  const startChat = useCallback((id: string) => {
    const p = findMockProfile(id)
    if (!p) return
    setData((d) => {
      if (d.chats[id]?.length) return d
      const first: ChatMessage = { id: `m-${Date.now()}`, from: 'them', text: openingLine(p), at: Date.now(), demo: true }
      return { ...d, chats: { ...d.chats, [id]: [first] } }
    })
  }, [])

  const sendMessage = useCallback((id: string, text: string) => {
    const p = findMockProfile(id)
    const body = text.trim()
    if (!p || !body) return
    const owner = userRef.current?.id
    let turn = 0
    setData((d) => {
      const list = d.chats[id] ?? []
      turn = list.length
      const mine: ChatMessage = { id: `m-${Date.now()}`, from: 'me', text: body, at: Date.now() }
      return { ...d, chats: { ...d.chats, [id]: [...list, mine] } }
    })
    setTyping((t) => ({ ...t, [id]: true }))
    const delay = 900 + Math.min(body.length * 25, 1200)
    setTimeout(() => {
      if (userRef.current?.id !== owner) return // 그 사이 로그아웃했다면 무시
      const reply: ChatMessage = { id: `m-${Date.now()}-r`, from: 'them', text: demoReply(p, body, turn), at: Date.now(), demo: true }
      setData((d) => {
        // 그 사이 채팅방을 나갔거나 차단했다면 답장을 넣지 않아요
        if (!d.chats[id] || d.blocked.includes(id)) return d
        return { ...d, chats: { ...d.chats, [id]: [...d.chats[id], reply] } }
      })
      setTyping((t) => ({ ...t, [id]: false }))
    }, delay)
  }, [])

  const leaveChat = useCallback((id: string) => {
    setData((d) => {
      const chats = { ...d.chats }
      delete chats[id]
      return { ...d, chats }
    })
    setTyping((t) => ({ ...t, [id]: false }))
  }, [])

  const blockProfile = useCallback((id: string) => {
    setData((d) => {
      const chats = { ...d.chats }
      delete chats[id]
      return {
        ...d,
        chats,
        likes: d.likes.filter((x) => x !== id),
        blocked: d.blocked.includes(id) ? d.blocked : [id, ...d.blocked],
      }
    })
    setTyping((t) => ({ ...t, [id]: false }))
  }, [])

  const unblockProfile = useCallback((id: string) => {
    setData((d) => ({ ...d, blocked: d.blocked.filter((x) => x !== id) }))
  }, [])

  const resetMyData = useCallback(() => {
    setData(emptyData())
    setTyping({})
  }, [])

  const blocked = data.blocked
  const pool = useMemo(() => MOCK_PROFILES.filter((p) => !blocked.includes(p.id)), [blocked])
  const recommendation = useMemo(
    () => (data.profile ? recommend(data.profile, data.prefs, pool) : null),
    [data.profile, data.prefs, pool],
  )

  const value: AppState = {
    user,
    profile: data.profile,
    prefs: data.prefs,
    likes: data.likes,
    chats: data.chats,
    blocked,
    typing,
    pool,
    recommendation,
    toasts,
    memberCount,
    syncing,
    signUp,
    logIn,
    logOut,
    deleteAccount,
    saveProfile,
    savePrefs,
    updatePrefs,
    toggleLike,
    startChat,
    sendMessage,
    leaveChat,
    blockProfile,
    unblockProfile,
    notify,
    resetMyData,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppStoreProvider')
  return v
}
