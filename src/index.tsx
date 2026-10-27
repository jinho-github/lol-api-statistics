import { Hono, type Context } from 'hono';
import type { Child } from 'hono/jsx';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { ddragon } from './ddragon';
import { parseRiotId, RiotClient, RiotError } from './riot';
import { searchSummoner } from './summoner';
import { adminClient, displayName, userClient, type Env } from './supabase';
import { Home, homeCss, type LaneStat } from './views/Home';
import { Layout, MessageCard } from './views/Layout';
import { DUO_LANES, Matching, type DuoProfile } from './views/Matching';
import { Summoner, summonerChartScript } from './views/Summoner';
import { parseYoutubeId, TIP_LANES, Tips, type Tip } from './views/Tips';

const app = new Hono<Env>();

// 플래시 메시지: 원본 Flask flash() 대신 한 번 읽고 지우는 쿠키
const flash = (c: Context<Env>, message: string) =>
  setCookie(c, 'flash', encodeURIComponent(message), { path: '/', httpOnly: true, sameSite: 'Lax', maxAge: 30 });

app.use('*', async (c, next) => {
  const f = getCookie(c, 'flash');
  c.set('flash', f ? decodeURIComponent(f) : null);
  if (f) deleteCookie(c, 'flash', { path: '/' });

  // 로그인 쿠키가 있을 때만 Supabase 에 사용자 확인 요청
  const hasSession = Object.keys(getCookie(c)).some((k) => k.startsWith('sb-'));
  if (hasSession) {
    const { data } = await userClient(c).auth.getUser();
    c.set('user', data.user ? { id: data.user.id, name: displayName(data.user.email) } : null);
  } else {
    c.set('user', null);
  }
  await next();
});

const page = (c: Context<Env>, body: Child, opts: { title?: string; css?: string; script?: string } = {}) =>
  c.html(
    <Layout user={c.get('user')} flash={c.get('flash')} {...opts}>
      {body}
    </Layout>,
  );

const message = (c: Context<Env>, title: string, text: string, status: 404 | 500 | 503 = 404) => {
  c.status(status);
  return page(c, <MessageCard title={title} message={text} />, { title });
};

// --- 홈 ------------------------------------------------------------------
app.get('/', async (c) => {
  const db = userClient(c);
  const [dd, stats, tips] = await Promise.all([
    ddragon(),
    db.from('lane_champion_stats').select('team_position, champion_id, games, win_rate'),
    db.from('tips').select('*').order('id', { ascending: false }).limit(10),
  ]);
  if (stats.error) console.warn('lane_champion_stats', stats.error.message);
  if (tips.error) console.warn('tips', tips.error.message);
  return page(c, <Home dd={dd} stats={(stats.data ?? []) as LaneStat[]} tips={(tips.data ?? []) as Tip[]} />, {
    css: homeCss,
  });
});

// --- 전적 검색 --------------------------------------------------------------
app.get('/search', (c) => {
  const parsed = parseRiotId(c.req.query('q') ?? '');
  if (!parsed) return c.redirect('/');
  const [name, tag] = parsed;
  return c.redirect(`/summoner/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
});

// 원본 주소(/application?name=...) 호환
app.get('/application', (c) => c.redirect(`/search?q=${encodeURIComponent(c.req.query('name') ?? '')}`));

app.get('/summoner/:name/:tag', async (c) => {
  const { name, tag } = c.req.param();
  try {
    const [v, dd] = await Promise.all([searchSummoner(c, name, tag), ddragon()]);
    return page(c, <Summoner v={v} dd={dd} />, { title: `${v.gameName}#${v.tagLine}`, script: summonerChartScript(v) });
  } catch (e) {
    if (e instanceof RiotError) {
      if (e.status === 404) return message(c, '소환사 정보를 불러오는데 실패했습니다.', `${name}#${tag} 계정이 없습니다. 다시 확인해주세요.`);
      if (e.status === 429) return message(c, '잠시 후 다시 시도해주세요.', 'Riot API 요청 한도를 넘었어요. 1~2분 뒤에 다시 검색해주세요.', 503);
      if (e.status === 401 || e.status === 403) {
        console.error('Riot API 키 오류', e.message);
        return message(c, '서버 설정 문제로 검색할 수 없어요.', 'Riot API 키가 만료되었거나 잘못되었습니다.', 503);
      }
    }
    throw e;
  }
});

// --- 나만의 팁 ---------------------------------------------------------------
app.get('/tips', async (c) => {
  const { data, error } = await userClient(c).from('tips').select('*').order('id', { ascending: false }).limit(100);
  if (error) console.warn('tips', error.message);
  return page(c, <Tips tips={(data ?? []) as Tip[]} loggedIn={!!c.get('user')} />, { title: '나만의 팁' });
});

app.post('/tips', async (c) => {
  const user = c.get('user');
  if (!user) {
    flash(c, '로그인 후 작성할 수 있어요.');
    return c.redirect('/tips');
  }
  const form = await c.req.parseBody();
  const lane = String(form.lane ?? '');
  const title = String(form.title ?? '').trim();
  const body = String(form.body ?? '').trim();
  const youtube = String(form.youtube ?? '');
  const youtube_id = parseYoutubeId(youtube);
  if (!(TIP_LANES as readonly string[]).includes(lane) || !title || !body || (youtube.trim() && !youtube_id)) {
    flash(c, '입력값을 확인해주세요. (라인, 제목, 내용, 유튜브 주소)');
    return c.redirect('/tips');
  }
  const { error } = await userClient(c).from('tips').insert({ lane, title, body, youtube_id, author_name: user.name });
  flash(c, error ? `등록 실패: ${error.message}` : '나만의 팁 등록!!');
  return c.redirect('/tips');
});

