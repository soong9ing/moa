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

/**
 * 말투: 두 사람을 다 아는 '겹지인'이 내 친구에게 상대를 소개해 주는 느낌.
 * 점수표는 화면에 이미 있으니, LLM은 숫자 대신 "겹치는 취향이 데이트에서 어떤 장면이 될지"를 상상해서 말해요.
 */
export function systemPrompt(f: ExplainFacts): string {
  return [
    `너는 소개팅 앱 Moa에서 두 사람을 이어 주는 '겹지인'이야. ${f.me}의 친구이면서 ${f.them}의 친구이기도 해.`,
    `지금 ${f.me}에게 ${josa(f.them, '을', '를')} 소개해 주는 중이야. 친한 친구에게 말하듯 반말로, 설레고 다정하게 말해.`,
    '',
    '이렇게 말해:',
    '- [두 사람 정보]의 "겹치는 점"을 골라, 그게 데이트나 연애에서 어떤 장면이 될지 구체적으로 상상해서 말해. (예: 둘 다 계획형 → 약속 잡을 때부터 척척)',
    '- "다른 점"이 있으면 하나만 골라 긍정적으로 짚어 줘. (예: 서로의 새로운 매력을 발견하는 재미)',
    '- 3~4문장, 문단 하나. 느낌표나 물결(~)을 자연스럽게 써도 좋아.',
    '',
    '절대 하지 마:',
    '- 점수, 순위, 몇 점, 몇 위 같은 숫자 이야기 (점수표는 화면에 이미 있어)',
    '- [두 사람 정보]에 없는 사실 지어내기 (직업, 외모, 사는 곳, 과거 이야기 등)',
    '- "무조건 잘될 거야"처럼 관계를 장담하기',
    '- 목록, 제목, 따옴표로 감싸기, 영어 섞기',
    '',
    '말투 예시 (내용은 따라 하지 말고 말투만 참고해):',
    '"둘 다 계획적인 성향이라 데이트 약속 잡을 때부터 척척 잘 맞을 것 같아! 드라마, 영화, 산책, 요리까지 공통 취미도 많아서 함께할 일이 끊이지 않겠는데? 다만 성격 유형과 음악 취향은 조금 다르니까, 서로의 새로운 매력을 발견하는 재미도 있을 거야~"',
  ].join('\n')
}

export interface PersonSide {
  personality: string[]
  hobbies: string[]
  music: string[]
  travel: string | null
}

export interface ExplainFacts {
  me: string
  them: string
  rank: number
  total: number
  tableMax: number
  maxPossible: number
  candidates: number
  categories: { label: string; earned: number; max: number; used: boolean; matched: string[]; detail: string }[]
  /** 1위와 2위 비교처럼, 알고리즘이 이미 만든 근거 문장 (숫자 검사용) */
  ruleBased: string[]
  mine: PersonSide
  theirs: PersonSide & { age: number; tagline: string; bio: string; styles: string[] }
  /** 겹치는 점 (사람이 읽는 문장) */
  same: string[]
  /** 다른 점 (사람이 읽는 문장) */
  different: string[]
}

const only = (a: readonly string[], b: readonly string[]) => a.filter((x) => !b.includes(x))
const both = (a: readonly string[], b: readonly string[]) => a.filter((x) => b.includes(x))

