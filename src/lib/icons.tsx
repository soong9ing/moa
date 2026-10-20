import type { SVGProps } from 'react'

/** 외부 라이브러리 없이 쓰는 선(line) 아이콘 모음. 24×24 그리드, stroke 1.8 */
export type IconName =
  | 'home'
  | 'compass'
  | 'heart'
  | 'heartFill'
  | 'chat'
  | 'user'
  | 'sliders'
  | 'send'
  | 'back'
  | 'chevron'
  | 'info'
  | 'close'
  | 'check'
  | 'logout'
  | 'sparkle'
  | 'filter'
  | 'alert'
  | 'trophy'
  | 'shield'
  | 'plus'
  | 'refresh'
  | 'more'
  | 'block'

const paths: Record<IconName, string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V20h14V9.5', 'M10 20v-5h4v5'],
  compass: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'm15.5 8.5-2 5-5 2 2-5 5-2Z'],
  heart: ['M12 20s-7.5-4.6-9-9.3C2 7.4 4.2 4.5 7.3 4.5c2 0 3.5 1.1 4.7 2.8 1.2-1.7 2.7-2.8 4.7-2.8 3.1 0 5.3 2.9 4.3 6.2C19.5 15.4 12 20 12 20Z'],
  heartFill: ['M12 20s-7.5-4.6-9-9.3C2 7.4 4.2 4.5 7.3 4.5c2 0 3.5 1.1 4.7 2.8 1.2-1.7 2.7-2.8 4.7-2.8 3.1 0 5.3 2.9 4.3 6.2C19.5 15.4 12 20 12 20Z'],
  chat: ['M4 5.5h16v10H9l-5 4v-14Z', 'M8 9.5h8', 'M8 12.5h5'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 20.5c1.2-3.7 4.3-5.5 8-5.5s6.8 1.8 8 5.5'],
  sliders: ['M4 7h10', 'M18 7h2', 'M16 5v4', 'M4 17h4', 'M12 17h8', 'M10 15v4'],
  send: ['M4 12 20 4l-6 16-3-7-7-1Z', 'm11 13 9-9'],
  back: ['M15 5l-7 7 7 7'],
  chevron: ['M9 5l7 7-7 7'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 11v5', 'M12 8h.01'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  logout: ['M10 4H5v16h5', 'M15 8l4 4-4 4', 'M19 12H9'],
  sparkle: ['M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z', 'M19 16c.2 1.4.9 2.1 2 2.3-1.1.2-1.8.9-2 2.2-.2-1.3-.9-2-2-2.2 1.1-.2 1.8-.9 2-2.3Z'],
  filter: ['M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z'],
  alert: ['M12 3.5 2.5 20h19L12 3.5Z', 'M12 10v4.5', 'M12 17.2h.01'],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0V4Z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8.5 20h7', 'M10 17h4v3h-4z'],
  shield: ['M12 3 5 6v5.5c0 4.5 3 7.8 7 9.5 4-1.7 7-5 7-9.5V6l-7-3Z', 'm9 12 2 2 4-4'],
  plus: ['M12 5v14', 'M5 12h14'],
  more: ['M3.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0', 'M10.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0', 'M17.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0'],
  block: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M5.6 5.6l12.8 12.8'],
  refresh: ['M20 11a8 8 0 0 0-14.7-3.5', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.7 3.5', 'M20 20v-4h-4'],
}

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  const filled = name === 'heartFill'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
