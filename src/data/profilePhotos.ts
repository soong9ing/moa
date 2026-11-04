/**
 * 프로필 사진이 있는 캐릭터 목록.
 * 사진 파일은 public/profiles/<id>.jpg 에 있어요 (480×480 정사각형).
 * 모두 AI로 만든 가상 인물 사진이에요. 실제 사람의 사진은 넣지 마세요.
 * 사진이 없는 캐릭터는 닉네임 첫 글자 아바타로 보여요.
 */
const WITH_PHOTO = new Set<string>([
  // 여성 20명
  'mock-01', 'mock-03', 'mock-05', 'mock-07', 'mock-09', 'mock-12', 'mock-14', 'mock-15', 'mock-17', 'mock-19',
  'mock-22', 'mock-25', 'mock-28', 'mock-30', 'mock-32', 'mock-34', 'mock-36', 'mock-38', 'mock-40', 'mock-44',
  // 남성 20명
  'mock-02', 'mock-04', 'mock-06', 'mock-11', 'mock-18', 'mock-20', 'mock-21', 'mock-24', 'mock-27', 'mock-29',
  'mock-31', 'mock-33', 'mock-35', 'mock-37', 'mock-39', 'mock-41', 'mock-43', 'mock-45', 'mock-47', 'mock-49',
])

const BASE: string = import.meta.env?.BASE_URL ?? './'

/** 사진 주소 (없으면 null) */
export function profilePhoto(id: string): string | null {
  return WITH_PHOTO.has(id) ? `${BASE}profiles/${id}.jpg` : null
}
