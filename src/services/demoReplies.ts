import { josa } from '../lib/josa'
import type { Profile } from '../types'

/**
 * 가상 프로필 데모 자동 응답.
 * 실제 사람이 아니라 미리 정해 둔 문장 틀에 프로필 취향을 끼워 넣은 거예요.
 * 화면에는 항상 "데모 자동 응답" 표시가 붙어요.
 */

function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(seed) % list.length]
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function openingLine(p: Profile): string {
  const hobby = p.hobbies[0]
  return `안녕하세요, ${josa(p.nickname, '이에요', '예요')} :) ${hobby ? `${hobby} 좋아하신다고 봤어요!` : '반가워요!'}`
}

export function demoReply(p: Profile, userText: string, turn: number): string {
  const seed = hash(p.id + userText) + turn
  const text = userText.trim()

  const mentionedHobby = p.hobbies.find((h) => text.includes(h))
  if (mentionedHobby) {
    return pick(
      [
        `${mentionedHobby} 얘기 나오니까 반갑네요! 저는 요즘 주말마다 ${mentionedHobby} 하고 있어요.`,
        `오 ${mentionedHobby}! 제일 좋아하는 취미예요. 어떻게 시작하셨어요?`,
      ],
      seed,
    )
  }
  const mentionedMusic = p.music.find((m) => text.includes(m))
  if (mentionedMusic) {
    return `${mentionedMusic} 좋아하시는구나! 요즘 플레이리스트에 ${mentionedMusic}만 잔뜩이에요.`
  }
  if (/여행|놀러|휴가/.test(text) && p.travel) {
    return p.travel === '계획형'
      ? '여행은 엑셀로 일정 짜는 편이에요 ㅎㅎ 계획 세우는 것도 여행의 재미 같아요.'
      : '여행은 일단 떠나고 보는 편이에요! 가서 정하는 게 더 설레더라고요.'
  }
  if (/[?？]$/.test(text)) {
    return pick(
      [
        '좋은 질문이에요! 음… 저는 천천히 알아가는 걸 좋아해요.',
        `그건 만나서 이야기해 보면 더 재밌을 것 같아요. 참고로 저는 ${p.tagline ?? '평범한 사람'}이에요 :)`,
        '하하 생각해 본 적 없는데, 다음에 꼭 대답해 드릴게요!',
      ],
      seed,
    )
  }
  return pick(
    [
      '그렇군요! 더 듣고 싶어요.',
      `ㅎㅎ 공감돼요. 저도 ${p.hobbies[1] ?? p.hobbies[0] ?? '쉬는 거'} 하면서 비슷한 생각 했어요.`,
      '말씀 나눠 보니까 취향이 꽤 비슷한 것 같아요!',
      '오늘 하루는 어떠셨어요?',
    ],
    seed,
  )
}
