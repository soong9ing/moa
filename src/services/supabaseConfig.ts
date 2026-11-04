/**
 * Supabase 연결 정보.
 *
 * - URL과 publishable key는 브라우저에 공개돼도 되는 값이에요.
 *   데이터는 Supabase의 행 수준 보안(RLS) 규칙으로 보호돼요 (supabase/schema.sql).
 * - secret / service_role 키는 절대 여기에 넣지 마세요.
 * - 기본은 서버 없이 데모 모드로 동작해요 (VITE_MOA_DEMO=false 로 빌드하면 Supabase 연결).
 */
export const SUPABASE_URL: string = import.meta.env?.VITE_SUPABASE_URL ?? 'https://xtrvqdyesxxniynxwwpo.supabase.co'

export const SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_uk2GHDeamIOVNVVyX29qpw_9xysTyCP'

/**
 * 지금은 가상 앱(데모 모드)으로 운영해요 → 기본값 true.
 * 실제 로그인·가입자 수를 다시 켜려면 VITE_MOA_DEMO=false 로 빌드하거나 아래 기본값을 false로 바꾸세요.
 * (그 전에 README의 'Supabase 연결' 설정을 먼저 해 주세요)
 */
export const FORCE_DEMO: boolean = (import.meta.env?.VITE_MOA_DEMO ?? 'true') !== 'false'
