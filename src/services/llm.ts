import type { Recommendation, RankedCandidate } from '../matching'
import { josa } from '../lib/josa'
import type { Profile } from '../types'

/**
 * 내 LLM(Ollama)으로 "왜 이 사람과 궁합이 나왔는지"를 설명하는 기능.
 *
 * 역할 분담
 *  - 점수 계산·순위: Moa 매칭 알고리즘 (src/matching) — 정확성은 여기서 보장해요.
 *  - 설명 문장:      LLM — 계산 결과(사실 목록)만 받아서 자연스러운 말로 풀어 줘요.
 *  - 검증:           LLM 문장에 계산 결과에 없는 숫자가 나오면 화면에서 경고해요 (findUnsupportedNumbers).
 *
 * Ollama는 사용자의 컴퓨터(http://localhost:11434)에서 돌아가요.
 * 배포된 사이트에서 쓰려면 Ollama에 OLLAMA_ORIGINS 설정이 필요해요 (README 참고).
 */

// ---------- 설정 ----------

export interface LlmSettings {
  /** Ollama 주소 */
  baseUrl: string
  /** 사용할 모델 이름 (기본: qwen3:4b-instruct) */
  model: string
}

const SETTINGS_KEY = 'moa.v1.llm'
/** 기본 모델: 수경님이 만든 로컬 LLM (Ollama의 qwen3:4b-instruct) */
export const DEFAULT_MODEL = 'qwen3:4b-instruct'
export const DEFAULT_LLM: LlmSettings = { baseUrl: 'http://localhost:11434', model: DEFAULT_MODEL }

export function loadLlmSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const saved = raw ? (JSON.parse(raw) as Partial<LlmSettings>) : {}
    return { baseUrl: saved.baseUrl || DEFAULT_LLM.baseUrl, model: saved.model || DEFAULT_LLM.model }
  } catch {
    return { ...DEFAULT_LLM }
  }
}

export function saveLlmSettings(s: LlmSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* 저장이 막혀 있어도 이번 방문 동안은 동작 */
  }
}

const trimSlash = (u: string) => u.trim().replace(/\/+$/, '')

// ---------- 프롬프트 (순수 함수 — 테스트 가능) ----------

export const SYSTEM_PROMPT = [
  '너는 취향 기반 소개팅 앱 "Moa"의 궁합 설명 도우미야.',
  '사용자에게 왜 이 상대가 추천됐는지, 아래 [계산 결과]만 근거로 설명해.',
  '규칙:',
  '1. [계산 결과]에 있는 점수와 항목만 말해. 점수를 새로 계산하거나 바꾸거나 반올림하지 마.',
  '2. [계산 결과]에 없는 성격·외모·직업·사실을 지어내지 마.',
  '3. 0점이거나 미사용인 항목은 "겹치지 않았다"고 솔직하게 말해도 돼.',
  '4. 관계가 잘될 거라고 보장하거나 예언하지 마. 취향 비교 결과라는 점을 지켜.',
  '5. 한국어 존댓말(해요체)로, 4~6문장, 따뜻하고 담백하게. 목록이나 제목 없이 문단 하나로.',
].join('\n')

export interface ExplainFacts {
  me: string
  them: string
  rank: number
  total: number
  tableMax: number
  maxPossible: number
  candidates: number
  categories: { label: string; earned: number; max: number; used: boolean; matched: string[]; detail: string }[]
  /** 1위와 2위 비교처럼, 알고리즘이 이미 만든 근거 문장 */
  ruleBased: string[]
}