// --- 유저 매칭 ---------------------------------------------------------------
app.get('/matching', async (c) => {
  const user = c.get('user');
  if (!user) return page(c, <Matching loggedIn={false} mine={null} others={[]} />, { title: '유저매칭' });
  const { data, error } = await userClient(c).from('duo_profiles').select('*').order('updated_at', { ascending: false });
  if (error) console.warn('duo_profiles', error.message);
  const rows = (data ?? []) as DuoProfile[];
  const mine = rows.find((r) => r.user_id === user.id) ?? null;
  return page(c, <Matching loggedIn mine={mine} others={rows.filter((r) => r.user_id !== user.id)} />, { title: '유저매칭' });
});

app.post('/matching', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/matching');
  const form = await c.req.parseBody();
  const lane = String(form.lane ?? '');
  const champion = String(form.champion ?? '').trim();
  const parsed = parseRiotId(String(form.riot_id ?? ''));
  if (!parsed || !(DUO_LANES as readonly string[]).includes(lane) || !champion) {
    flash(c, '입력값을 확인해주세요.');
    return c.redirect('/matching');
  }

  // 등록할 때 실제로 존재하는 Riot ID 인지 확인하고, 솔로랭크 전적을 같이 저장
  const riot = new RiotClient(c.env.RIOT_API_KEY, c.env.RIOT_REGION, c.env.RIOT_PLATFORM);
  let account;
  try {
    account = await riot.account(...parsed);
  } catch (e) {
    flash(c, e instanceof RiotError && e.status === 404 ? '존재하지 않는 Riot ID 입니다.' : 'Riot ID 확인에 실패했어요.');
    return c.redirect('/matching');
  }
  const solo = (await riot.leagues(account.puuid).catch(() => [])).find((l) => l.queueType === 'RANKED_SOLO_5x5');

  const { error } = await userClient(c)
    .from('duo_profiles')
    .upsert({
      user_id: user.id,
      author_name: user.name,
      riot_id: `${account.gameName}#${account.tagLine}`,
      lane,
      champion,
      tier: solo ? `${solo.tier} ${solo.rank}` : null,
      wins: solo?.wins ?? null,
      losses: solo?.losses ?? null,
      updated_at: new Date().toISOString(),
    });
  flash(c, error ? `등록 실패: ${error.message}` : '내 매칭 정보 등록!!');
  return c.redirect('/matching');
});

// --- 로그인 / 회원가입 (Supabase Auth) ---------------------------------------
const back = (c: Context<Env>) => {
  const ref = c.req.header('Referer');
  try {
    const u = new URL(ref ?? '/', c.req.url);
    return u.origin === new URL(c.req.url).origin ? u.pathname + u.search : '/';
  } catch {
    return '/';
  }
};

app.post('/auth/login', async (c) => {
  const form = await c.req.parseBody();
  const { error } = await userClient(c).auth.signInWithPassword({
    email: String(form.email ?? ''),
    password: String(form.password ?? ''),
  });
  flash(
    c,
    !error ? '로그인 성공!' : error.code === 'email_not_confirmed' ? '이메일 인증을 먼저 완료해주세요.' : '이메일, 패스워드를 다시 확인해주세요.',
  );
  return c.redirect(back(c));
});

app.post('/auth/register', async (c) => {
  const form = await c.req.parseBody();
  const email = String(form.email ?? '');
  const password = String(form.password ?? '');
  if (password !== String(form.password2 ?? '')) {
    flash(c, '비밀번호가 서로 다릅니다.');
    return c.redirect(back(c));
  }
  const { data, error } = await userClient(c).auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${new URL(c.req.url).origin}/auth/callback` },
  });
  if (error) flash(c, error.code === 'user_already_exists' ? '이미 사용중인 이메일입니다.' : `회원가입 실패: ${error.message}`);
  else flash(c, data.session ? '회원가입 성공!!' : '인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 완료됩니다.');
  return c.redirect(back(c));
});

// 인증 메일 링크 → ?code=... 로 돌아오면 세션으로 교환
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code');
  if (code) {
    const { error } = await userClient(c).auth.exchangeCodeForSession(code);
    flash(c, error ? '인증 링크가 만료되었어요. 다시 로그인해주세요.' : '이메일 인증 완료! 환영합니다.');
  }
  return c.redirect('/');
});

app.post('/auth/logout', async (c) => {
  await userClient(c).auth.signOut();
  flash(c, '로그아웃 되었습니다.');
  return c.redirect('/');
});

// --- Riot 사이트 인증 / 상태 확인 ---------------------------------------------
app.get('/riot.txt', (c) => (c.env.RIOT_VERIFICATION ? c.text(c.env.RIOT_VERIFICATION) : c.notFound()));

app.get('/healthz', async (c) => {
  const { error } = await adminClient(c).from('match_cache').select('match_id').limit(1);
  return c.json({ ok: true, db: error ? error.message : 'ok' });
});

app.notFound((c) => message(c, '페이지를 찾을 수 없습니다.', '주소를 다시 확인해주세요.'));
app.onError((e, c) => {
  console.error(e);
  return message(c, '오류가 발생했습니다.', '잠시 후 다시 시도해주세요.', 500);
});

export default app;
