import { useEffect } from 'react'
import { Shell, Toasts } from './components/Shell'
import { matchPath, navigate, usePath } from './lib/router'
import { Chats } from './pages/Chats'
import { Feed } from './pages/Feed'
import { Landing } from './pages/Landing'
import { Likes } from './pages/Likes'
import { Login } from './pages/Login'
import { MatchDetail } from './pages/MatchDetail'
import { ProfilePage } from './pages/ProfilePage'
import { AppStoreProvider, useApp } from './store/AppStore'

const PRIVATE = ['/feed', '/match', '/likes', '/chats', '/profile']

function Routes() {
  const path = usePath()
  const { user, profile } = useApp()
  const isPrivate = PRIVATE.some((p) => path === p || path.startsWith(p + '/'))

  // 로그인 보호 + 로그인 상태에서 로그인 화면 접근 시 이동
  useEffect(() => {
    if (isPrivate && !user) navigate('/login', { replace: true })
    else if (path === '/login' && user) navigate(profile ? '/feed' : '/profile', { replace: true })
  }, [isPrivate, user, profile, path])

  if (path === '/' ) return <Landing />
  if (path === '/login') return <Login />
  if (!user) return null

  let page = null
  let m: Record<string, string> | null
  if (path === '/feed') page = <Feed />
  else if (path === '/profile') page = <ProfilePage />
  else if (path === '/likes') page = <Likes />
  else if (path === '/chats') page = <Chats />
  else if ((m = matchPath('/chats/:id', path))) page = <Chats id={m.id} />
  else if ((m = matchPath('/match/:id', path))) page = <MatchDetail id={m.id} />
  else page = <NotFound />

  return <Shell path={path}>{page}</Shell>
}

function NotFound() {
  return (
    <div className="page">
      <div className="empty">
        <h3>페이지를 찾을 수 없어요</h3>
        <a href="#/feed" className="btn btn-primary">
          추천으로 가기
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppStoreProvider>
      <Routes />
      <Toasts />
    </AppStoreProvider>
  )
}
