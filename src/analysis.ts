// 소환사 분석: 최근 솔로랭크 경기 지표 → 같은 티어·라인 평균과 비교 → 장점/약점, 추천 챔피언

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DDragon } from './ddragon';
import { adjustedWinRate, grade, groupOfTier, TIER_GROUPS, type Position } from './meta';
import { RiotClient, SOLO_QUEUE, type LeagueEntry, type Mastery } from './riot';
import { recentMatches, type ParticipantRow, type StoredMatch } from './store';

export type Metrics = {
  games: number;
  win_rate: number;
  kda: number;
  kp: number | null;
  csm: number;
  cs10: number | null;
  gpm: number;
  dpm: number;
  dmg_share: number | null;
  vpm: number;
  dthm: number;
};

type MetricKey = Exclude<keyof Metrics, 'games'>;

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export function metricsOf(rows: ParticipantRow[]): Metrics {
  const sum = (f: (r: ParticipantRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const minutes = Math.max(sum((r) => r.duration_s) / 60, 1);
  return {
    games: rows.length,
    win_rate: rows.length ? sum((r) => +r.win) / rows.length : 0,
    kda: sum((r) => r.kills + r.assists) / Math.max(sum((r) => r.deaths), 1),
    kp: avg(rows.map((r) => r.kill_part)),
    csm: sum((r) => r.cs) / minutes,
    cs10: avg(rows.map((r) => r.cs10)),
    gpm: sum((r) => r.gold) / minutes,
    dpm: sum((r) => r.damage) / minutes,
    dmg_share: avg(rows.map((r) => r.damage_share)),
    vpm: sum((r) => r.vision) / minutes,
    dthm: sum((r) => r.deaths) / minutes,
  };
}

// 지표 설명과 개선 팁. lowerIsBetter 는 분당 데스처럼 낮을수록 좋은 지표
type MetricDef = {
  key: MetricKey;
  label: string;
  fmt: (v: number) => string;
  lowerIsBetter?: boolean;
  skip?: Position[];
  strong: string;
  weak: string;
  tip: string;
};

const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);
const p0 = (v: number) => `${Math.round(v * 100)}%`;
const n0 = (v: number) => Math.round(v).toLocaleString();

export const METRICS: MetricDef[] = [
  {
    key: 'kda',
    label: 'KDA',
    fmt: f2,
    strong: '교전에서 오래 살아남으면서 킬·어시스트를 꾸준히 챙겨요.',
    weak: '죽는 횟수에 비해 킬·어시스트가 적어요.',
    tip: '불리한 교전은 피하고, 시야가 확보된 곳에서 싸우세요. 킬보다 데스를 줄이는 것이 KDA에 더 크게 작용해요.',
  },
  {
    key: 'kp',
    label: '킬 관여율',
    fmt: p0,
    strong: '팀 교전 합류가 빠르고 팀 킬 대부분에 관여해요.',
    weak: '팀 싸움에 늦게 합류하거나 혼자 떨어져 있는 시간이 길어요.',
    tip: '미니맵을 5초마다 확인하고, 드래곤·전령 같은 오브젝트가 생기기 1분 전에는 합류를 준비하세요.',
  },
  {
    key: 'csm',
    label: '분당 CS',
    fmt: f1,
    skip: ['UTILITY'],
    strong: '라인 관리와 파밍이 좋아서 성장이 안정적이에요.',
    weak: 'CS를 많이 놓쳐서 같은 시간 대비 성장이 느려요.',
    tip: '10분에 CS 80개를 목표로 연습하고, 귀환 후에는 사이드 웨이브와 정글 캠프를 먼저 챙기세요.',
  },
  {
    key: 'cs10',
    label: '10분 CS',
    fmt: f1,
    skip: ['UTILITY', 'JUNGLE'],
    strong: '라인전 초반 막타 실력이 좋아요.',
    weak: '라인전 초반에 놓치는 CS가 많아요.',
    tip: '견제보다 막타를 우선하고, 포탑 아래에서는 포탑 한 대 + 평타 한 대로 처리하는 타이밍을 익히세요.',
  },
  {
    key: 'gpm',
    label: '분당 골드',
    fmt: n0,
    strong: '골드 수급이 좋아 아이템이 빨리 나와요.',
    weak: '골드 수급이 느려 핵심 아이템 완성이 늦어요.',
    tip: 'CS, 포탑 방패, 킬 관여를 함께 챙기세요. 서포터라면 퀘스트 아이템을 빨리 완료하는 것이 중요해요.',
  },
  {
    key: 'dpm',
    label: '분당 챔피언 피해',
    fmt: n0,
    strong: '교전에서 상대에게 넣는 피해량이 많아요.',
    weak: '교전에서 넣는 피해량이 적어요.',
    tip: '교전 전에 사거리 안에서 스킬을 아끼지 말고, 앞라인보다 딜러를 노릴 수 있는 위치를 잡으세요.',
  },
  {
    key: 'dmg_share',
    label: '팀 내 딜 비중',
    fmt: p0,
    skip: ['UTILITY'],
    strong: '팀 딜의 큰 몫을 책임지는 캐리형이에요.',
    weak: '팀 안에서 딜 비중이 낮은 편이에요.',
    tip: '성장한 뒤에는 한타에서 맞지 않는 거리에서 꾸준히 딜을 넣는 연습을 해 보세요.',
  },
  {
    key: 'vpm',
    label: '분당 시야 점수',
    fmt: f2,
    strong: '와드 설치와 제거로 시야 장악에 크게 기여해요.',
    weak: '시야 점수가 낮아서 팀이 기습에 취약해져요.',
    tip: '제어 와드를 항상 1개 이상 들고 다니고, 귀환하기 전에는 장신구 와드를 꼭 쓰세요.',
  },
  {
    key: 'dthm',
    label: '분당 데스',
    fmt: f2,
    lowerIsBetter: true,
    strong: '죽는 일이 적어서 상대에게 골드를 잘 내주지 않아요.',
    weak: '자주 죽어서 상대에게 골드와 시간을 내주고 있어요.',
    tip: '라인을 민 뒤에는 시야가 없는 곳으로 가지 말고, 상대 정글 위치를 모를 때는 무리하지 마세요.',
  },
];

export type Insight = { def: MetricDef; mine: number; bench: number; diff: number };

const THRESHOLD = 0.1; // 평균보다 10% 이상 차이 날 때만 장점/약점으로 본다

export function compare(position: Position | null, mine: Metrics, bench: Partial<Metrics> | null) {
  const strengths: Insight[] = [];
  const weaknesses: Insight[] = [];
  const all: Insight[] = [];
  if (!bench) return { strengths, weaknesses, all };
  for (const def of METRICS) {
    if (position && def.skip?.includes(position)) continue;
    const m = mine[def.key];
    const b = bench[def.key];
    if (m == null || b == null || !b) continue;
    const raw = (m - b) / b;
    const diff = def.lowerIsBetter ? -raw : raw;
    const insight = { def, mine: m, bench: b, diff };
    all.push(insight);
    if (diff >= THRESHOLD) strengths.push(insight);
    else if (diff <= -THRESHOLD) weaknesses.push(insight);
  }
  strengths.sort((a, b) => b.diff - a.diff);
  weaknesses.sort((a, b) => a.diff - b.diff);
  return { strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 3), all };
}

