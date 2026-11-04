import { useEffect, useRef, useState } from 'react'
import type { Recommendation, RankedCandidate } from '../matching'
import { Icon } from '../lib/icons'
import {
  LlmError,
  buildFacts,
  findUnsupportedNumbers,
  listModels,
  loadLlmSettings,
  saveLlmSettings,
  streamExplanation,
  type LlmSettings,
} from '../services/llm'
import type { Profile } from '../types'

type Status = 'idle' | 'loading' | 'done' | 'error'

/** "내 LLM이 설명하는 궁합" 카드 — 매칭이 끝난 상대에 대해 LLM에게 이유를 물어봐요 */
export function LlmExplain({ me, item, rec }: { me: Profile; item: RankedCandidate; rec: Recommendation }) {
  const [settings, setSettings] = useState<LlmSettings>(loadLlmSettings)
  const [status, setStatus] = useState<Status>('idle')
  const [text, setText] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<{ msg: string; kind: string } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // 다른 사람으로 넘어가면 이전 설명을 지워요
  useEffect(() => {
    abortRef.current?.abort()
    setStatus('idle')
    setText('')
    setError(null)
  }, [item.profile.id])
  useEffect(() => () => abortRef.current?.abort(), [])

  const facts = buildFacts(me, item, rec)
  const unsupported = status === 'done' ? findUnsupportedNumbers(text, facts) : []

  const run = async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStatus('loading')
    setText('')
    setError(null)
    try {
      const used = await streamExplanation(settings, facts, (t) => setText((prev) => prev + t), ctrl.signal)
      setModel(used)
      setStatus('done')
    } catch (e) {
      if (ctrl.signal.aborted) return
      setError({ msg: e instanceof Error ? e.message : '설명을 받지 못했어요.', kind: e instanceof LlmError ? e.kind : 'http' })
      setStatus('error')
    }
  }

  return (
    <section className="card llm">
      <header className="llm-head">
        <h3>
          <Icon name="sparkle" size={18} /> Moa의 한마디
        </h3>
        <button type="button" className="icon-btn" aria-label="LLM 연결 설정" aria-expanded={showSettings} onClick={() => setShowSettings((v) => !v)}>
          <Icon name="sliders" size={18} />
        </button>
      </header>

      {showSettings && (
        <LlmSettingsPanel
          value={settings}
          onSave={(s) => {
            setSettings(s)
            saveLlmSettings(s)
            setShowSettings(false)
          }}
        />
      )}

      {status === 'idle' && (
        <div className="llm-idle">
          <p className="muted">
            점수는 위의 점수표에 다 나와 있어요. 이번엔 두 사람을 다 아는 친구(겹지인)처럼, 내 LLM이 {item.profile.nickname}님을 소개해 줄 거예요.
          </p>
          <button type="button" className="btn btn-primary" onClick={run}>
            <Icon name="sparkle" size={18} /> 겹지인에게 소개받기
          </button>
        </div>
      )}

      {(status === 'loading' || status === 'done') && (
        <div className="llm-body" aria-live="polite">
          {text ? <p className="llm-text">{text}{status === 'loading' && <span className="llm-caret" />}</p> : <p className="muted">겹지인이 두 사람 이야기를 떠올리는 중…</p>}
          {status === 'loading' && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => { abortRef.current?.abort(); setStatus(text ? 'done' : 'idle') }}>
              멈추기
            </button>
          )}
        </div>
      )}

      {status === 'done' && (
        <>
          {unsupported.length > 0 && (
            <p className="llm-warn" role="alert">
              <Icon name="alert" size={16} /> LLM이 계산 결과에 없는 숫자({unsupported.join(', ')})를 말했어요. 점수는 위의 점수표를 기준으로 봐 주세요.
            </p>
          )}
          <div className="llm-foot">
            <span className="muted small">
              {model}이 쓴 소개예요 · 궁합 점수는 Moa 점수표로 계산돼요
            </span>
            <button type="button" className="btn btn-small btn-ghost" onClick={run}>
              <Icon name="refresh" size={16} /> 다른 말로 다시 듣기
            </button>
          </div>
        </>
      )}

      {status === 'error' && error && (
        <div className="llm-error" role="alert">
          <p>
            <Icon name="alert" size={16} /> {error.msg}
          </p>
          {error.kind === 'connect' && (
            <ul className="small">
              <li>
                내 컴퓨터에서 Ollama가 켜져 있는지 확인해 주세요. (주소: <code>{settings.baseUrl}</code>)
              </li>
              <li>
                배포된 사이트에서 쓰려면 Ollama에 <code>OLLAMA_ORIGINS</code> 설정이 필요해요. README의 "내 LLM 연결하기"를 참고해 주세요.
              </li>
              <li>브라우저가 "로컬 네트워크 접근"을 물어보면 허용을 눌러 주세요.</li>
            </ul>
          )}
          <div className="row-actions">
            <button type="button" className="btn btn-small btn-primary" onClick={run}>
              다시 시도
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setShowSettings(true)}>
              연결 설정 열기
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function LlmSettingsPanel({ value, onSave }: { value: LlmSettings; onSave: (s: LlmSettings) => void }) {
  const [baseUrl, setBaseUrl] = useState(value.baseUrl)
  const [model, setModel] = useState(value.model)
  const [models, setModels] = useState<string[] | null>(null)
  const [check, setCheck] = useState<string | null>(null)

  const test = async () => {
    setCheck('확인 중…')
    try {
      const list = await listModels({ baseUrl, model })
      setModels(list)
      setCheck(list.length ? `연결됐어요. 모델 ${list.length}개를 찾았어요.` : '연결됐지만 설치된 모델이 없어요.')
      if (!model && list[0]) setModel(list[0])
    } catch (e) {
      setModels(null)
      setCheck(e instanceof Error ? e.message : '연결하지 못했어요.')
    }
  }

  return (
    <div className="llm-settings">
      <label className="field">
        <span>Ollama 주소</span>
        <input id="llm-base" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:11434" />
      </label>
      <label className="field">
        <span>모델 이름 (기본: exaone3.5:2.4b)</span>
        {models && models.length > 0 ? (
          <select id="llm-model" value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <input id="llm-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="exaone3.5:2.4b" />
        )}
      </label>
      {check && <p className="small muted">{check}</p>}
      <div className="row-actions">
        <button type="button" className="btn btn-small btn-ghost" onClick={test}>
          연결 확인
        </button>
        <button type="button" className="btn btn-small btn-primary" onClick={() => onSave({ baseUrl: baseUrl.trim() || 'http://localhost:11434', model: model.trim() || 'exaone3.5:2.4b' })}>
          저장
        </button>
      </div>
    </div>
  )
}
