import { describe, expect, it } from 'vitest'
import { MOCK_PROFILES } from '../data/mockProfiles'
import { EMPTY_PREFERENCES, type Preferences, type Profile } from '../types'
import {
  DEFAULT_SCORE_TABLE,
  applyFilters,
  exclusionStats,
  explainTop,
  groupByFilter,
  bestPossibleScore,
  maxAchievableScore,
  recommend,
  scoreCandidate,
  tableTotal,
  type ScoreTable,
} from './index'
import { HOBBIES, MUSIC_GENRES, PERSONALITIES } from '../data/options'

// ---------- 테스트용 헬퍼 ----------
function person(over: Partial<Profile> & { id: string; nickname: string }): Profile {
  return {
    kind: 'mock',
    age: 30,
    height: 170,
    bio: '',
    gender: null,
    personality: [],
    hobbies: [],
    music: [],
    travel: null,
    styles: [],
    religion: null,
    income: null,
    ...over,
  }
}
const prefs = (over: Partial<Preferences> = {}): Preferences => ({ ...EMPTY_PREFERENCES, ...over })
const cat = (r: ReturnType<typeof scoreCandidate>, key: string) => r.categories.find((c) => c.key === key)!

const me = person({
  id: 'user-me',
  kind: 'user',
  nickname: '나',
  age: 27,
  personality: ['외향적', '다정함', '감성적'],
  hobbies: ['사진', '산책', '독서', '요리'],
  music: ['발라드', '재즈'],
  travel: '계획형',
})

// ---------- 점수표 ----------
describe('점수표', () => {
  it('기본 점수표 총점은 100점', () => {
    expect(tableTotal()).toBe(100)
  })
  it('항목별 최대점이 요구사항과 같다', () => {
    const t = DEFAULT_SCORE_TABLE
    expect(t.age).toEqual(expect.objectContaining({ type: 'flat', points: 15 }))
    expect(t.personality).toEqual(expect.objectContaining({ type: 'perItem', perItem: 2, max: 18 }))
    expect(t.hobbies).toEqual(expect.objectContaining({ type: 'perItem', perItem: 3, max: 30 }))
    expect(t.music).toEqual(expect.objectContaining({ type: 'perItem', perItem: 2, max: 16 }))
    expect(t.travel).toEqual(expect.objectContaining({ type: 'flat', points: 10 }))
    expect(t.religion).toEqual(expect.objectContaining({ type: 'flat', points: 6 }))
    expect(t.style).toEqual(expect.objectContaining({ type: 'flat', points: 5 }))
  })
  it('선택지 개수 × 항목당 점수 = 최대점 (성격 9, 취미 10, 음악 8)', () => {
    expect(PERSONALITIES.length * 2).toBe(18)
    expect(HOBBIES.length * 3).toBe(30)
    expect(MUSIC_GENRES.length * 2).toBe(16)
  })
})