export function buildFacts(me: Profile, item: RankedCandidate, rec: Recommendation): ExplainFacts {
  const top = rec.top
  const ruleBased: string[] = []
  if (item.rank === 1) {
    const second = rec.ranked[1]
    if (second) {
      const gap = item.score.total - second.score.total
      ruleBased.push(
        gap > 0
          ? `2위 ${second.profile.nickname}(${second.score.total}점)보다 ${gap}점 높아 1위예요.`
          : `2위 ${josa(second.profile.nickname, '과', '와')} 같은 ${item.score.total}점이지만 정렬 규칙(공통 취미 수 → 닉네임 순)으로 1위예요.`,
      )
    } else {
      ruleBased.push('필수 조건을 통과한 후보가 이 한 명뿐이에요.')
    }
  } else if (top) {
    ruleBased.push(`1위 ${top.profile.nickname}(${top.score.total}점)보다 ${top.score.total - item.score.total}점 낮은 ${item.rank}위예요.`)
  }
  return {
    me: me.nickname,
    them: item.profile.nickname,
    rank: item.rank,
    total: item.score.total,
    tableMax: item.score.tableMax,
    maxPossible: item.score.maxPossible,
    candidates: rec.ranked.length,
    categories: item.score.categories.map((c) => ({
      label: c.label,
      earned: c.earned,
      max: c.max,
      used: c.used,
      matched: c.matched,
      detail: c.detail,
    })),
    ruleBased,
  }
}

export function buildUserPrompt(f: ExplainFacts): string {
  const lines = [
    '[계산 결과]',
    `- 사용자: ${f.me}`,
    `- 추천 상대: ${f.them}`,
    `- 순위: 필수 조건을 통과한 ${f.candidates}명 중 ${f.rank}위`,
    `- 총점: ${f.total}점 (점수표 전체 ${f.tableMax}점, 사용자가 설정한 항목 기준 최대 ${f.maxPossible}점)`,
    '- 항목별 점수:',
    ...f.categories.map((c) =>
      c.used
        ? `  · ${c.label}: ${c.earned}/${c.max}점${c.matched.length ? ` (겹친 것: ${c.matched.join(', ')})` : ''} — ${c.detail}`
        : `  · ${c.label}: 미사용 (사용자가 설정하지 않음)`,
    ),
    ...(f.ruleBased.length ? ['- 순위 근거:', ...f.ruleBased.map((r) => `  · ${r}`)] : []),
    '',
    `위 계산 결과만 근거로, ${f.me}님에게 ${f.them}님이 왜 이 순위로 추천됐는지 설명해 줘.`,
  ]
  return lines.join('\n')
}

/** 설명에 나와도 되는 숫자 (계산 결과에 실제로 있는 값) */
export function allowedNumbers(f: ExplainFacts): Set<number> {
  const nums = new Set<number>([f.rank, f.total, f.tableMax, f.maxPossible, f.candidates, 1, 2])
  for (const c of f.categories) {
    nums.add(c.earned)
    nums.add(c.max)
    nums.add(c.matched.length)
  }
  for (const r of f.ruleBased) for (const m of r.matchAll(/\d+/g)) nums.add(Number(m[0]))
  for (const c of f.categories) for (const m of c.detail.matchAll(/\d+/g)) nums.add(Number(m[0]))
  return nums
}

/**
 * LLM 문장에서 "점·위·명·개" 단위가 붙은 숫자 중 계산 결과에 없는 것을 찾아요.
 * (예: 실제 총점은 74점인데 "80점"이라고 쓰면 [80]을 돌려줘요)
 */
export function findUnsupportedNumbers(text: string, f: ExplainFacts): number[] {
  const allowed = allowedNumbers(f)
  const bad = new Set<number>()
  for (const m of text.matchAll(/(\d+)\s*(점|위|명|개)/g)) {
    const n = Number(m[1])
    if (!allowed.has(n)) bad.add(n)
  }
  return [...bad]
}

// ---------- Ollama 호출 ----------

export class LlmError extends Error {
  kind: 'connect' | 'model' | 'http'
  constructor(message: string, kind: 'connect' | 'model' | 'http') {
    super(message)
    this.kind = kind
  }
}

