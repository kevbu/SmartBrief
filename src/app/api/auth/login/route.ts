import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { password } = await request.json() as { password: string }
  const correctPassword = process.env.SMARTBRIEF_PASSWORD

  if (!correctPassword || password !== correctPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const tokenValue = Buffer.from(`sb:${correctPassword}`).toString('base64')

  const response = NextResponse.json({ success: true })
  response.cookies.set('sb_auth', tokenValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return response
}