// ---------- 점수 계산 ----------
describe('점수 계산', () => {
  it('해질녘(mock-01)과의 점수를 항목별로 정확히 계산한다 = 53점', () => {
    const target = MOCK_PROFILES.find((p) => p.id === 'mock-01')!
    const p = prefs({ ageMin: 25, ageMax: 30, religion: '무교', styleTags: ['미니멀'] })
    const r = scoreCandidate(me, p, target)

    expect(cat(r, 'age').earned).toBe(15) // 27세, 25~30
    expect(cat(r, 'personality').earned).toBe(4) // 다정함, 감성적
    expect(cat(r, 'personality').matched).toEqual(['다정함', '감성적'])
    expect(cat(r, 'hobbies').earned).toBe(9) // 사진, 산책, 독서
    expect(cat(r, 'hobbies').matched).toEqual(['사진', '산책', '독서'])
    expect(cat(r, 'music').earned).toBe(4) // 발라드, 재즈
    expect(cat(r, 'travel').earned).toBe(10) // 계획형
    expect(cat(r, 'religion').earned).toBe(6) // 무교
    expect(cat(r, 'style').earned).toBe(5) // 미니멀
    expect(r.total).toBe(53)
    expect(r.total).toBe(r.categories.reduce((s, c) => s + c.earned, 0))
    expect(r.maxPossible).toBe(100)
  })

  it('모든 항목이 완벽히 맞으면 정확히 100점', () => {
    const all = person({
      id: 'a',
      nickname: 'A',
      age: 30,
      personality: [...PERSONALITIES],
      hobbies: [...HOBBIES],
      music: [...MUSIC_GENRES],
      travel: '즉흥형',
      religion: '불교',
      styles: ['스포티'],
    })
    const meAll = { ...all, id: 'me', kind: 'user' as const }
    const r = scoreCandidate(meAll, prefs({ ageMin: 20, ageMax: 40, religion: '불교', styleTags: ['스포티'] }), all)
    expect(r.total).toBe(100)
  })

  it('선택하지 않은 항목은 점수에 반영하지 않는다', () => {
    const blankMe = person({ id: 'me', kind: 'user', nickname: '빈칸' })
    const target = MOCK_PROFILES[0]
    const r = scoreCandidate(blankMe, prefs(), target)
    expect(r.total).toBe(0)
    expect(r.maxPossible).toBe(0)
    expect(r.categories.every((c) => !c.used && c.earned === 0)).toBe(true)
  })

  it('선호 나이를 비우면 나이 15점은 누구에게도 주지 않는다', () => {
    const r = scoreCandidate(me, prefs(), MOCK_PROFILES[0])
    expect(cat(r, 'age').used).toBe(false)
    expect(cat(r, 'age').earned).toBe(0)
  })

  it('스타일 태그는 여러 개 겹쳐도 5점 한 번만 준다', () => {
    const t = person({ id: 't', nickname: 'T', styles: ['미니멀', '클래식', '댄디'] })
    const r = scoreCandidate(me, prefs({ styleTags: ['미니멀', '클래식', '댄디'] }), t)
    expect(cat(r, 'style').earned).toBe(5)
    expect(cat(r, 'style').matched).toEqual(['미니멀', '클래식', '댄디'])
  })

  it('상대 정보가 없으면 해당 항목은 0점 (여행·종교)', () => {
    const t = person({ id: 't', nickname: 'T', travel: null, religion: null })
    const r = scoreCandidate(me, prefs({ religion: '무교' }), t)
    expect(cat(r, 'travel').earned).toBe(0)
    expect(cat(r, 'religion').earned).toBe(0)
  })

  it('점수표를 바꾸면 결과도 바뀐다 (항목당 점수와 최대점 상한 적용)', () => {
    const custom: ScoreTable = {
      ...DEFAULT_SCORE_TABLE,
      hobbies: { ...DEFAULT_SCORE_TABLE.hobbies, type: 'perItem', perItem: 5, max: 10 },
    }
    const t = person({ id: 't', nickname: 'T', hobbies: ['사진', '산책', '독서'] })
    const r = scoreCandidate(me, prefs(), t, custom)
    expect(cat(r, 'hobbies').earned).toBe(10) // 3개×5=15 → 상한 10
  })
})