export function buildFacts(me: Profile, item: RankedCandidate, rec: Recommendation): ExplainFacts {
  const p = item.profile
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

  // 겹치는 점 / 다른 점 — 점수 계산과 같은 데이터에서 뽑아요
  const cat = (key: string) => item.score.categories.find((c) => c.key === key)
  const same: string[] = []
  const different: string[] = []
  const sharedHobby = both(me.hobbies, p.hobbies)
  const sharedMusic = both(me.music, p.music)
  const sharedPers = both(me.personality, p.personality)
  if (sharedHobby.length) same.push(`공통 취미: ${sharedHobby.join(', ')}`)
  if (sharedMusic.length) same.push(`같이 좋아하는 음악: ${sharedMusic.join(', ')}`)
  if (sharedPers.length) same.push(`둘 다 이런 성격: ${sharedPers.join(', ')}`)
  if (me.travel && p.travel === me.travel) same.push(`여행 스타일: 둘 다 ${me.travel}`)
  if (cat('religion')?.earned) same.push(`종교: ${josa(me.nickname, '이', '가')} 바라는 종교(${p.religion})와 같음`)
  if (cat('style')?.earned) same.push(`스타일: ${josa(me.nickname, '이', '가')} 좋아하는 스타일(${cat('style')!.matched.join(', ')})과 같음`)
  if (cat('age')?.earned) same.push(`나이: ${josa(me.nickname, '이', '가')} 바라는 나이대에 맞음`)

  const myPersOnly = only(me.personality, p.personality)
  const theirPersOnly = only(p.personality, me.personality)
  if (theirPersOnly.length && myPersOnly.length) different.push(`성격: ${josa(me.nickname, '은', '는')} ${myPersOnly.join('·')}, ${josa(p.nickname, '은', '는')} ${theirPersOnly.join('·')}`)
  const theirMusicOnly = only(p.music, me.music)
  if (theirMusicOnly.length && me.music.length) different.push(`음악: ${josa(p.nickname, '은', '는')} ${theirMusicOnly.join('·')}도 좋아함`)
  const theirHobbyOnly = only(p.hobbies, me.hobbies)
  if (theirHobbyOnly.length) different.push(`취미: ${p.nickname}만의 취미는 ${theirHobbyOnly.join('·')}`)
  if (me.travel && p.travel && p.travel !== me.travel) different.push(`여행: ${josa(me.nickname, '은', '는')} ${me.travel}, ${josa(p.nickname, '은', '는')} ${p.travel}`)

  return {
    me: me.nickname,
    them: p.nickname,
    rank: item.rank,
    total: item.score.total,
    tableMax: item.score.tableMax,
    maxPossible: item.score.maxPossible,
    candidates: rec.ranked.length,
    categories: item.score.categories.map((c) => ({ label: c.label, earned: c.earned, max: c.max, used: c.used, matched: c.matched, detail: c.detail })),
    ruleBased,
    mine: { personality: me.personality, hobbies: me.hobbies, music: me.music, travel: me.travel },
    theirs: {
      personality: p.personality,
      hobbies: p.hobbies,
      music: p.music,
      travel: p.travel,
      age: p.age,
      tagline: p.tagline ?? '',
      bio: p.bio,
      styles: p.styles,
    },
    same,
    different,
  }
}

export function buildUserPrompt(f: ExplainFacts): string {
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : '없음')
  return [
    '[두 사람 정보]',
    `${f.me} (내 친구)`,
    `- 성격: ${list(f.mine.personality)} / 취미: ${list(f.mine.hobbies)} / 음악: ${list(f.mine.music)} / 여행: ${f.mine.travel ?? '모름'}`,
    `${f.them} (소개해 줄 사람)`,
    `- 한 줄 소개: ${f.theirs.tagline || '없음'}`,
    `- 자기소개: ${f.theirs.bio || '없음'}`,
    `- 성격: ${list(f.theirs.personality)} / 취미: ${list(f.theirs.hobbies)} / 음악: ${list(f.theirs.music)} / 여행: ${f.theirs.travel ?? '모름'} / 스타일: ${list(f.theirs.styles)}`,
    '',
    '겹치는 점:',
    ...(f.same.length ? f.same.map((x) => `- ${x}`) : ['- 크게 겹치는 건 없음']),
    '다른 점:',
    ...(f.different.length ? f.different.map((x) => `- ${x}`) : ['- 크게 다른 건 없음']),
    '',
    `위 정보만 가지고, 겹지인으로서 ${f.me}에게 ${josa(f.them, '을', '를')} 소개해 줘.`,
  ].join('\n')
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
        // 겹지인 말투는 조금 더 자유롭게(0.7), 3~4문장이면 충분해서 길이는 짧게 제한해요
        options: { temperature: 0.7, num_predict: 280 },
        messages: [
          { role: 'system', content: systemPrompt(facts) },
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