export type PoolEntry = { championId: number; games: number; wins: number; kda: number; csm: number };

export type Recommendation = { championId: number; kind: 'comfort' | 'meta' | 'mastery'; title: string; reason: string };

export type TierListRow = { champion_id: number; team_position: string; games: number; wins: number; bans: number; total_matches: number };

export type SummonerAnalysis = {
  gameName: string;
  tagLine: string;
  profileIconId: number;
  summonerLevel: number;
  solo: LeagueEntry | null;
  flex: LeagueEntry | null;
  matches: StoredMatch[];
  mine: ParticipantRow[];
  metrics: Metrics;
  mainPosition: Position | null;
  positionCounts: { position: string; games: number }[];
  benchmark: { metrics: Partial<Metrics> & { games: number }; label: string } | null;
  insights: ReturnType<typeof compare>;
  pool: PoolEntry[];
  durationSplit: { short: { games: number; wins: number }; long: { games: number; wins: number } };
  recommendations: Recommendation[];
};

const MIN_BENCH_GAMES = 100;

async function benchmark(db: SupabaseClient, position: Position, tier: string | null) {
  const group = groupOfTier(tier);
  const tries = group.tiers ? [group, TIER_GROUPS[0]] : [TIER_GROUPS[0]];
  for (const g of tries) {
    const { data, error } = await db.rpc('position_benchmark', { p_position: position, p_tiers: g.tiers, p_days: 14 });
    if (error) {
      console.warn('position_benchmark', error.message);
      return null;
    }
    const b = data as Partial<Metrics> & { games: number };
    if (b && b.games >= MIN_BENCH_GAMES) return { metrics: b, label: g.key === 'all' ? '전체 티어' : g.label };
  }
  return null;
}