// ---------- 필터 ----------
describe('필수 조건 필터', () => {
  const pool = [
    person({ id: 'f1', nickname: '가', gender: '여성', age: 26, religion: '무교', income: '3천~5천만 원', travel: '계획형', height: 160 }),
    person({ id: 'f2', nickname: '나나', gender: '남성', age: 26, religion: '무교', income: '3천~5천만 원', travel: '계획형', height: 180 }),
    person({ id: 'f3', nickname: '다', gender: '여성', age: 35, religion: '기독교', income: null, travel: '즉흥형', height: 165 }),
    person({ id: 'f4', nickname: '라', gender: null, age: 28, religion: null, income: '8천만 원 이상', travel: null, height: 170 }),
  ]

  it('아무 조건도 켜지 않으면 아무도 제외하지 않는다', () => {
    const r = applyFilters(me, prefs({ ageMin: 20, ageMax: 25, religion: '천주교', heightMin: 190 }), pool)
    // 범위는 입력했지만 "필수" 토글을 켜지 않았으므로 필터가 아님
    expect(r.activeFilters).toHaveLength(0)
    expect(r.passed).toHaveLength(4)
    expect(r.excluded).toHaveLength(0)
  })

  it('필수 조건에 맞지 않는 후보를 이유와 함께 제외한다', () => {
    const r = applyFilters(
      me,
      prefs({ gender: '여성', ageMin: 25, ageMax: 30, ageRequired: true, religion: '무교', religionRequired: true }),
      pool,
    )
    expect(r.passed.map((p) => p.id)).toEqual(['f1'])
    const byId = Object.fromEntries(r.excluded.map((e) => [e.profile.id, e.reasons.map((x) => x.key)]))
    expect(byId.f2).toEqual(['gender'])
    expect(byId.f3).toEqual(['age', 'religion'])
    expect(byId.f4).toEqual(['gender', 'religion']) // 정보 없음도 제외 이유로 표시
  })

  it('소득·키·여행 필수 조건', () => {
    const r = applyFilters(
      me,
      prefs({ incomeBands: ['3천~5천만 원'], heightMax: 175, heightRequired: true, travelRequired: true }),
      pool,
    )
    expect(r.passed.map((p) => p.id)).toEqual(['f1'])
    const f3 = r.excluded.find((e) => e.profile.id === 'f3')!
    expect(f3.reasons.map((x) => x.key)).toEqual(['income', 'travel'])
  })

  it('내 여행 취향이 비어 있으면 여행 필수 조건은 적용하지 않는다', () => {
    const noTravelMe = { ...me, travel: null }
    const r = applyFilters(noTravelMe, prefs({ travelRequired: true }), pool)
    expect(r.activeFilters).toHaveLength(0)
    expect(r.passed).toHaveLength(4)
  })

  it('제외 후보를 조건별로 묶는다 (여러 조건에 걸린 사람은 탭마다 나온다)', () => {
    const r = applyFilters(
      me,
      prefs({ gender: '여성', ageMin: 25, ageMax: 30, ageRequired: true, religion: '무교', religionRequired: true }),
      pool,
    )
    const groups = groupByFilter(r.excluded)
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.items.map((i) => i.candidate.profile.id)]))
    expect(byKey.gender).toEqual(['f2', 'f4'])
    expect(byKey.religion).toEqual(['f3', 'f4'])
    expect(byKey.age).toEqual(['f3'])
    const gender = groups.find((g) => g.key === 'gender')!
    expect(gender.onlyCount).toBe(1) // f2만 성별 하나 때문에 빠짐
    expect(gender.items.find((i) => i.candidate.profile.id === 'f4')!.others.map((o) => o.key)).toEqual(['religion'])
  })
})

