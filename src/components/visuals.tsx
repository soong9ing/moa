import type { ScoreKey } from '../matching'
import type { CategoryScore } from '../matching'
import type { ReactNode } from 'react'
import type { Profile } from '../types'
import { Icon } from '../lib/icons'

/** 점수 항목별 고정 색 — 링·막대·범례가 같은 색을 써요 */
export const CATEGORY_COLOR: Record<ScoreKey, string> = {
  age: 'var(--c-age)',
  personality: 'var(--c-personality)',
  hobbies: 'var(--c-hobbies)',
  music: 'var(--c-music)',
  travel: 'var(--c-travel)',
  religion: 'var(--c-religion)',
  style: 'var(--c-style)',
}

function hashHue(s: string): number {
  // FNV-1a + 마무리 섞기 — 비슷한 id(mock-01, mock-02)도 색이 고르게 퍼지도록
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  return (h >>> 0) % 360
}

/**
 * 사진 대신 쓰는 그래픽 아바타.
 * 실제 인물 사진을 쓰지 않도록, 닉네임으로 색과 모양을 정해 그려요.
 */
export function Avatar({ profile, size = 56 }: { profile: Pick<Profile, 'id' | 'nickname' | 'kind'>; size?: number }) {
  const hue = hashHue(profile.id)
  const hue2 = (hue + 40) % 360
  const initial = profile.nickname.trim().charAt(0) || '?'
  const gid = `g-${profile.id}`
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-label={`${profile.nickname} 아바타`}>
      <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${hue} 62% 82%)`} />
            <stop offset="1" stopColor={`hsl(${hue2} 55% 68%)`} />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="22" fill={`url(#${gid})`} />
        <circle cx={18 + (hue % 20)} cy="18" r="14" fill="#fff" opacity="0.22" />
        <circle cx="52" cy={44 + (hue % 10)} r="18" fill={`hsl(${hue2} 50% 45%)`} opacity="0.18" />
        <text x="32" y="41" textAnchor="middle" fontSize="24" fontWeight="700" fill={`hsl(${hue} 45% 22%)`} fontFamily="'Gowun Batang', serif">
          {initial}
        </text>
      </svg>
    </span>
  )
}

export function KindBadge({ kind }: { kind: Profile['kind'] }) {
  return kind === 'mock' ? (
    <span className="badge badge-mock" title="Moa가 만든 캐릭터 프로필이에요. 대화는 자동 답장으로 이어져요.">
      Moa 캐릭터
    </span>
  ) : (
    <span className="badge badge-user" title="로그인한 사용자 프로필">
      내 프로필
    </span>
  )
}

/**
 * 취향 링: 총점을 항목별 색으로 쌓아 원으로 보여 줘요.
 * 한 바퀴 = 점수표 총점(기본 100점)
 */
export function ScoreRing({
  categories,
  total,
  tableMax,
  size = 132,
  stroke = 12,
  label = '궁합 점수',
}: {
  categories: CategoryScore[]
  total: number
  tableMax: number
  size?: number
  stroke?: number
  label?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  const gap = 1.5
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${total}점 / ${tableMax}점`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {categories
          .filter((cat) => cat.earned > 0)
          .map((cat) => {
            const len = (cat.earned / tableMax) * c
            const seg = (
              <circle
                key={cat.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={CATEGORY_COLOR[cat.key]}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="ring-seg"
              />
            )
            offset += len
            return seg
          })}
      </svg>
      <div className="ring-center">
        <strong>{total}</strong>
        <span>/ {tableMax}</span>
      </div>
    </div>
  )
}

export function Chip({ children, tone = 'neutral', active = false }: { children: ReactNode; tone?: 'neutral' | 'match' | 'warn'; active?: boolean }) {
  return <span className={`chip chip-${tone}${active ? ' is-active' : ''}`}>{children}</span>
}

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`disclaimer${compact ? ' is-compact' : ''}`}>
      <Icon name="info" size={16} />
      <span>궁합 점수는 서로 설정한 취향을 비교한 결과일 뿐, 실제 관계의 성공을 보장하지 않아요.</span>
    </p>
  )
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h3>{title}</h3>
      {children && <div className="empty-body">{children}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}
