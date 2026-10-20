import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'

/**
 * 아주 작은 해시 라우터 (#/feed, #/match/mock-01 …)
 * 외부 라우터 없이도 GitHub Pages 같은 정적 호스팅에서 새로고침해도 깨지지 않아요.
 */

function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '')
  return h.startsWith('/') ? h : '/'
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const target = '#' + to
  if (opts.replace) {
    try {
      window.history.replaceState(null, '', target)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    } catch {
      window.location.hash = to // 일부 임베드 환경에서는 history API가 막혀 있어요
    }
  } else {
    window.location.hash = to
  }
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const on = () => {
      setPath(currentPath())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return path
}

/** '/match/:id' 같은 패턴과 경로를 비교해 파라미터를 돌려줘요. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean)
  const a = path.split('?')[0].split('/').filter(Boolean)
  if (p.length !== a.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i])
    else if (p[i] !== a[i]) return null
  }
  return params
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
  children: ReactNode
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
  }
  return (
    <a href={'#' + to} onClick={handle} {...rest}>
      {children}
    </a>
  )
}