// ---------- 추천 ----------
describe('추천 순위', () => {
  it('점수 높은 순으로 정렬하고 1위를 고른다', () => {
    const pool = [
      person({ id: 'r1', nickname: '하나', hobbies: ['사진'] }), // 3
      person({ id: 'r2', nickname: '둘', hobbies: ['사진', '산책', '독서'], travel: '계획형' }), // 9 + 10 = 19
      person({ id: 'r3', nickname: '셋', hobbies: ['사진', '산책'] }), // 6
    ]
    const rec = recommend(me, prefs(), pool)
    expect(rec.ranked.map((r) => r.profile.id)).toEqual(['r2', 'r3', 'r1'])
    expect(rec.ranked.map((r) => r.score.total)).toEqual([19, 6, 3])
    expect(rec.ranked.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(rec.top?.profile.id).toBe('r2')
    const why = explainTop(rec)
    expect(why[0]).toContain('19점')
    expect(why.join(' ')).toContain('2위 셋(6점)보다 13점 앞서요')
  })

  it('동점이면 공통 취미가 많은 후보가 앞선다', () => {
    const pool = [
      person({ id: 't1', nickname: '가', travel: '계획형' }), // 10, 취미 0
      person({ id: 't2', nickname: '나', hobbies: ['사진', '산책'], music: ['발라드', '재즈'] }), // 6 + 4 = 10, 취미 2
    ]
    const rec = recommend(me, prefs(), pool)
    expect(rec.ranked.map((r) => r.score.total)).toEqual([10, 10])
    expect(rec.top?.profile.id).toBe('t2')
    expect(explainTop(rec).join(' ')).toContain('동점')
  })

  it('나 자신은 추천 후보에도 제외 목록에도 들어가지 않는다', () => {
    const twin = { ...me } // 나와 완전히 같은 프로필 = 점수가 가장 높을 대상
    const pool = [twin, person({ id: 'o1', nickname: '다른사람', hobbies: ['사진'] })]
    const rec = recommend(me, prefs(), pool)
    expect(rec.selfRemoved).toBe(true)
    expect(rec.ranked.map((r) => r.profile.id)).toEqual(['o1'])
    expect(rec.excluded.find((e) => e.profile.id === me.id)).toBeUndefined()
    expect(rec.poolSize).toBe(1)
  })

  it('조건에 맞는 후보가 0명이면 억지로 추천하지 않는다', () => {
    const rec = recommend(me, prefs({ ageMin: 50, ageMax: 55, ageRequired: true }), MOCK_PROFILES)
    expect(rec.top).toBeNull()
    expect(rec.ranked).toHaveLength(0)
    expect(rec.excluded).toHaveLength(MOCK_PROFILES.length)
    expect(explainTop(rec)).toEqual([])
    const stats = exclusionStats(rec.excluded)
    expect(stats[0]).toEqual({ key: 'age', count: MOCK_PROFILES.length, onlyReason: MOCK_PROFILES.length })
  })

  it('빈 후보 풀도 안전하게 처리한다', () => {
    const rec = recommend(me, prefs(), [])
    expect(rec.top).toBeNull()
    expect(rec.poolSize).toBe(0)
  })

  it('가상 프로필 전체에서도 총점 = 항목 합계이고 내림차순이다', () => {
    const rec = recommend(me, prefs({ ageMin: 24, ageMax: 32, religion: '무교', styleTags: ['캐주얼'] }), MOCK_PROFILES)
    expect(rec.ranked).toHaveLength(MOCK_PROFILES.length)
    for (const r of rec.ranked) {
      expect(r.score.total).toBe(r.score.categories.reduce((s, c) => s + c.earned, 0))
      expect(r.score.total).toBeLessThanOrEqual(100)
      for (const c of r.score.categories) expect(c.earned).toBeLessThanOrEqual(c.max)
    }
    for (let i = 1; i < rec.ranked.length; i++) {
      expect(rec.ranked[i - 1].score.total).toBeGreaterThanOrEqual(rec.ranked[i].score.total)
    }
  })
})

// ---------- 설명 문장 ----------
describe('설명 문장', () => {
  it('닉네임 받침에 맞는 조사를 쓴다', () => {
    const pool = [person({ id: 'j1', nickname: '하늘', travel: '계획형' }), person({ id: 'j2', nickname: '별빛', travel: '계획형' })]
    const why = explainTop(recommend(me, prefs(), pool)).join(' ')
    expect(why).toContain('2위 하늘과') // 동점 → 가나다순으로 별빛 1위, 하늘 2위
  })
})

// ---------- 현실적인 최고 점수 ----------
describe('현실적인 최고 점수', () => {
  it('상대와 완벽히 맞는 사용자의 실제 점수와 같다 (모든 캐릭터)', () => {
    for (const p of MOCK_PROFILES) {
      const twin: Profile = { ...p, id: 'me', kind: 'user' }
      const r = scoreCandidate(twin, prefs({ ageMin: p.age, ageMax: p.age, religion: p.religion, styleTags: p.styles.slice(0, 1) }), p)
      expect(r.total).toBe(bestPossibleScore(p))
    }
  })
  it('후보 전체 최고점은 100점을 넘지 않고, 빈 후보면 0점', () => {
    const m = maxAchievableScore(MOCK_PROFILES)
    expect(m).toBeGreaterThan(0)
    expect(m).toBeLessThanOrEqual(100)
    expect(maxAchievableScore([])).toBe(0)
  })
})

// ---------- 가상 데이터 ----------
describe('가상 프로필 데이터', () => {
  it('24명 이상이고 모두 가상(mock) 프로필이며 id가 겹치지 않는다', () => {
    expect(MOCK_PROFILES.length).toBeGreaterThanOrEqual(24)
    expect(MOCK_PROFILES.every((p) => p.kind === 'mock' && p.id.startsWith('mock-'))).toBe(true)
    expect(new Set(MOCK_PROFILES.map((p) => p.id)).size).toBe(MOCK_PROFILES.length)
  })
  it('모두 성인이고 매칭에 필요한 정보가 채워져 있다', () => {
    for (const p of MOCK_PROFILES) {
      expect(p.age).toBeGreaterThanOrEqual(19)
      expect(p.bio.length).toBeGreaterThan(0)
      expect(p.personality.length).toBeGreaterThan(0)
      expect(p.hobbies.length).toBeGreaterThan(0)
      expect(p.music.length).toBeGreaterThan(0)
      expect(p.travel).not.toBeNull()
    }
  })
})
