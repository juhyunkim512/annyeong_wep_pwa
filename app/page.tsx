import { redirect } from 'next/navigation'

interface PageProps {
  searchParams: Promise<Record<string, string>>
}

// 루트 진입점
// ★ /auth/callback 외 경로로 OAuth code가 유입될 수 있음 (Supabase Site URL fallback).
//   ?code= 혹은 ?error= 파라미터가 있으면 /auth/callback으로 그대로 위임한다.
export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams

  if (params.code) {
    console.log('[root-page] ?code detected — forwarding to /auth/callback')
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}`)
  }

  if (params.error) {
    console.log('[root-page] ?error detected — forwarding to /auth/callback')
    redirect(`/auth/callback?error=${encodeURIComponent(params.error)}`)
  }

  redirect('/dashboard/home')
}
