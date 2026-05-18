import { NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/google-calendar';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const origin = new URL(request.url).origin;

  if (error) {
    return NextResponse.redirect(`${origin}/?google_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/?google_error=no_code`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = userInfoRes.ok ? await userInfoRes.json() : null;

    await prisma.googleAuth.deleteMany();
    await prisma.googleAuth.create({
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        email: userInfo?.email ?? null,
      },
    });

    return NextResponse.redirect(`${origin}/?google_connected=true`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(`${origin}/?google_error=auth_failed`);
  }
}
