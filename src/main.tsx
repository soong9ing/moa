import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { adoptSharedLlm } from './services/llm'
import './styles.css'

// 공유 링크(?llm=…)로 들어오면 운영자의 LLM 주소를 저장하고, 주소창은 깔끔하게 정리해요
if (new URLSearchParams(window.location.search).has('llm')) {
  adoptSharedLlm(window.location.search)
  window.history.replaceState(null, '', window.location.pathname + window.location.hash)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
