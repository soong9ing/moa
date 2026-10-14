import { useState, type FormEvent } from 'react'
import { Logo } from '../components/Shell'
import { Icon } from '../lib/icons'
import { Link, navigate } from '../lib/router'
import { isValidEmail } from '../services/auth'
import { BACKEND } from '../services/backend'
import { useApp } from '../store/AppStore'

export function Login() {
  const { signUp, logIn, notify } = useApp()
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isValidEmail(email)) return setError('이메일 형식을 확인해 주세요.')
    if (mode === 'signup' && !nickname.trim()) return setError('닉네임을 입력해 주세요.')
    setBusy(true)
    try {
      if (mode === 'signup') {
        await signUp(email, nickname)
        notify('데모 계정을 만들었어요. 이제 취향을 모아 볼까요?')
        navigate('/profile')
      } else {
        await logIn(email)
        notify('다시 오신 걸 환영해요')
        navigate('/feed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제가 생겼어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-side" aria-hidden="true">
        <Link to="/" className="auth-logo">
          <Logo />
        </Link>
        <blockquote>
          “좋아하는 걸 말하는 순간,
          <br />
          맞는 사람이 보이기 시작해요.”
        </blockquote>
        <div className="auth-blobs">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="auth-panel">
        <Link to="/" className="back-link">
          <Icon name="back" size={18} /> 처음으로
        </Link>
        <h1>{mode === 'signup' ? 'Moa 시작하기' : '다시 만나서 반가워요'}</h1>

        <div className="seg" role="tablist" aria-label="로그인 또는 회원가입">
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-on' : ''} onClick={() => { setMode('signup'); setError(null) }}>
            회원가입
          </button>
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-on' : ''} onClick={() => { setMode('login'); setError(null) }}>
            로그인
          </button>
        </div>

        <div className="notice notice-demo">
          <Icon name="shield" size={18} />
          <div>
            <strong>{BACKEND.label}로 동작 중</strong>
            <p>
              실제 인증 서버가 연결되지 않아 <b>비밀번호를 받지 않아요.</b> 계정은 이 브라우저 안에서만 구분되고, 데이터는 이 기기에만 저장돼요.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="form" noValidate>
          <label className="field">
            <span>이메일</span>
            <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode === 'signup' && (
            <label className="field">
              <span>닉네임</span>
              <input maxLength={12} placeholder="Moa에서 쓸 이름" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              <Icon name="alert" size={16} /> {error}
            </p>
          )}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? '잠시만요…' : mode === 'signup' ? '데모 계정 만들기' : '데모 계정으로 로그인'}
          </button>
        </form>
        <p className="auth-foot">
          {mode === 'signup' ? '이미 이 기기에서 가입했나요? ' : '처음이신가요? '}
          <button type="button" className="text-btn" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null) }}>
            {mode === 'signup' ? '로그인' : '회원가입'}
          </button>
        </p>
      </div>
    </div>
  )
}
