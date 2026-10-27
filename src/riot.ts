// Riot API 클라이언트
// 2020년 원본은 summoner/v4/by-name + match/v4 를 썼지만 두 API 모두 폐지됨.
// 지금은 Riot ID(gameName#tagLine) → PUUID → summoner/league/match-v5 순서로 조회한다.

export type Account = { puuid: string; gameName: string; tagLine: string };
export type Summoner = { puuid: string; profileIconId: number; summonerLevel: number };
export type LeagueEntry = {
  queueType: 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR' | string;
  tier: string;
  rank: string;
  puuid?: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};
export type Mastery = { championId: number; championLevel: number; championPoints: number; lastPlayTime: number };

export type Participant = {
  puuid: string;
  riotIdGameName: string;
  riotIdTagline: string;
  teamId: 100 | 200;
  teamPosition: string;
  championId: number;
  champLevel: number;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  visionScore: number;
  largestMultiKill: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  summoner1Id: number;
  summoner2Id: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  perks: { styles: { description: 'primaryStyle' | 'subStyle'; style: number; selections: { perk: number }[] }[] };
  challenges?: {
    killParticipation?: number;
    teamDamagePercentage?: number;
    laneMinionsFirst10Minutes?: number;
    soloKills?: number;
  };
};

type Objective = { first: boolean; kills: number };
export type Team = {
  teamId: 100 | 200;
  win: boolean;
  bans: { championId: number }[];
  objectives: Record<'baron' | 'dragon' | 'tower' | 'inhibitor' | 'riftHerald' | 'champion' | 'horde', Objective>;
};

export type Match = {
  metadata: { matchId: string };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameVersion: string;
    queueId: number;
    participants: Participant[];
    teams: Team[];
  };
};

export class RiotError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const SOLO_RANK_QUEUE = 420;
export const SOLO_QUEUE = 'RANKED_SOLO_5x5';

export class RiotClient {
  constructor(
    private apiKey: string,
    private region = 'asia', // account-v1, match-v5
    private platform = 'kr', // summoner-v4, league-v4, champion-mastery-v4
  ) {}

  private async get<T>(host: string, path: string, retries = 2): Promise<T> {
    const res = await fetch(`https://${host}.api.riotgames.com${path}`, {
      headers: { 'X-Riot-Token': this.apiKey },
    });
    // 개발 키는 1초 20회 / 2분 100회 제한. 429면 Retry-After 만큼 쉬고 다시 시도
    if (res.status === 429 && retries > 0) {
      const wait = Number(res.headers.get('Retry-After') ?? '1');
      await new Promise((r) => setTimeout(r, Math.min(wait, 5) * 1000));
      return this.get(host, path, retries - 1);
    }
    if (!res.ok) throw new RiotError(res.status, `${res.status} ${path}`);
    return res.json<T>();
  }

  account(gameName: string, tagLine: string) {
    const p = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    return this.get<Account>(this.region, p);
  }

  summoner(puuid: string) {
    return this.get<Summoner>(this.platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`);
  }

  leagues(puuid: string) {
    return this.get<LeagueEntry[]>(this.platform, `/lol/league/v4/entries/by-puuid/${puuid}`);
  }

  masteries(puuid: string, count = 10) {
    return this.get<Mastery[]>(this.platform, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`);
  }

  // 아이언~다이아: 티어/디비전별 페이지 조회
  leagueEntries(tier: string, division: string, page = 1) {
    return this.get<LeagueEntry[]>(this.platform, `/lol/league/v4/entries/${SOLO_QUEUE}/${tier}/${division}?page=${page}`);
  }

  // 마스터 이상은 리그 하나에 전원이 들어 있다
  apexLeague(tier: 'MASTER' | 'GRANDMASTER' | 'CHALLENGER') {
    const name = { MASTER: 'masterleagues', GRANDMASTER: 'grandmasterleagues', CHALLENGER: 'challengerleagues' }[tier];
    return this.get<{ entries: LeagueEntry[] }>(this.platform, `/lol/league/v4/${name}/by-queue/${SOLO_QUEUE}`);
  }

  matchIds(puuid: string, count = 20, queue = SOLO_RANK_QUEUE) {
    return this.get<string[]>(this.region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${queue}&count=${count}`);
  }

  match(matchId: string) {
    return this.get<Match>(this.region, `/lol/match/v5/matches/${matchId}`);
  }
}

// "Hide on bush#KR1" → ["Hide on bush", "KR1"]. 태그를 안 쓰면 KR1 로 가정
export function parseRiotId(input: string): [string, string] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const idx = trimmed.lastIndexOf('#');
  if (idx === -1) return [trimmed, 'KR1'];
  const name = trimmed.slice(0, idx).trim();
  const tag = trimmed.slice(idx + 1).trim();
  return name && tag ? [name, tag] : null;
}

// 동시에 너무 많이 요청하면 1초 20회 제한에 걸리므로 limit 개씩만 병렬 처리
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
