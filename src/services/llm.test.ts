import { describe, expect, it } from 'vitest'
import { MOCK_PROFILES } from '../data/mockProfiles'
import { recommend } from '../matching'
import { EMPTY_PREFERENCES, type Profile } from '../types'
import { ThinkFilter, buildFacts, buildUserPrompt, findUnsupportedNumbers } from './llm'

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

describe('LLM 설명용 사실 정리', () => {
  it('1위의 실제 점수·순위·항목을 그대로 담는다', () => {
    const f = buildFacts(me, top, rec)
    expect(f.them).toBe('해질녘')
    expect(f.total).toBe(100)
    expect(f.rank).toBe(1)
    expect(f.categories).toHaveLength(7)
    expect(f.categories.reduce((s, c) => s + c.earned, 0)).toBe(f.total)
    expect(f.ruleBased[0]).toContain('2위')
  })

  it('프롬프트에 총점과 항목별 점수가 들어가고, 미사용 항목은 미사용으로 표시된다', () => {
    const p = buildUserPrompt(buildFacts(me, top, rec))
    expect(p).toContain('총점: 100점')
    expect(p).toContain('공통 취미: 30/30점')
    expect(p).toContain('1위')
    const noPrefs = recommend(me, { ...EMPTY_PREFERENCES }, MOCK_PROFILES)
    const p2 = buildUserPrompt(buildFacts(me, noPrefs.top!, noPrefs))
    expect(p2).toContain('선호 나이 범위: 미사용')
  })

  it('2위 이하 후보는 1위와의 차이를 근거로 담는다', () => {
    const second = rec.ranked[1]
    const f = buildFacts(me, second, rec)
    expect(f.rank).toBe(2)
    expect(f.ruleBased[0]).toContain(`${top.score.total - second.score.total}점 낮은 2위`)
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
