import { Hono, type Context } from 'hono';
import type { Child } from 'hono/jsx';
import { analyzeSummoner, tierList } from './analysis';
import { collect } from './collector';
import { ddragon } from './ddragon';
import { isPosition, tierGroup } from './meta';
import { parseRiotId, RiotClient, RiotError } from './riot';
import { db, type Env } from './supabase';
import { Champion, type ChampionDetailData } from './views/Champion';
import { ChampionIndex, filterScript, TierList } from './views/Champions';
import { Home, type MetaSummary } from './views/Home';
import { Layout, MessagePage } from './views/Layout';
import { Summoner } from './views/Summoner';

const app = new Hono<Env>();

const page = (c: Context<Env>, body: Child, opts: { title?: string; description?: string; darkNav?: boolean; script?: string } = {}) =>
  c.html(<Layout {...opts}>{body}</Layout>);

const message = (c: Context<Env>, title: string, text: string, status: 404 | 500 | 503 = 404) => {
  c.status(status);
  return page(c, <MessagePage title={title} message={text} />, { title, darkNav: true });
};

const riot = (c: Context<Env>) => new RiotClient(c.env.RIOT_API_KEY, c.env.RIOT_REGION, c.env.RIOT_PLATFORM);

// 짧게 캐시해도 되는 집계 페이지는 Cloudflare 엣지에 1분 캐시
const cacheable = (c: Context<Env>, seconds = 60) => c.header('Cache-Control', `public, max-age=${seconds}`);

// --- 홈 ------------------------------------------------------------------
app.get('/', async (c) => {
  const client = db(c);
  const [dd, rows, summary] = await Promise.all([
    ddragon(),
    tierList(client, null),
    client.rpc('meta_summary', { p_days: 14 }).then((r) => (r.error ? null : (r.data as MetaSummary))),
  ]);
  cacheable(c);
  return page(c, <Home dd={dd} rows={rows} summary={summary} />, { darkNav: true });
});

// --- 소환사 분석 -------------------------------------------------------------
app.get('/search', (c) => {
  const parsed = parseRiotId(c.req.query('q') ?? '');
  if (!parsed) return c.redirect('/');
  const [name, tag] = parsed;
  return c.redirect(`/summoner/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
});

// 2020년 원본 주소(/application?name=...) 호환
app.get('/application', (c) => c.redirect(`/search?q=${encodeURIComponent(c.req.query('name') ?? '')}`));

app.get('/summoner/:name/:tag', async (c) => {
  const { name, tag } = c.req.param();
  try {
    const dd = await ddragon();
    const a = await analyzeSummoner(db(c), riot(c), dd, name, tag, (p) => c.executionCtx.waitUntil(p));
    return page(c, <Summoner a={a} dd={dd} />, {
      title: `${a.gameName}#${a.tagLine}`,
      description: `${a.gameName}#${a.tagLine}의 최근 솔로랭크 분석: 장점, 약점, 추천 챔피언`,
    });
  } catch (e) {
    if (e instanceof RiotError) {
      if (e.status === 404) return message(c, '소환사를 찾을 수 없어요', `${name}#${tag} 계정이 없어요. 이름과 태그를 다시 확인해 주세요.`);
      if (e.status === 429) return message(c, '잠시 후 다시 시도해 주세요', 'Riot API 요청 한도를 넘었어요. 1~2분 뒤에 다시 검색해 주세요.', 503);
      if (e.status === 401 || e.status === 403) {
        console.error('Riot API 키 오류', e.message);
        return message(c, '지금은 검색할 수 없어요', 'Riot API 키가 만료되었거나 잘못되었어요. 관리자가 확인 중이에요.', 503);
      }
    }
    throw e;
  }
});

// --- 챔피언 ----------------------------------------------------------------
app.get('/champions', async (c) => {
  const position = c.req.query('position');
  const group = tierGroup(c.req.query('tier'));
  const [dd, rows] = await Promise.all([ddragon(), tierList(db(c), group.tiers)]);
  cacheable(c);
  return page(c, <TierList dd={dd} rows={rows} position={isPosition(position) ? position : 'MIDDLE'} tier={group.key} />, {
    title: '챔피언 티어',
    script: filterScript,
  });
});

app.get('/champions/all', async (c) => {
  const dd = await ddragon();
  cacheable(c, 3600);
  return page(c, <ChampionIndex dd={dd} />, { title: '챔피언 정보', script: filterScript });
});

app.get('/champions/:slug', async (c) => {
  const dd = await ddragon();
  const full = await dd.championFull(c.req.param('slug'));
  if (!full) return message(c, '챔피언을 찾을 수 없어요', '주소를 다시 확인해 주세요.');
  // 소문자/다른 표기로 들어오면 정식 주소로
  if (c.req.param('slug') !== full.id) {
    const qs = new URL(c.req.url).search;
    return c.redirect(`/champions/${full.id}${qs}`, 301);
  }
  const position = c.req.query('position');
  const group = tierGroup(c.req.query('tier'));
  const { data, error } = await db(c).rpc('champion_detail', {
    p_champion: Number(full.key),
    p_position: isPosition(position) ? position : null,
    p_tiers: group.tiers,
    p_days: 14,
  });
  if (error) console.warn('champion_detail', error.message);
  cacheable(c);
  return page(c, <Champion dd={dd} full={full} d={(data as ChampionDetailData) ?? null} tier={group.key} />, {
    title: `${full.name} 장단점·카운터`,
    description: `${full.name}의 장점과 약점, 상대하기 쉬운·어려운 챔피언, 핵심 아이템과 룬`,
    darkNav: true,
  });
});

// --- Riot 사이트 인증 / 상태 확인 ---------------------------------------------
app.get('/riot.txt', (c) => (c.env.RIOT_VERIFICATION ? c.text(c.env.RIOT_VERIFICATION) : c.notFound()));

app.get('/healthz', async (c) => {
  const { data, error } = await db(c).rpc('meta_summary', { p_days: 14 });
  return c.json({ ok: !error, db: error ? error.message : 'ok', summary: data ?? null });
});

app.notFound((c) => message(c, '페이지를 찾을 수 없어요', '주소를 다시 확인해 주세요.'));
app.onError((e, c) => {
  console.error(e);
  return message(c, '오류가 발생했어요', '잠시 후 다시 시도해 주세요.', 500);
});

export default {
  fetch: app.fetch,
  // 5분마다 티어별 경기 수집 (wrangler.jsonc triggers.crons)
  async scheduled(controller: ScheduledController, env: Env['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(collect(env, controller.scheduledTime).catch((e) => console.error('collector 실패', e)));
  },
} satisfies ExportedHandler<Env['Bindings']>;
