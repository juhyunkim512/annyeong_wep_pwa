import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Get user's preferred language from cookie or browser settings
  const language = request.cookies.get('language')?.value || 'ko'
  
  const response = NextResponse.next()
  response.headers.set('x-user-language', language)
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
