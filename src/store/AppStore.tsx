import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MOCK_PROFILES, findMockProfile } from '../data/mockProfiles'
import { recommend, type Recommendation } from '../matching'
import { demoAuth, type ChatMessage, type SessionUser } from '../services/auth'
import { demoReply, openingLine } from '../services/demoReplies'
import { EMPTY_PREFERENCES, type Preferences, type Profile } from '../types'

/** 로그인한 사용자 한 명이 가진 데이터 (현재는 이 브라우저의 localStorage에 저장) */
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

  signUp(email: string, nickname: string): Promise<void>
  logIn(email: string): Promise<void>
  logOut(): Promise<void>
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
  const [user, setUser] = useState<SessionUser | null>(() => load<SessionUser | null>(SESSION_KEY, null))
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

  const enter = useCallback((u: SessionUser) => {
    save(SESSION_KEY, u)
    setUser(u)
    setData({ ...emptyData(), ...load(dataKey(u.id), emptyData()) })
    setTyping({})
  }, [])

  const signUp = useCallback(async (email: string, nickname: string) => enter(await demoAuth.signUp(email, nickname)), [enter])
  const logIn = useCallback(async (email: string) => enter(await demoAuth.logIn(email)), [enter])
  const logOut = useCallback(async () => {
    await demoAuth.logOut()
    save(SESSION_KEY, null)
    setUser(null)
    setData(emptyData())
    setTyping({})
  }, [])

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
    signUp,
    logIn,
    logOut,
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
