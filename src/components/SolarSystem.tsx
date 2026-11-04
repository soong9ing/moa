import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Profile } from '../types'
import { Avatar } from './visuals'

/**
 * 첫 화면의 "취향 태양계".
 * 가운데 태양 = 현재 가입자 수 (live: 서버의 실제 가입자 수 / demo: 주위를 도는 프로필 수), 0부터 차오르는 숫자
 * 주위를 도는 행성 = Moa에 있는 모든 프로필(닉네임 첫 글자 아바타).
 *
 * 궤도 3개가 서로 다른 속도·방향으로 돌고, 행성은 늘 똑바로 서 있도록
 * 궤도 회전과 반대로 같은 속도로 돌아요.
 */

interface Orbit {
  /** 태양계 지름 대비 궤도 반지름 (0~0.5) */
  r: number
  /** 한 바퀴 도는 데 걸리는 시간(초) */
  period: number
  /** 시계 반대 방향이면 true */
  reverse: boolean
  /** 행성 크기 (태양계 지름 대비) */
  size: number
}

const ORBITS: Orbit[] = [
  { r: 0.255, period: 46, reverse: false, size: 0.074 },
  { r: 0.36, period: 72, reverse: true, size: 0.066 },
  { r: 0.465, period: 110, reverse: false, size: 0.06 },
]

/** 궤도 둘레에 비례해 행성을 나눠 담아요 (안쪽 궤도에 사용자 본인을 먼저) */
function distribute<T>(items: T[]): T[][] {
  const total = ORBITS.reduce((s, o) => s + o.r, 0)
  const rings: T[][] = ORBITS.map(() => [])
  let i = 0
  ORBITS.forEach((o, k) => {
    const n = k === ORBITS.length - 1 ? items.length - i : Math.round((items.length * o.r) / total)
    rings[k] = items.slice(i, i + n)
    i += n
  })
  return rings
}

/** 숫자가 0(또는 이전 값)에서 목표값까지 점점 차오르는 효과 */
function CountUp({ value, duration = 1400 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const begin = from.current ?? 0
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // 처음엔 빠르게, 끝에서 천천히
      const v = Math.round(begin + (value - begin) * eased)
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <span className="count-up">{shown}</span>
}

export function SolarSystem({ profiles, me, count }: { profiles: Profile[]; me?: Profile | null; count?: number }) {
  const planets: { p: Pick<Profile, 'id' | 'nickname' | 'kind'>; mine: boolean }[] = [
    ...(me ? [{ p: me, mine: true }] : []),
    ...profiles.map((p) => ({ p, mine: false })),
  ]
  const rings = distribute(planets)

  return (
    <div className="solar" aria-hidden="true">
      {ORBITS.map((o, k) => (
        <div
          key={k}
          className={`solar-ring${o.reverse ? ' is-reverse' : ''}`}
          style={{ '--r': o.r, '--period': `${o.period}s`, '--ps': o.size } as CSSProperties}
        >
          {rings[k].map(({ p, mine }, i) => {
            const angle = (360 / rings[k].length) * i + k * 17
            return (
              <span key={p.id} className={`planet${mine ? ' is-me' : ''}`} style={{ '--a': `${angle}deg` } as CSSProperties} title={p.nickname}>
                <span className="planet-body">
                  <Avatar profile={p} size={40} letterOnly />
                </span>
              </span>
            )
          })}
        </div>
      ))}

      <div className="sun">
        <div className="sun-glow" />
        <div className="sun-core">
          <span>현재 가입자 수</span>
          <strong>
            <CountUp value={count ?? planets.length} />
          </strong>
        </div>
      </div>
    </div>
  )
}
