import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Avatar, EmptyState } from '../components/visuals'
import { findMockProfile } from '../data/mockProfiles'
import { Icon } from '../lib/icons'
import { Link, navigate } from '../lib/router'
import { useApp } from '../store/AppStore'

function timeText(at: number): string {
  const d = new Date(at)
  return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
}

export function Chats({ id }: { id?: string }) {
  const { chats, typing, likes, blocked } = useApp()
  const threads = Object.entries(chats)
    .filter(([pid]) => !blocked.includes(pid))
    .map(([pid, msgs]) => ({ profile: findMockProfile(pid), last: msgs[msgs.length - 1] }))
    .filter((t) => t.profile && t.last)
    .sort((a, b) => b.last.at - a.last.at)

  return (
    <div className={`page chats${id ? ' has-thread' : ''}`}>
      <div className="chat-layout">
        <aside className="chat-list card">
          <h1>대화</h1>
          {threads.length === 0 ? (
            <div className="chat-empty">
              <p>아직 대화가 없어요.</p>
              <p className="muted small">추천 상세나 좋아요 목록에서 ‘대화하기’를 눌러 시작해 보세요.</p>
              <Link to={likes.length ? '/likes' : '/feed'} className="btn btn-small btn-primary">
                {likes.length ? '좋아요 목록 보기' : '추천 보러 가기'}
              </Link>
            </div>
          ) : (
            <ul>
              {threads.map(({ profile, last }) => (
                <li key={profile!.id}>
                  <Link to={`/chats/${profile!.id}`} className={`thread${profile!.id === id ? ' is-active' : ''}`}>
                    <Avatar profile={profile!} size={44} />
                    <div className="thread-body">
                      <div className="thread-top">
                        <strong>{profile!.nickname}</strong>
                        <small className="muted">{timeText(last.at)}</small>
                      </div>
                      <p className="thread-last">{typing[profile!.id] ? <em className="typing-text">입력 중…</em> : (last.from === 'me' ? '나: ' : '') + last.text}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="chat-room card">{id ? <Thread key={id} id={id} /> : <EmptyState icon="chat" title="대화를 선택해 주세요">왼쪽 목록에서 대화를 고르면 여기에서 이어져요.</EmptyState>}</section>
      </div>
    </div>
  )
}

type Confirm = null | 'leave' | 'block'

function Thread({ id }: { id: string }) {
  const { chats, typing, blocked, sendMessage, recommendation, leaveChat, blockProfile, unblockProfile, notify } = useApp()
  const p = findMockProfile(id)
  const msgs = chats[id] ?? []
  const [text, setText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const isTyping = !!typing[id]

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs.length, isTyping])

  // 메뉴·확인창은 Esc로 닫혀요
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setConfirm(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!p) return <EmptyState icon="alert" title="대화 상대를 찾을 수 없어요" />

  if (blocked.includes(id)) {
    return (
      <EmptyState
        icon="shield"
        title={`${p.nickname}님을 차단했어요`}
        action={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              unblockProfile(id)
              notify(`${p.nickname}님 차단을 풀었어요`)
            }}
          >
            차단 풀기
          </button>
        }
      >
        차단한 사람과는 대화할 수 없어요.
      </EmptyState>
    )
  }

  const score = recommendation?.ranked.find((r) => r.profile.id === id)?.score.total

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    sendMessage(id, text)
    setText('')
  }

  const doLeave = () => {
    navigate('/chats')
    leaveChat(id)
    notify(`${p.nickname}님과의 채팅방을 나갔어요`)
  }
  const doBlock = () => {
    navigate('/chats')
    blockProfile(id)
    notify(`${p.nickname}님을 차단했어요`)
  }

  return (
    <div className="thread-view">
      <header className="room-head">
        <Link to="/chats" className="icon-btn room-back" aria-label="대화 목록으로">
          <Icon name="back" />
        </Link>
        <Link to={`/match/${p.id}`} className="room-person">
          <Avatar profile={p} size={40} />
          <div>
            <strong>{p.nickname}</strong>
            <span className="muted small">{score != null ? `궁합 ${score}점` : '현재 조건 밖'} · 프로필 보기</span>
          </div>
        </Link>
        <div className="room-menu">
          <button
            type="button"
            className="icon-btn"
            aria-label="채팅방 메뉴"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name="more" />
          </button>
          {menuOpen && (
            <>
              <button type="button" className="menu-scrim" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)} />
              <div className="menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setConfirm('leave') }}>
                  <Icon name="logout" size={18} /> 채팅방 나가기
                </button>
                <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuOpen(false); setConfirm('block') }}>
                  <Icon name="block" size={18} /> 차단하기
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="messages" aria-live="polite">
        <p className="day-note">
          {p.nickname}님은 Moa 캐릭터예요 · 답장은 자동으로 도착해요
        </p>
        {msgs.length === 0 && <p className="room-hint">첫 메시지를 보내 대화를 시작해 보세요.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.from === 'me' ? 'is-me' : 'is-them'}`}>
            <div className="bubble">{m.text}</div>
            <small>{timeText(m.at)}</small>
          </div>
        ))}
        {isTyping && (
          <div className="msg is-them">
            <div className="bubble typing" aria-label="입력 중">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`${p.nickname}님에게 메시지 보내기`} aria-label="메시지 입력" maxLength={300} />
        <button className="btn btn-primary send" disabled={!text.trim()} aria-label="보내기">
          <Icon name="send" size={18} />
        </button>
      </form>

      {confirm && (
        <div className="sheet-wrap" role="presentation" onClick={() => setConfirm(null)}>
          <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
            {confirm === 'leave' ? (
              <>
                <h3 id="sheet-title">채팅방을 나갈까요?</h3>
                <p>대화 내용이 모두 지워져요. {p.nickname}님은 추천 목록에 그대로 남고, 나중에 다시 대화를 시작할 수 있어요.</p>
                <div className="sheet-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
                    취소
                  </button>
                  <button type="button" className="btn btn-primary" onClick={doLeave} autoFocus>
                    나가기
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 id="sheet-title">{p.nickname}님을 차단할까요?</h3>
                <p>대화 내용이 지워지고, 추천·좋아요·대화 목록에서 더 이상 보이지 않아요. 차단은 내 프로필 화면에서 언제든 풀 수 있어요.</p>
                <div className="sheet-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
                    취소
                  </button>
                  <button type="button" className="btn btn-danger" onClick={doBlock} autoFocus>
                    차단하기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
