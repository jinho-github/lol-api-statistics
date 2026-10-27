import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';

export type Env = {
  Bindings: {
    RIOT_API_KEY: string;
    RIOT_REGION: string;
    RIOT_PLATFORM: string;
    SUPABASE_URL: string;
    SUPABASE_PUBLISHABLE_KEY: string;
    SUPABASE_SECRET_KEY: string;
    RIOT_VERIFICATION?: string;
  };
  Variables: {
    user: { id: string; name: string } | null;
    flash: string | null;
  };
};

// 요청한 사용자 권한으로 동작하는 클라이언트 (RLS 적용). 로그인 세션은 쿠키에 저장된다
export function userClient(c: Context<Env>) {
  return createServerClient(c.env.SUPABASE_URL, c.env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () =>
        parseCookieHeader(c.req.header('Cookie') ?? '').map(({ name, value }) => ({ name, value: value ?? '' })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          setCookie(c, name, value, { ...options, sameSite: 'Lax' } as Parameters<typeof setCookie>[3]);
        }
      },
    },
  });
}

// 서버 전용 클라이언트 (RLS 우회). 매치 캐시처럼 사용자가 직접 쓰면 안 되는 데이터에만 사용
export function adminClient(c: Context<Env>) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 이메일 앞부분을 작성자 이름으로 사용 (원본과 같은 방식)
export const displayName = (email?: string | null) => (email ?? '익명').split('@')[0];
