import { describe, expect, it } from 'vitest'
import { MOCK_PROFILES } from '../data/mockProfiles'
import { recommend } from '../matching'
import { EMPTY_PREFERENCES, type Profile } from '../types'
import { LlmError, ThinkFilter, buildFacts, buildUserPrompt, findUnsupportedNumbers, isAllowedLlmUrl, isRemoteLlm, listModels, pickModel, systemPrompt, talkingPoints } from './llm'

const me: Profile = {
  id: 'user-me',
  kind: 'user',
  nickname: '수경',
  age: 24,
  height: 165,
  bio: '',
  gender: '여성',
  personality: ['내향적', '다정함', '감성적'],
  hobbies: ['사진', '산책', '독서', '영화', '그림'],
  music: ['발라드', '재즈', '팝', '클래식'],
  travel: '계획형',
  styles: [],
  religion: null,
  income: null,
}
const rec = recommend(me, { ...EMPTY_PREFERENCES, ageMin: 24, ageMax: 28, religion: '무교', styleTags: ['미니멀'] }, MOCK_PROFILES)
const top = rec.top!

describe('LLM 겹지인 소개용 정보 정리', () => {
  it('1위의 실제 점수·순위를 숫자 검사용으로 그대로 담는다', () => {
    const f = buildFacts(me, top, rec)
    expect(f.them).toBe('해질녘')
    expect(f.total).toBe(100)
    expect(f.rank).toBe(1)
    expect(f.categories.reduce((s, c) => s + c.earned, 0)).toBe(f.total)
    expect(f.ruleBased[0]).toContain('2위')
  })

  it('겹치는 점·다른 점을 점수 계산과 같은 데이터에서 뽑는다', () => {
    const f = buildFacts(me, top, rec)
    expect(f.same).toContain('공통 취미: 사진, 산책, 독서, 영화, 그림')
    expect(f.same).toContain('여행 스타일: 둘 다 계획형')
    expect(f.same.some((x) => x.startsWith('나이:'))).toBe(true)
    const second = rec.ranked[1]
    const f2 = buildFacts(me, second, rec)
    expect(f2.different.some((x) => x.startsWith('성격:'))).toBe(true)
  })

  it('LLM에게는 코드가 고른 말할 거리 최대 3개만 준다 (점수 숫자 없음)', () => {
    const f = buildFacts(me, top, rec)
    const pts = talkingPoints(f)
    expect(pts.length).toBeGreaterThan(0)
    expect(pts.length).toBeLessThanOrEqual(3)
    expect(pts[0]).toContain('1. 공통 취미: 사진, 산책, 독서, 영화, 그림')
    expect(pts[0]).toContain('데이트 장면')
    const user = buildUserPrompt(f)
    expect(user).toContain('[말할 거리]')
    expect(user).not.toContain('100점')
    expect(systemPrompt(f)).toContain('수경과 해질녘을 둘 다 아는 친구')
  })

  it('다른 점이 있으면 3번째 말할 거리로 하나만 넣는다', () => {
    const f = buildFacts(me, rec.ranked[1], rec)
    const pts = talkingPoints(f)
    expect(pts.filter((p) => p.includes('다른 점')).length).toBeLessThanOrEqual(1)
  })

  it('선호 나이를 설정하지 않으면 나이를 겹치는 점으로 말하지 않는다', () => {
    const noPrefs = recommend(me, { ...EMPTY_PREFERENCES }, MOCK_PROFILES)
    const f = buildFacts(me, noPrefs.top!, noPrefs)
    expect(f.same.some((x) => x.startsWith('나이:'))).toBe(false)
  })
})

describe('LLM 설명 숫자 검사', () => {
  const f = buildFacts(me, top, rec)
  it('계산 결과에 있는 숫자만 쓰면 경고하지 않는다', () => {
    expect(findUnsupportedNumbers('해질녘님은 100점으로 1위예요. 공통 취미 5개로 30점을 받았어요.', f)).toEqual([])
  })
  it('계산 결과에 없는 점수를 지어내면 찾아낸다', () => {
    expect(findUnsupportedNumbers('해질녘님은 95점이고 공통 취미가 7개예요.', f)).toEqual([95, 7])
  })
})

