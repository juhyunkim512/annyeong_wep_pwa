// createBrowserClient(@supabase/ssr) 사용:
// PKCE code verifier를 localStorage가 아닌 쿠키에 저장하여
// 서버 callback route에서 exchangeCodeForSession() 성공 가능
// ⚠️ auth 옵션을 별도로 전달하지 않는다:
//   @supabase/ssr v0.9.x의 createBrowserClient는 내부적으로 flowType:'pkce' + cookie storage를 설정하는데,
//   auth 옵션 객체를 넘기면 버전에 따라 flowType이 implicit으로 덮여 PKCE verifier가 저장되지 않을 수 있다.
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