export async function tierList(db: SupabaseClient, tiers: readonly string[] | null) {
  const { data, error } = await db.rpc('tier_list', { p_tiers: tiers, p_days: 14 });
  if (error) {
    console.warn('tier_list', error.message);
    return [] as TierListRow[];
  }
  return (data ?? []) as TierListRow[];
}

export async function analyzeSummoner(
  db: SupabaseClient,
  riot: RiotClient,
  dd: DDragon,
  gameName: string,
  tagLine: string,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<SummonerAnalysis> {
  const account = await riot.account(gameName, tagLine);
  // 서로 의존하지 않는 요청은 동시에
  const [summoner, leagues, ids, masteries] = await Promise.all([
    riot.summoner(account.puuid),
    riot.leagues(account.puuid),
    riot.matchIds(account.puuid, 20),
    riot.masteries(account.puuid, 10).catch(() => [] as Mastery[]),
  ]);
  const solo = leagues.find((l) => l.queueType === SOLO_QUEUE) ?? null;
  const flex = leagues.find((l) => l.queueType === 'RANKED_FLEX_SR') ?? null;

  const matches = await recentMatches(db, riot, ids, solo?.tier ?? null, waitUntil);
  const mine = matches.map((m) => m.participants.find((p) => p.puuid === account.puuid)).filter((p): p is ParticipantRow => !!p);
  const metrics = metricsOf(mine);

  const posMap = new Map<string, number>();
  for (const r of mine) if (r.team_position) posMap.set(r.team_position, (posMap.get(r.team_position) ?? 0) + 1);
  const positionCounts = [...posMap].map(([position, games]) => ({ position, games })).sort((a, b) => b.games - a.games);
  const mainPosition = (positionCounts[0]?.position as Position) ?? null;

  // 장단점은 주 라인 경기끼리만 비교해야 공정하다 (서포터 CS 를 미드 평균과 비교하지 않도록)
  const mainRows = mainPosition ? mine.filter((r) => r.team_position === mainPosition) : mine;
  const [bench, meta] = await Promise.all([
    mainPosition ? benchmark(db, mainPosition, solo?.tier ?? null) : Promise.resolve(null),
    tierList(db, groupOfTier(solo?.tier).tiers),
  ]);
  const insights = compare(mainPosition, metricsOf(mainRows), bench?.metrics ?? null);

  const poolMap = new Map<number, ParticipantRow[]>();
  for (const r of mine) poolMap.set(r.champion_id, [...(poolMap.get(r.champion_id) ?? []), r]);
  const pool: PoolEntry[] = [...poolMap]
    .map(([championId, rows]) => {
      const m = metricsOf(rows);
      return { championId, games: rows.length, wins: rows.filter((r) => r.win).length, kda: m.kda, csm: m.csm };
    })
    .sort((a, b) => b.games - a.games || b.wins - a.wins);

  const split = (pred: (r: ParticipantRow) => boolean) => {
    const rows = mine.filter(pred);
    return { games: rows.length, wins: rows.filter((r) => r.win).length };
  };

  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    profileIconId: summoner.profileIconId,
    summonerLevel: summoner.summonerLevel,
    solo,
    flex,
    matches,
    mine,
    metrics,
    mainPosition,
    positionCounts,
    benchmark: bench,
    insights,
    pool,
    durationSplit: { short: split((r) => r.duration_s < 25 * 60), long: split((r) => r.duration_s >= 30 * 60) },
    recommendations: recommend(dd, mainPosition, mainRows, pool, masteries, meta, solo?.tier ?? null),
  };
}

