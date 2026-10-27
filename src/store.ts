// 경기 저장/조회
// match-v5 원본(약 85KB)은 저장하지 않고 분석에 필요한 값만 matches / match_participants 에 남긴다

import type { SupabaseClient } from '@supabase/supabase-js';
import { mapLimit, RiotClient, SOLO_RANK_QUEUE, type Match } from './riot';

export type MatchRow = {
  match_id: string;
  game_creation: string;
  duration_s: number;
  patch: string;
  tier: string | null;
  source: 'search' | 'collector';
  teams: { teamId: number; win: boolean; objectives: Record<string, number> }[];
  bans: number[];
};

export type ParticipantRow = {
  match_id: string;
  puuid: string;
  riot_name: string;
  riot_tag: string;
  team_id: number;
  team_position: string;
  champion_id: number;
  opponent_id: number | null;
  champ_level: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  cs10: number | null;
  gold: number;
  damage: number;
  damage_taken: number;
  vision: number;
  kill_part: number | null;
  damage_share: number | null;
  solo_kills: number;
  largest_multi: number;
  items: number[];
  keystone: number | null;
  primary_style: number | null;
  sub_style: number | null;
  spells: number[];
  tier: string | null;
  patch: string;
  duration_s: number;
  game_creation: string;
};

export type StoredMatch = MatchRow & { participants: ParticipantRow[] };

export function compact(m: Match, tier: string | null, source: MatchRow['source']): StoredMatch {
  const info = m.info;
  const patch = info.gameVersion.split('.').slice(0, 2).join('.');
  const game_creation = new Date(info.gameCreation).toISOString();
  const row: MatchRow = {
    match_id: m.metadata.matchId,
    game_creation,
    duration_s: info.gameDuration,
    patch,
    tier,
    source,
    teams: info.teams.map((t) => ({
      teamId: t.teamId,
      win: t.win,
      objectives: Object.fromEntries(Object.entries(t.objectives).map(([k, v]) => [k, v.kills])),
    })),
    bans: info.teams.flatMap((t) => t.bans.map((b) => b.championId)).filter((id) => id > 0),
  };
  const participants = info.participants.map((p): ParticipantRow => {
    const primary = p.perks.styles.find((s) => s.description === 'primaryStyle');
    const sub = p.perks.styles.find((s) => s.description === 'subStyle');
    const opponent = info.participants.find((o) => o.teamId !== p.teamId && o.teamPosition && o.teamPosition === p.teamPosition);
    return {
      match_id: row.match_id,
      puuid: p.puuid,
      riot_name: p.riotIdGameName || '알 수 없음',
      riot_tag: p.riotIdTagline || '',
      team_id: p.teamId,
      team_position: p.teamPosition || '',
      champion_id: p.championId,
      opponent_id: opponent?.championId ?? null,
      champ_level: p.champLevel,
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: p.totalMinionsKilled + p.neutralMinionsKilled,
      cs10: p.challenges?.laneMinionsFirst10Minutes ?? null,
      gold: p.goldEarned,
      damage: p.totalDamageDealtToChampions,
      damage_taken: p.totalDamageTaken,
      vision: p.visionScore,
      kill_part: p.challenges?.killParticipation ?? null,
      damage_share: p.challenges?.teamDamagePercentage ?? null,
      solo_kills: p.challenges?.soloKills ?? 0,
      largest_multi: p.largestMultiKill,
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
      keystone: primary?.selections[0]?.perk ?? null,
      primary_style: primary?.style ?? null,
      sub_style: sub?.style ?? null,
      spells: [p.summoner1Id, p.summoner2Id],
      tier,
      patch,
      duration_s: info.gameDuration,
      game_creation,
    };
  });
  return { ...row, participants };
}

export async function saveMatches(db: SupabaseClient, matches: StoredMatch[]) {
  if (!matches.length) return;
  const { error } = await db
    .from('matches')
    .upsert(matches.map(({ participants, ...m }) => m), { onConflict: 'match_id', ignoreDuplicates: true });
  if (error) throw new Error(`matches 저장 실패: ${error.message}`);
  const res = await db
    .from('match_participants')
    .upsert(matches.flatMap((m) => m.participants), { onConflict: 'match_id,puuid', ignoreDuplicates: true });
  if (res.error) throw new Error(`match_participants 저장 실패: ${res.error.message}`);
}

export async function existingMatchIds(db: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const { data, error } = await db.from('matches').select('match_id').in('match_id', ids);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.match_id as string));
}

async function loadStored(db: SupabaseClient, ids: string[]): Promise<Map<string, StoredMatch>> {
  const out = new Map<string, StoredMatch>();
  if (!ids.length) return out;
  const [m, p] = await Promise.all([
    db.from('matches').select('*').in('match_id', ids),
    db.from('match_participants').select('*').in('match_id', ids),
  ]);
  if (m.error || p.error) throw new Error((m.error ?? p.error)!.message);
  for (const row of (m.data ?? []) as MatchRow[]) out.set(row.match_id, { ...row, participants: [] });
  for (const row of (p.data ?? []) as ParticipantRow[]) out.get(row.match_id)?.participants.push(row);
  // 참가자가 덜 저장된 경기는 다시 받는다
  for (const [id, sm] of out) if (sm.participants.length < 10) out.delete(id);
  return out;
}

// 소환사 검색: DB 에 있는 경기는 DB 에서, 없는 경기만 Riot 에서 받아 저장
export async function recentMatches(
  db: SupabaseClient,
  riot: RiotClient,
  ids: string[],
  tier: string | null,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<StoredMatch[]> {
  let stored = new Map<string, StoredMatch>();
  try {
    stored = await loadStored(db, ids);
  } catch (e) {
    console.warn('저장된 경기 조회 실패, Riot API 로만 진행', e);
  }
  const missing = ids.filter((id) => !stored.has(id));
  const fetched = (await mapLimit(missing, 5, (id) => riot.match(id)))
    .filter((m) => m.info.queueId === SOLO_RANK_QUEUE)
    .map((m) => compact(m, tier, 'search'));
  if (fetched.length) waitUntil(saveMatches(db, fetched).catch((e) => console.warn(String(e))));
  for (const m of fetched) stored.set(m.match_id, m);
  return ids.map((id) => stored.get(id)).filter((m): m is StoredMatch => !!m);
}
