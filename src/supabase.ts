import { createClient } from '@supabase/supabase-js';
import type { Context } from 'hono';

export type Env = {
  Bindings: {
    RIOT_API_KEY: string;
    RIOT_REGION: string;
    RIOT_PLATFORM: string;
    SUPABASE_URL: string;
    SUPABASE_SECRET_KEY: string;
    RIOT_VERIFICATION?: string;
  };
};

// 로그인 기능을 없앴으므로 서버 전용 클라이언트 하나만 쓴다. 모든 테이블은 RLS 로 anon 접근이 막혀 있다
export function db(c: Context<Env>) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
