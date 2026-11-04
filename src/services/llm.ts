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
/**
 * 기본 모델: 한국어·영어용 EXAONE 3.5 (2.4B, LG AI연구원).
 * 설치돼 있지 않으면 예전 모델 qwen3:4b-instruct로, 그것도 없으면 설치된 첫 모델로 대신해요.
 */
export const DEFAULT_MODEL = 'exaone3.5:2.4b'
export const FALLBACK_MODEL = 'qwen3:4b-instruct'
export const DEFAULT_LLM: LlmSettings = { baseUrl: 'http://localhost:11434', model: DEFAULT_MODEL }

export function loadLlmSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const saved = raw ? (JSON.parse(raw) as Partial<LlmSettings>) : {}
    // 예전 기본값(qwen3)이 저장돼 있으면 새 기본값(EXAONE)으로 바꿔요. 직접 고른 다른 모델은 그대로 둬요.
    const model = !saved.model || saved.model === FALLBACK_MODEL ? DEFAULT_LLM.model : saved.model
    return { baseUrl: saved.baseUrl || DEFAULT_LLM.baseUrl, model }
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

// ---------- 공유 링크로 운영자 LLM 쓰기 ----------

/**
 * 공유 링크(?llm=…)로 받을 수 있는 주소인지 확인해요.
 * 남이 만든 링크로 내 정보가 엉뚱한 서버에 가지 않도록,
 * Cloudflare 임시 주소(https://*.trycloudflare.com)와 내 컴퓨터 주소만 받아요.
 */
export function isAllowedLlmUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.username || u.password || u.search || u.hash) return false
  if (u.pathname !== '/' && u.pathname !== '') return false
  if (u.protocol === 'https:' && /^[a-z0-9-]+\.trycloudflare\.com$/.test(u.hostname)) return true
  if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true
  return false
}

/** 내 컴퓨터가 아닌 곳(운영자 컴퓨터)의 LLM을 쓰는 중인지 */
export function isRemoteLlm(baseUrl: string): boolean {
  try {
    const h = new URL(baseUrl).hostname
    return h !== 'localhost' && h !== '127.0.0.1'
  } catch {
    return false
  }
}

/**
 * 주소창의 ?llm=… 을 읽어 LLM 주소로 저장해요.
 * 받아들였으면 그 주소를, 아니면 null을 돌려줘요.
 */
export function adoptSharedLlm(search: string): string | null {
  const raw = new URLSearchParams(search).get('llm')
  if (!raw) return null
  const url = trimSlash(raw)
  if (!isAllowedLlmUrl(url)) return null
  const cur = loadLlmSettings()
  saveLlmSettings({ ...cur, baseUrl: url })
  return url
}

// ---------- 프롬프트 (순수 함수 — 테스트 가능) ----------

/**
 * 말투: 두 사람을 다 아는 '겹지인'이 내 친구에게 상대를 소개해 주는 느낌.
 * 점수표는 화면에 이미 있으니, LLM은 숫자 대신 "겹치는 취향이 데이트에서 어떤 장면이 될지"를 상상해서 말해요.
 */
export function systemPrompt(f: ExplainFacts): string {
  const me = f.me
  const them = f.them
  return [
    `너는 소개팅 앱 Moa야. ${josa(me, '과', '와')} ${josa(them, '을', '를')} 둘 다 아는 친구처럼, 두 사람이 왜 잘 어울리는지 옆에서 전해 주는 역할이야.`,
    `너는 두 사람 중 누구도 아니야. 제3자로서 두 사람을 "두 사람은", "${josa(me, '은', '는')}", "${josa(them, '은', '는')}"처럼 이름으로 불러.`,
    '',
    '규칙:',
    '- 딱 3문장. 반말. 친구에게 카톡 보내듯 자연스럽게.',
    `- 첫 문장은 반드시 "두 사람은"으로 시작해.`,
    '- "우리", "나", "너", "너의", "나에게", "같이 하자", "보자" 같은 말은 절대 쓰지 마. 두 사람에게 직접 말을 걸지도 마.',
    '- 1문장: [말할 거리] 1번을 [데이트 장면]과 엮어서 말해.',
    '- 2문장: [말할 거리] 2번을 [데이트 장면]과 엮어서 말해.',
    '- 3문장: [말할 거리] 3번(다른 점)을 "서로 새로운 매력을 알아 가는 재미" 같은 느낌으로 가볍게 말해. 3번이 없으면 기대된다는 말로 마무리해.',
    '- [말할 거리]에 없는 내용은 절대 말하지 마. 숫자, 점수, 순위도 말하지 마.',
    '- 같은 말을 반복하지 마. 목록·제목·따옴표 없이 문장만 써.',
    '',
    '예시)',
    '[말할 거리]',
    '1. 둘 다 계획형 여행 → 데이트 장면: 약속 잡을 때부터 척척 맞음',
    '2. 공통 취미: 드라마, 영화, 산책, 요리 → 데이트 장면: 같이 영화 보고 동네 산책하기',
    `3. 다른 점: ${josa(me, '은', '는')} 차분하고 ${josa(them, '은', '는')} 활발함`,
    '[소개]',
    `두 사람은 둘 다 계획적인 성향이라 데이트 약속 잡을 때부터 척척 잘 맞을 것 같아! 드라마, 영화, 산책, 요리까지 공통 취미도 많아서, 함께 영화 보고 동네를 산책하다 보면 할 얘기가 끊이지 않겠는데? 다만 ${josa(me, '은', '는')} 차분하고 ${josa(them, '은', '는')} 활발한 편이라, 서로의 새로운 매력을 발견하는 재미도 있을 거야~`,
  ].join('\n')
}