describe('qwen3 생각 과정 걸러 내기', () => {
  it('<think> 블록을 빼고 답만 남긴다 (태그가 조각나 들어와도)', () => {
    const f = new ThinkFilter()
    const chunks = ['<thi', 'nk>점수를 ', '계산해 보면…</thi', 'nk>\n\n해질녘님은 ', '100점이에요.']
    expect(chunks.map((c) => f.push(c)).join('')).toBe('해질녘님은 100점이에요.')
  })
  it('<think>가 없으면 그대로 둔다', () => {
    const f = new ThinkFilter()
    expect(['수경님과 ', '잘 맞아요 <3'].map((c) => f.push(c)).join('')).toBe('수경님과 잘 맞아요 <3')
  })
})

describe('모델 고르기', () => {
  const tags = (names: string[]) =>
    (async () => new Response(JSON.stringify({ models: names.map((name) => ({ name })) }))) as unknown as typeof fetch
  const base = { baseUrl: 'http://localhost:11434', model: 'exaone3.5:2.4b' }
  it('EXAONE이 있으면 EXAONE을 쓴다', async () => {
    globalThis.fetch = tags(['qwen3:4b-instruct', 'exaone3.5:2.4b'])
    expect(await pickModel(base)).toBe('exaone3.5:2.4b')
  })
  it('EXAONE이 없으면 qwen3로 대신한다', async () => {
    globalThis.fetch = tags(['qwen3:4b-instruct'])
    expect(await pickModel(base)).toBe('qwen3:4b-instruct')
  })
  it('직접 고른 다른 모델은 그대로 쓴다', async () => {
    expect(await pickModel({ ...base, model: 'llama3.2:3b' })).toBe('llama3.2:3b')
  })
})

describe('공유 링크로 운영자 LLM 쓰기', () => {
  it('Cloudflare 임시 주소와 내 컴퓨터 주소만 받는다', () => {
    expect(isAllowedLlmUrl('https://happy-moa-test.trycloudflare.com')).toBe(true)
    expect(isAllowedLlmUrl('http://localhost:11434')).toBe(true)
    expect(isAllowedLlmUrl('http://127.0.0.1:8787')).toBe(true)
  })
  it('엉뚱한 서버나 속임 주소는 거절한다', () => {
    expect(isAllowedLlmUrl('https://evil.example.com')).toBe(false)
    expect(isAllowedLlmUrl('http://happy.trycloudflare.com')).toBe(false)
    expect(isAllowedLlmUrl('https://trycloudflare.com.evil.com')).toBe(false)
    expect(isAllowedLlmUrl('https://a.trycloudflare.com/steal')).toBe(false)
    expect(isAllowedLlmUrl('https://x@a.trycloudflare.com')).toBe(false)
    expect(isAllowedLlmUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedLlmUrl('not a url')).toBe(false)
  })
  it('운영자 컴퓨터 주소인지 구분한다', () => {
    expect(isRemoteLlm('https://happy-moa-test.trycloudflare.com')).toBe(true)
    expect(isRemoteLlm('http://localhost:11434')).toBe(false)
  })
  it('운영자 LLM이 꺼져 있으면(530) 연결 오류로, 붐비면(429) 대기 안내로 바꾼다', async () => {
    const remote = { baseUrl: 'https://happy-moa-test.trycloudflare.com', model: 'exaone3.5:2.4b' }
    globalThis.fetch = (async () => new Response('', { status: 530 })) as unknown as typeof fetch
    const down = await listModels(remote).catch((e) => e)
    expect(down.kind).toBe('connect')
    globalThis.fetch = (async () => new Response('', { status: 429 })) as unknown as typeof fetch
    const err = await listModels(remote).catch((e) => e)
    expect(err instanceof LlmError).toBe(true)
    expect(err.kind).toBe('busy')
  })
})
