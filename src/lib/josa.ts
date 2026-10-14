/** 한국어 조사 붙이기: 받침 유무에 따라 '이에요/예요', '와/과', '이/가' 등을 골라요. */
export function hasBatchim(word: string): boolean {
  const last = word.trim().charCodeAt(word.trim().length - 1)
  if (Number.isNaN(last) || last < 0xac00 || last > 0xd7a3) return false
  return (last - 0xac00) % 28 !== 0
}

export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  return word + (hasBatchim(word) ? withBatchim : withoutBatchim)
}
