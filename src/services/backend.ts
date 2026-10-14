/**
 * 백엔드(인증·DB) 연결 상태.
 *
 * 지금 버전에는 실제 인증 서버나 데이터베이스가 연결돼 있지 않아요.
 * 그래서 앱 전체가 "데모 모드"로 동작하고, 화면에도 그렇게 표시해요.
 *  - 계정·프로필·좋아요·대화는 이 브라우저의 localStorage에만 저장돼요.
 *  - 비밀번호를 받지 않아요. (가짜 로그인을 진짜처럼 보이게 하지 않기 위해서예요)
 *  - 가상 프로필과의 대화는 미리 준비된 문장으로 자동 응답하는 데모예요.
 *
 * 실제 서비스로 바꾸려면 src/services/auth.ts 의 AuthService / ChatService
 * 인터페이스를 Supabase·Firebase 같은 서비스로 구현한 뒤 여기 mode를 바꾸면 돼요.
 * (README의 "실제 로그인·채팅 연결하기" 참고)
 */
export type BackendMode = 'demo' | 'live'

export const BACKEND: { mode: BackendMode; label: string; detail: string } = {
  mode: 'demo',
  label: '데모 모드',
  detail: '실제 서버에 연결되지 않았어요. 모든 데이터는 이 브라우저에만 저장되고, 다른 사용자에게 전달되지 않아요.',
}
