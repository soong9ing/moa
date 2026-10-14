import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Avatar, EmptyState, KindBadge } from '../components/visuals'
import { findMockProfile } from '../data/mockProfiles'
import { Icon } from '../lib/icons'
import { Link } from '../lib/router'
import { useApp } from '../store/AppStore'

function timeText(at: number): string {
  const d = new Date(at)
  return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
}

export function Chats({ id }: { id?: string }) {
  const { chats, typing, likes } = useApp()
  const threads = Object.entries(chats)
    .map(([pid, msgs]) => ({ profile: findMockProfile(pid), last: msgs[msgs.length - 1] }))
    .filter((t) => t.profile && t.last)
    .sort((a, b) => b.last.at - a.last.at)

  return (
    <div className={`page chats${id ? ' has-thread' : ''}`}>
      <div className="chat-banner">
        <Icon name="info" size={16} />
        <span>
          <b>데모 대화</b> — 상대는 모두 가상 프로필이고, 답장은 미리 준비된 문장으로 자동 생성돼요. 실제 사람에게 전송되지 않아요.
        </span>
      </div>

      <div className="chat-layout">
        <aside className="chat-list card">
          <h1>대화</h1>
          {threads.length === 0 ? (
            <div className="chat-empty">
              <p>아직 대화가 없어요.</p>
              <p className="muted small">추천 상세나 좋아요 목록에서 ‘데모 대화’를 눌러 시작해 보세요.</p>
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

        <section className="chat-room card">{id ? <Thread id={id} /> : <EmptyState icon="chat" title="대화를 선택해 주세요">왼쪽 목록에서 대화를 고르면 여기에서 이어져요.</EmptyState>}</section>
      </div>
    </div>
  )
}

function Thread({ id }: { id: string }) {
  const { chats, typing, sendMessage, startChat, recommendation } = useApp()
  const p = findMockProfile(id)
  const msgs = chats[id] ?? []
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  // 대화가 없는 상대로 바로 들어왔을 때 첫 인사를 만들어 둬요
  useEffect(() => {
    if (p && msgs.length === 0) startChat(id)
  }, [id, p, msgs.length, startChat])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs.length, typing[id]])

  if (!p) return <EmptyState icon="alert" title="대화 상대를 찾을 수 없어요" />

  const score = recommendation?.ranked.find((r) => r.profile.id === id)?.score.total

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    sendMessage(id, text)
    setText('')
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
        <KindBadge kind={p.kind} />
      </header>

      <div className="messages" aria-live="polite">
        <p className="day-note">가상 프로필과의 데모 대화예요</p>
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.from === 'me' ? 'is-me' : 'is-them'}`}>
            <div className="bubble">{m.text}</div>
            <small>
              {m.demo && <span className="auto">데모 자동 응답 · </span>}
              {timeText(m.at)}
            </small>
          </div>
        ))}
        {typing[id] && (
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
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`${p.nickname}님에게 메시지 (데모)`} aria-label="메시지 입력" maxLength={300} />
        <button className="btn btn-primary send" disabled={!text.trim()} aria-label="보내기">
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  )
}
