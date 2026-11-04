import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { adoptSharedLlm } from './services/llm'
import { IS_LIVE } from './services/backend'
import { seedDemoAccount } from './services/demoAccount'
import './styles.css'

// 공유 링크(?llm=…)로 들어오면 운영자의 LLM 주소를 저장하고, 주소창은 깔끔하게 정리해요
// 시연 링크(?demo=1)로 들어오면 로그인 없이 시연 계정으로 추천 화면을 열어요
const params = new URLSearchParams(window.location.search)
if (params.has('llm') || params.has('demo')) {
  if (params.has('llm')) adoptSharedLlm(window.location.search)
  let hash = window.location.hash
  if (params.has('demo') && !IS_LIVE) {
    seedDemoAccount()
    hash = '#/feed'
  }
  window.history.replaceState(null, '', window.location.pathname + hash)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
