import type { Context } from 'hono';
import { mapLimit, RiotClient, type LeagueEntry, type Match, type Participant, type Team } from './riot';
import { adminClient, type Env } from './supabase';

export type GameRow = {
  matchId: string;
  durationMin: number;
  me: Participant;
  blue: Team;
  red: Team;
  bluePlayers: string[];
  redPlayers: string[];
};

export type SummonerView = {
  gameName: string;
  tagLine: string;
  profileIconId: number;
  summonerLevel: number;
  leagues: LeagueEntry[];
  games: GameRow[];
  most: { championId: number; count: number; wins: number } | null;
};

const QUEUE_ORDER = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR'];

// 캐시에 있는 경기는 DB 에서, 없는 경기만 Riot 에서 받아온다
async function loadMatches(c: Context<Env>, riot: RiotClient, ids: string[]): Promise<Match[]> {
  const db = adminClient(c);
  const cached = new Map<string, Match>();
  try {
    const { data, error } = await db.from('match_cache').select('match_id, data').in('match_id', ids);
    if (error) throw error;
    for (const row of data ?? []) cached.set(row.match_id, row.data as Match);
  } catch (e) {
    console.warn('match_cache 조회 실패, Riot API 로만 진행', e);
  }

  const missing = ids.filter((id) => !cached.has(id));
  const fetched = await mapLimit(missing, 5, (id) => riot.match(id));

  if (fetched.length) {
    // 응답을 늦추지 않도록 저장은 백그라운드로
    c.executionCtx.waitUntil(saveMatches(c, fetched));
  }

  const byId = new Map([...cached, ...fetched.map((m) => [m.metadata.matchId, m] as const)]);
  return ids.map((id) => byId.get(id)).filter((m): m is Match => !!m);
}

async function saveMatches(c: Context<Env>, matches: Match[]) {
  const db = adminClient(c);
  const { error } = await db.from('match_cache').upsert(
    matches.map((m) => ({
      match_id: m.metadata.matchId,
      data: m,
      game_creation: new Date(m.info.gameCreation).toISOString(),
    })),
    { onConflict: 'match_id', ignoreDuplicates: true },
  );
  if (error) return console.warn('match_cache 저장 실패', error.message);

  const participants = matches.flatMap((m) =>
    m.info.participants.map((p) => ({
      match_id: m.metadata.matchId,
      puuid: p.puuid,
      champion_id: p.championId,
      team_position: p.teamPosition || 'NONE',
      win: p.win,
    })),
  );
  const res = await db.from('match_participants').upsert(participants, { onConflict: 'match_id,puuid', ignoreDuplicates: true });
  if (res.error) console.warn('match_participants 저장 실패', res.error.message);
}

export async function searchSummoner(c: Context<Env>, gameName: string, tagLine: string): Promise<SummonerView> {
  const riot = new RiotClient(c.env.RIOT_API_KEY, c.env.RIOT_REGION, c.env.RIOT_PLATFORM);
  const account = await riot.account(gameName, tagLine);

  // 원본은 이 셋을 순서대로 요청했다. 서로 의존하지 않으므로 동시에 요청
  const [summoner, leagues, ids] = await Promise.all([
    riot.summoner(account.puuid),
    riot.leagues(account.puuid),
    riot.matchIds(account.puuid, 20),
  ]);

  const matches = await loadMatches(c, riot, ids);

  const games: GameRow[] = [];
  for (const m of matches) {
    const me = m.info.participants.find((p) => p.puuid === account.puuid);
    if (!me) continue;
    const name = (p: Participant) => p.riotIdGameName || '알 수 없음';
    games.push({
      matchId: m.metadata.matchId,
      durationMin: Math.floor(m.info.gameDuration / 60),
      me,
      blue: m.info.teams.find((t) => t.teamId === 100)!,
      red: m.info.teams.find((t) => t.teamId === 200)!,
      bluePlayers: m.info.participants.filter((p) => p.teamId === 100).map(name),
      redPlayers: m.info.participants.filter((p) => p.teamId === 200).map(name),
    });
  }

  // 모스트 원: 최근 경기에서 가장 많이 플레이한 챔피언
  const counts = new Map<number, { count: number; wins: number }>();
  for (const g of games) {
    const cur = counts.get(g.me.championId) ?? { count: 0, wins: 0 };
    cur.count++;
    if (g.me.win) cur.wins++;
    counts.set(g.me.championId, cur);
  }
  let most: SummonerView['most'] = null;
  for (const [championId, v] of counts) if (!most || v.count > most.count) most = { championId, ...v };

  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    profileIconId: summoner.profileIconId,
    summonerLevel: summoner.summonerLevel,
    leagues: leagues
      .filter((l) => QUEUE_ORDER.includes(l.queueType))
      .sort((a, b) => QUEUE_ORDER.indexOf(a.queueType) - QUEUE_ORDER.indexOf(b.queueType)),
    games,
    most,
  };
}
