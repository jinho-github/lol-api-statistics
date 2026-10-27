// 자동 수집 (Cron, 5분마다)
// 검색된 경기만으로는 티어표/비교 기준이 너무 적어서, 티어별 플레이어를 골라 최근 솔로랭크 경기를 조금씩 모은다.
// 한 번 실행에 Riot API 최대 17회 → 개발 키 한도(2분 100회)의 일부만 쓴다.

import { createClient } from '@supabase/supabase-js';
import { mapLimit, RiotClient, SOLO_RANK_QUEUE, type LeagueEntry } from './riot';
import { compact, existingMatchIds, saveMatches } from './store';
import type { Env } from './supabase';

const DIVISIONS = ['I', 'II', 'III', 'IV'];
const SLOTS: { tier: string; division?: string }[] = [
  ...['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'].flatMap((tier) =>
    DIVISIONS.map((division) => ({ tier, division })),
  ),
  { tier: 'MASTER' },
  { tier: 'GRANDMASTER' },
  { tier: 'CHALLENGER' },
];

// 낮은 티어에는 오래 쉰 플레이어가 많아서 최근 14일 경기만 요청한다. 빈손으로 끝나는 플레이어가 있으니 6명을 본다
const PLAYERS_PER_RUN = 6;
const MATCHES_PER_PLAYER = 4;
const MAX_NEW_MATCHES = 10;
const RECENT_DAYS = 14;

const pickRandom = <T>(arr: T[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

export async function collect(env: Env['Bindings'], scheduledTime: number) {
  const run = Math.floor(scheduledTime / (5 * 60 * 1000));
  const slot = SLOTS[run % SLOTS.length];
  const riot = new RiotClient(env.RIOT_API_KEY, env.RIOT_REGION, env.RIOT_PLATFORM);
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

  let entries: LeagueEntry[];
  if (slot.division) {
    entries = await riot.leagueEntries(slot.tier, slot.division, 1 + (run % 3));
  } else {
    entries = (await riot.apexLeague(slot.tier as 'MASTER' | 'GRANDMASTER' | 'CHALLENGER')).entries;
  }
  // 시즌 판수가 많은 플레이어일수록 최근에도 게임을 했을 가능성이 높다
  const active = entries
    .filter((e) => e.puuid && !e.inactive)
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses))
    .slice(0, 40);
  const players = pickRandom(active, PLAYERS_PER_RUN);

  const since = scheduledTime / 1000 - RECENT_DAYS * 86400;
  const idLists = await mapLimit(players, 3, (p) =>
    riot.matchIds(p.puuid!, MATCHES_PER_PLAYER, SOLO_RANK_QUEUE, since).catch(() => [] as string[]),
  );
  const ids = [...new Set(idLists.flat())];
  const have = await existingMatchIds(db, ids);
  const todo = ids.filter((id) => !have.has(id)).slice(0, MAX_NEW_MATCHES);

  const matches = (await mapLimit(todo, 3, (id) => riot.match(id).catch(() => null)))
    .filter((m) => m && m.info.queueId === SOLO_RANK_QUEUE)
    .map((m) => compact(m!, slot.tier, 'collector'));
  await saveMatches(db, matches);

  // 한 시간에 한 번 오래된 경기 정리
  let purged = 0;
  if (run % 12 === 0) {
    const { data } = await db.rpc('purge_old_matches', { p_days: 30 });
    purged = (data as number) ?? 0;
  }

  console.log(
    `collector ${slot.tier} ${slot.division ?? ''}: players=${players.length} ids=${ids.length} new=${matches.length} purged=${purged}`,
  );
}