/**
 * LLM이 제3자가 아니라 당사자처럼 말했는지 찾아요. ("우리 둘", "너의", "나에게", "~하자" 등)
 * 찾으면 화면에서 한 번 다시 써 달라고 해요.
 */
export function speaksAsParticipant(text: string): boolean {
  const t = text.replace(/\s+/g, ' ')
  return /(^|[\s,.!?~])(우리|저희|나는|내가|나도|나에게|나랑|나한테|너는|네가|너도|너의|너에게|너랑|너한테|당신)(?=[\s,.!?~]|$)|우리\s?둘|[가-힣](자|보자|할래)[!?.~]/.test(t)
}

/** 취향별로 떠올리기 쉬운 데이트 장면 (작은 모델이 억지로 지어내지 않도록 미리 줘요) */
const HOBBY_SCENE: Record<string, string> = {
  운동: '같이 운동하고 맛있는 거 먹기',
  드라마: '드라마 같이 정주행하며 수다 떨기',
  독서: '북카페에서 각자 책 읽다가 얘기 나누기',
  게임: '같이 게임하면서 티격태격하기',
  사진: '서로 사진 찍어 주며 걷기',
  그림: '전시회 보러 가기',
  요리: '같이 장 보고 요리해 먹기',
  산책: '동네 산책하며 이야기하기',
  영화: '영화 보고 나와서 감상 나누기',
  캠핑: '캠핑 가서 불멍하기',
}
const PERSONALITY_SCENE: Record<string, string> = {
  외향적: '처음 만나도 어색할 틈이 없음',
  내향적: '조용한 곳에서 편하게 오래 대화함',
  다정함: '서로 잘 챙겨 줌',
  차분함: '함께 있으면 편안함',
  유머러스: '대화하면 웃음이 끊이지 않음',
  솔직함: '오해 없이 마음을 잘 표현함',
  감성적: '같은 장면에서 같이 감동받음',
  이성적: '고민을 차분하게 같이 풀어 감',
  열정적: '하고 싶은 걸 같이 신나게 해 봄',
}
/** 성격 단어를 꾸미는 말로 (차분함 → 차분한) */
const PERS_ADJ: Record<string, string> = {
  외향적: '외향적인', 내향적: '내향적인', 다정함: '다정한', 차분함: '차분한', 유머러스: '유머러스한',
  솔직함: '솔직한', 감성적: '감성적인', 이성적: '이성적인', 열정적: '열정적인',
}
const TRAVEL_SCENE: Record<string, string> = {
  계획형: '데이트 약속 잡을 때부터 척척 맞음',
  즉흥형: '갑자기 떠나는 여행도 둘 다 신나 함',
}

/**
 * LLM이 말할 거리를 코드가 미리 골라요 (최대 3개: 겹치는 점 2개 + 다른 점 1개).
 * 작은 모델은 고를 게 많으면 두서없어지기 때문에, 순서와 장면까지 정해서 줘요.
 */