/** 설치된 모델 목록 (연결 확인용) */
export async function listModels(s: LlmSettings): Promise<string[]> {
  let res: Response
  try {
    res = await fetch(`${trimSlash(s.baseUrl)}/api/tags`)
  } catch {
    throw new LlmError('내 LLM(Ollama)에 연결할 수 없어요.', 'connect')
  }
  if (!res.ok) throw new LlmError(`Ollama가 오류를 돌려줬어요 (${res.status}).`, 'http')
  const json = (await res.json()) as { models?: { name: string }[] }
  return (json.models ?? []).map((m) => m.name)
}

/**
 * 설명을 받아요. 글자가 생기는 대로 onToken으로 넘겨줘서 화면에 바로 써 내려가요.
 * 반환값: 실제로 쓴 모델 이름
 */
export async function streamExplanation(
  s: LlmSettings,
  facts: ExplainFacts,
  onToken: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let model = s.model.trim()
  if (!model) {
    const models = await listModels(s)
    if (models.length === 0) throw new LlmError('Ollama에 설치된 모델이 없어요. 터미널에서 ollama pull 로 모델을 먼저 받아 주세요.', 'model')
    model = models[0]
  }
  let res: Response
  try {
    res = await fetch(`${trimSlash(s.baseUrl)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        stream: true,
        // 4B 모델이 빨리 끝내도록 답 길이를 제한해요 (4~6문장이면 충분)
        options: { temperature: 0.3, num_predict: 360 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(facts) },
        ],
      }),
    })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new LlmError('내 LLM(Ollama)에 연결할 수 없어요.', 'connect')
  }
  if (res.status === 404) throw new LlmError(`'${model}' 모델을 찾을 수 없어요. 설정에서 모델 이름을 확인해 주세요.`, 'model')
  if (!res.ok || !res.body) throw new LlmError(`Ollama가 오류를 돌려줬어요 (${res.status}).`, 'http')

  // Ollama는 한 줄에 JSON 하나씩(NDJSON) 보내요
  // qwen3 계열이 <think>…</think> 생각 과정을 내보내면 화면에는 빼고 보여 줘요
  const think = new ThinkFilter()
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      const msg = JSON.parse(line) as { message?: { content?: string }; error?: string }
      if (msg.error) throw new LlmError(msg.error, 'http')
      if (msg.message?.content) {
        const visible = think.push(msg.message.content)
        if (visible) onToken(visible)
      }
    }
  }
  const rest = think.flush()
  if (rest) onToken(rest)
  return model
}

/**
 * 스트림으로 들어오는 글에서 <think>…</think> 부분을 걸러 내요.
 * 태그가 조각조각 나뉘어 들어와도 처리할 수 있게 상태를 기억해요.
 */
export class ThinkFilter {
  private inThink = false
  private pending = ''

  /** 스트림이 끝났을 때 남아 있던 글자를 내보내요 (생각 과정 안이면 버려요) */
  flush(): string {
    const rest = this.inThink ? '' : this.pending
    this.pending = ''
    return rest
  }

  push(chunk: string): string {
    let text = this.pending + chunk
    this.pending = ''
    let out = ''
    for (;;) {
      if (this.inThink) {
        const end = text.indexOf('</think>')
        if (end < 0) {
          // 닫는 태그가 조각나서 들어올 수 있으니 끝부분은 남겨 둬요
          this.pending = text.slice(-8)
          return out
        }
        text = text.slice(end + '</think>'.length)
        this.inThink = false
        text = text.replace(/^\s+/, '')
      } else {
        const start = text.indexOf('<think>')
        if (start < 0) {
          // "<thi" 처럼 여는 태그가 잘려 들어온 경우를 대비해요
          const cut = text.lastIndexOf('<')
          if (cut >= 0 && '<think>'.startsWith(text.slice(cut))) {
            this.pending = text.slice(cut)
            return out + text.slice(0, cut)
          }
          return out + text
        }
        out += text.slice(0, start)
        text = text.slice(start + '<think>'.length)
        this.inThink = true
      }
    }
  }
}