// 추천 챔피언
//  1) 주력 유지: 주 라인에서 성적이 가장 좋은 내 챔피언
//  2) 메타 추천: 내 티어 구간·주 라인에서 승률이 높은 챔피언 중 내 주력과 역할군이 같은 챔피언
//  3) 숙련도 활용: 숙련도가 높고 현재 메타에서도 괜찮은 챔피언
function recommend(
  dd: DDragon,
  position: Position | null,
  mainRows: ParticipantRow[],
  pool: PoolEntry[],
  masteries: Mastery[],
  meta: TierListRow[],
  tier: string | null,
): Recommendation[] {
  const out: Recommendation[] = [];
  const used = new Set<number>();
  const groupLabel = groupOfTier(tier).label;

  const minePos = new Map<number, { games: number; wins: number }>();
  for (const r of mainRows) {
    const cur = minePos.get(r.champion_id) ?? { games: 0, wins: 0 };
    cur.games++;
    if (r.win) cur.wins++;
    minePos.set(r.champion_id, cur);
  }
  const comfort = [...minePos]
    .filter(([, v]) => v.games >= 2)
    .sort((a, b) => adjustedWinRate(b[1].wins, b[1].games, 4) - adjustedWinRate(a[1].wins, a[1].games, 4))[0];
  if (comfort) {
    const [id, v] = comfort;
    const kda = pool.find((p) => p.championId === id)?.kda ?? 0;
    out.push({
      championId: id,
      kind: 'comfort',
      title: '주력으로 유지',
      reason: `최근 ${v.games}게임 ${v.wins}승 (승률 ${Math.round((v.wins / v.games) * 100)}%), KDA ${kda.toFixed(2)}`,
    });
    used.add(id);
  }

  const posMeta = position ? meta.filter((m) => m.team_position === position && m.games >= 20) : [];
  const ranked = posMeta
    .map((m) => ({ ...m, adj: adjustedWinRate(m.wins, m.games) }))
    .sort((a, b) => b.adj - a.adj);

  const mainTags = new Set(dd.champion(pool[0]?.championId ?? -1)?.tags ?? []);
  const metaPick = ranked.find((m) => !used.has(m.champion_id) && dd.champion(m.champion_id)?.tags.some((t) => mainTags.has(t)))
    ?? ranked.find((m) => !used.has(m.champion_id));
  if (metaPick && ['S', 'A', 'B'].includes(grade(metaPick.adj))) {
    const shared = dd.champion(metaPick.champion_id)?.tags.find((t) => mainTags.has(t));
    out.push({
      championId: metaPick.champion_id,
      kind: 'meta',
      title: '지금 메타 추천',
      reason: `${groupLabel} 승률 ${Math.round((metaPick.wins / metaPick.games) * 100)}% (${metaPick.games}게임)${
        shared ? ` · 주력 ${dd.championName(pool[0].championId)}와 같은 ${ROLE_KO[shared] ?? shared} 계열` : ''
      }`,
    });
    used.add(metaPick.champion_id);
  }

  for (const m of masteries) {
    if (used.has(m.championId)) continue;
    const row = ranked.find((r) => r.champion_id === m.championId);
    if (position && !row) continue;
    out.push({
      championId: m.championId,
      kind: 'mastery',
      title: '숙련도 활용',
      reason: `숙련도 ${m.championPoints.toLocaleString()}점${
        row ? ` · ${groupLabel} 승률 ${Math.round((row.wins / row.games) * 100)}% (${row.games}게임)` : ''
      }`,
    });
    break;
  }
  return out;
}

export const ROLE_KO: Record<string, string> = {
  Fighter: '전사',
  Tank: '탱커',
  Mage: '마법사',
  Assassin: '암살자',
  Marksman: '원거리 딜러',
  Support: '서포터',
};