export function talkingPoints(f: ExplainFacts): string[] {
  const sameHobby = f.mine.hobbies.filter((h) => f.theirs.hobbies.includes(h))
  const sameMusic = f.mine.music.filter((m) => f.theirs.music.includes(m))
  const samePers = f.mine.personality.filter((x) => f.theirs.personality.includes(x))
  const candidates: string[] = []
  if (sameHobby.length) {
    const scenes = sameHobby.slice(0, 2).map((h) => HOBBY_SCENE[h] ?? `${h} 같이 하기`)
    candidates.push(`공통 취미: ${sameHobby.join(', ')} → 데이트 장면: ${scenes.join(', ')}`)
  }
  if (f.mine.travel && f.theirs.travel === f.mine.travel) {
    candidates.push(`둘 다 ${f.mine.travel} 여행 → 데이트 장면: ${TRAVEL_SCENE[f.mine.travel] ?? '여행 스타일이 잘 맞음'}`)
  }
  if (samePers.length) {
    candidates.push(`둘 다 ${samePers.join('·')} 성격 → 데이트 장면: ${PERSONALITY_SCENE[samePers[0]] ?? '대화가 잘 통함'}`)
  }
  if (sameMusic.length) {
    candidates.push(`같이 좋아하는 음악: ${sameMusic.join(', ')} → 데이트 장면: 드라이브하며 같은 노래 듣기`)
  }
  const points = candidates.slice(0, 2)
  if (points.length === 0) points.push('겹치는 취향은 많지 않음 → 데이트 장면: 서로 몰랐던 세계를 소개해 주기')

  // 다른 점 하나
  const diffPers = f.theirs.personality.filter((x) => !f.mine.personality.includes(x))
  const diffMusic = f.theirs.music.filter((x) => !f.mine.music.includes(x))
  const diffTravel = f.mine.travel && f.theirs.travel && f.mine.travel !== f.theirs.travel
  let diff: string | null = null
  if (diffTravel) diff = `다른 점: ${josa(f.me, '은', '는')} ${f.mine.travel}, ${josa(f.them, '은', '는')} ${f.theirs.travel} 여행 스타일`
  else if (diffPers.length) diff = `다른 점: ${josa(f.them, '은', '는')} ${PERS_ADJ[diffPers[0]] ?? diffPers[0]} 면이 있음`
  else if (diffMusic.length) diff = `다른 점: ${josa(f.them, '은', '는')} ${diffMusic.join('·')}도 좋아함`
  if (diff) points.push(diff)
  return points.map((p, i) => `${i + 1}. ${p}`)
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
  return [
    `${f.them}의 한 줄 소개: ${f.theirs.tagline || '없음'}`,
    '[말할 거리]',
    ...talkingPoints(f),
    '[소개]',
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
  kind: 'connect' | 'model' | 'http' | 'busy'
  constructor(message: string, kind: 'connect' | 'model' | 'http' | 'busy') {
    super(message)
    this.kind = kind
  }
}

/** 실제로 쓸 모델을 골라요: 설정한 모델 → (기본 모델이 없으면) qwen3 → 설치된 첫 모델 */
export async function pickModel(s: LlmSettings): Promise<string> {
  const wanted = s.model.trim()
  if (wanted && wanted !== DEFAULT_MODEL) return wanted
  const models = await listModels(s)
  const has = (name: string) => models.find((m) => m === name || m === `${name}:latest` || m.startsWith(`${name}-`))
  const found = has(DEFAULT_MODEL) ?? has(FALLBACK_MODEL) ?? models[0]
  if (!found) throw new LlmError('Ollama에 설치된 모델이 없어요. Moa_LLM_켜기.bat을 다시 실행하면 모델을 받아 와요.', 'model')
  return found
}

/** 운영자 LLM(공유 서버)이 돌려주는 상태 코드를 알기 쉬운 말로 바꿔요 */
function checkStatus(res: Response, s: LlmSettings) {
  if (res.ok) return
  if (res.status === 429) throw new LlmError('지금 Moa에게 소개를 부탁한 사람이 많아요. 1분쯤 뒤에 다시 눌러 주세요.', 'busy')
  if (isRemoteLlm(s.baseUrl) && (res.status === 502 || res.status === 503 || res.status === 530))
    throw new LlmError('Moa의 LLM이 지금 꺼져 있어요.', 'connect')
  if (res.status !== 404) throw new LlmError(`LLM이 오류를 돌려줬어요 (${res.status}).`, 'http')
}

/** 설치된 모델 목록 (연결 확인용) */
export async function listModels(s: LlmSettings): Promise<string[]> {
  let res: Response
  try {
    res = await fetch(`${trimSlash(s.baseUrl)}/api/tags`)
  } catch {
    throw new LlmError(isRemoteLlm(s.baseUrl) ? 'Moa의 LLM에 연결할 수 없어요.' : '내 LLM(Ollama)에 연결할 수 없어요.', 'connect')
  }
  if (res.status === 404) throw new LlmError('LLM 주소가 맞는지 확인해 주세요 (404).', 'http')
  checkStatus(res, s)
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
  const model = await pickModel(s)
  let res: Response
  try {
    res = await fetch(`${trimSlash(s.baseUrl)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        stream: true,
        // 3문장이면 충분해서 짧게 제한하고, 같은 말 반복을 줄여요
        options: { temperature: 0.5, num_predict: 220, repeat_penalty: 1.15 },
        messages: [
          { role: 'system', content: systemPrompt(facts) },
          { role: 'user', content: buildUserPrompt(facts) },
        ],
      }),
    })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new LlmError(isRemoteLlm(s.baseUrl) ? 'Moa의 LLM에 연결할 수 없어요.' : '내 LLM(Ollama)에 연결할 수 없어요.', 'connect')
  }
  if (res.status === 404) throw new LlmError(`'${model}' 모델을 찾을 수 없어요. 설정에서 모델 이름을 확인해 주세요.`, 'model')
  checkStatus(res, s)
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
