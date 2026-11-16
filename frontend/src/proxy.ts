import { NextResponse, type NextRequest } from 'next/server'

// Deliberate simulated session for this standalone mock project only.
// The original authentication components are retained; no real credentials are used.
export function proxy(request: NextRequest) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname)) {
    return new NextResponse('This mock workspace accepts loopback requests only.', { status: 403 })
  }
  const response = NextResponse.next()
  const role = request.cookies.get('mock_role')?.value || 'admin'
  response.cookies.set('new_api_has_session', role === 'guest' ? '0' : '1', { path: '/', sameSite: 'strict' })
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|locales/|orbis/|icons/|mock/).*)'] }
