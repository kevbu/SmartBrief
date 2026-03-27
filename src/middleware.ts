import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export function middleware(request: NextRequest) {
  const password = process.env.SMARTBRIEF_PASSWORD
  // If no password set, allow everything (local dev)
  if (!password) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const authCookie = request.cookies.get('sb_auth')
  const expectedHash = hashPassword(password)

  if (authCookie?.value === expectedHash) return NextResponse.next()

  return NextResponse.redirect(new URL('/login', request.url))
}

// Simple hash using Buffer (available in Node.js runtime)
function hashPassword(password: string): string {
  return Buffer.from(`sb:${password}`).toString('base64')
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-).*)'],
}
