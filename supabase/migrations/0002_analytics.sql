-- WGM.GG 2편: 로그인 없는 분석 플랫폼으로 개편
--  1) 로그인 기반 기능(팁, 유저매칭) 제거
--  2) 매치 원본 JSON(1건 약 85KB) 대신 분석에 필요한 값만 저장 → 무료 DB 용량 안에서 자동 수집
--  3) 티어표 / 챔피언 상세 / 라인 평균 비교용 집계 함수
-- 모든 테이블은 서버(secret key)만 읽고 쓴다. RLS 를 켜고 정책을 두지 않아 anon 접근은 막힌다.

-- 1. 정리 --------------------------------------------------------------------
drop view  if exists public.lane_champion_stats;
drop table if exists public.match_participants;
drop table if exists public.match_cache;
drop table if exists public.tips;
drop table if exists public.duo_profiles;

-- 2. 경기 ---------------------------------------------------------------------
create table public.matches (
  match_id      text primary key,
  game_creation timestamptz not null,
  duration_s    int  not null,
  patch         text not null,              -- "16.21"
  tier          text,                       -- 표본 티어 (수집한 리그 또는 검색한 소환사의 티어)
  source        text not null check (source in ('search', 'collector')),
  teams         jsonb not null,             -- [{teamId, win, objectives: {tower, inhibitor, baron, dragon, riftHerald, horde}}]
  bans          int[] not null default '{}',
  created_at    timestamptz not null default now()
);

create index matches_creation_idx on public.matches (game_creation);

create table public.match_participants (
  match_id        text not null references public.matches (match_id) on delete cascade,
  puuid           text not null,
  riot_name       text not null,
  riot_tag        text not null,
  team_id         smallint not null,
  team_position   text not null,
  champion_id     int  not null,
  opponent_id     int,                      -- 같은 라인 상대 챔피언
  champ_level     smallint not null,
  win             boolean not null,
  kills           smallint not null,
  deaths          smallint not null,
  assists         smallint not null,
  cs              int  not null,
  cs10            real,                     -- 10분 라인 CS
  gold            int  not null,
  damage          int  not null,            -- 챔피언에게 가한 피해
  damage_taken    int  not null,
  vision          int  not null,
  kill_part       real,                     -- 킬 관여율 0~1
  damage_share    real,                     -- 팀 내 딜 비중 0~1
  solo_kills      smallint not null default 0,
  largest_multi   smallint not null default 0,
  items           int[] not null,
  keystone        int,
  primary_style   int,
  sub_style       int,
  spells          int[] not null,
  -- 집계 속도를 위해 경기 정보 일부를 복사
  tier            text,
  patch           text not null,
  duration_s      int  not null,
  game_creation   timestamptz not null,
  primary key (match_id, puuid)
);

create index mp_puuid_idx    on public.match_participants (puuid, game_creation desc);
create index mp_champion_idx on public.match_participants (champion_id, team_position, game_creation);
create index mp_position_idx on public.match_participants (team_position, tier, game_creation);

alter table public.matches            enable row level security;
alter table public.match_participants enable row level security;

-- 3. 집계 함수 ----------------------------------------------------------------
-- p_tiers 가 null 이면 전체 티어. p_days 는 최근 며칠 경기만 볼지.

-- 데이터 현황 (홈 화면)
create or replace function public.meta_summary(p_days int default 14)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'matches',       count(*),
    'latest_patch',  (select patch from public.matches order by game_creation desc limit 1),
    'last_collected', max(created_at),
    'by_tier',       (select coalesce(jsonb_object_agg(coalesce(tier, 'UNKNOWN'), n), '{}'::jsonb)
                      from (select tier, count(*) n from public.matches
                            where game_creation > now() - make_interval(days => p_days) group by tier) t)
  )
  from public.matches
  where game_creation > now() - make_interval(days => p_days);
$$;

-- 티어표: 라인별 챔피언 승률/픽률/밴률
create or replace function public.tier_list(p_tiers text[] default null, p_days int default 14)
returns table (champion_id int, team_position text, games int, wins int, bans int, total_matches int)
language sql stable as $$
  with m as (
    select match_id, bans from public.matches
    where game_creation > now() - make_interval(days => p_days)
      and (p_tiers is null or tier = any (p_tiers))
  ),
  total as (select count(*)::int n from m),
  picks as (
    select p.champion_id, p.team_position, count(*)::int games, count(*) filter (where p.win)::int wins
    from public.match_participants p
    join m using (match_id)
    where p.team_position in ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY')
    group by p.champion_id, p.team_position
  ),
  banned as (
    select b as champion_id, count(distinct match_id)::int bans
    from m, unnest(m.bans) b where b > 0 group by b
  )
  select picks.champion_id, picks.team_position, picks.games, picks.wins,
         coalesce(banned.bans, 0), total.n
  from picks cross join total left join banned using (champion_id);
$$;

-- 라인 평균 (소환사 장단점 비교 기준)
create or replace function public.position_benchmark(p_position text, p_tiers text[] default null, p_days int default 14)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'games', count(*),
    'win_rate', avg(win::int),
    'kda',  sum(kills + assists)::real / greatest(sum(deaths), 1),
    'kp',   avg(kill_part),
    'csm',  sum(cs)::real   / greatest(sum(duration_s), 1) * 60,
    'cs10', avg(cs10),
    'gpm',  sum(gold)::real / greatest(sum(duration_s), 1) * 60,
    'dpm',  sum(damage)::real / greatest(sum(duration_s), 1) * 60,
    'dmg_share', avg(damage_share),
    'vpm',  sum(vision)::real / greatest(sum(duration_s), 1) * 60,
    'dthm', sum(deaths)::real / greatest(sum(duration_s), 1) * 60
  )
  from public.match_participants
  where team_position = p_position
    and game_creation > now() - make_interval(days => p_days)
    and (p_tiers is null or tier = any (p_tiers));
$$;

-- 챔피언 상세: 라인별 성적, 상대 전적, 아이템, 룬, 주문, 게임 시간대별 승률
create or replace function public.champion_detail(p_champion int, p_position text default null, p_tiers text[] default null, p_days int default 14)
returns jsonb language sql stable as $$
  with base as (
    select * from public.match_participants
    where champion_id = p_champion
      and game_creation > now() - make_interval(days => p_days)
      and (p_tiers is null or tier = any (p_tiers))
  ),
  pos as (
    select coalesce(p_position,
      (select team_position from base where team_position <> '' group by team_position order by count(*) desc limit 1)) as position
  ),
  b as (select base.* from base, pos where base.team_position = pos.position)
  select jsonb_build_object(
    'position', (select position from pos),
    'positions', (select coalesce(jsonb_agg(jsonb_build_object('position', team_position, 'games', g, 'wins', w) order by g desc), '[]')
                  from (select team_position, count(*) g, count(*) filter (where win) w from base
                        where team_position <> '' group by team_position) x),
    'games', (select count(*) from b),
    'wins',  (select count(*) filter (where win) from b),
    'kda',   (select sum(kills + assists)::real / greatest(sum(deaths), 1) from b),
    'matchups', (select coalesce(jsonb_agg(jsonb_build_object('champion_id', opponent_id, 'games', g, 'wins', w)), '[]')
                 from (select opponent_id, count(*) g, count(*) filter (where win) w from b
                       where opponent_id is not null group by opponent_id) x),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', item, 'games', g, 'wins', w) order by g desc), '[]')
              from (select item, count(*) g, count(*) filter (where win) w
                    from b, unnest(b.items) item where item > 0 group by item order by g desc limit 40) x),
    'keystones', (select coalesce(jsonb_agg(jsonb_build_object('id', keystone, 'sub', sub_style, 'games', g, 'wins', w) order by g desc), '[]')
                  from (select keystone, sub_style, count(*) g, count(*) filter (where win) w
                        from b where keystone is not null group by keystone, sub_style order by g desc limit 5) x),
    'spells', (select coalesce(jsonb_agg(jsonb_build_object('ids', s, 'games', g, 'wins', w) order by g desc), '[]')
               from (select (select array_agg(v order by v) from unnest(spells) v) s, count(*) g, count(*) filter (where win) w
                     from b group by 1 order by g desc limit 3) x),
    'durations', (select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'games', g, 'wins', w) order by bucket), '[]')
                  from (select least(duration_s / 300, 8) * 5 as bucket, count(*) g, count(*) filter (where win) w
                        from b group by 1) x)
  );
$$;

-- 오래된 경기 정리 (용량 관리)
create or replace function public.purge_old_matches(p_days int default 30)
returns int language sql as $$
  with d as (delete from public.matches where game_creation < now() - make_interval(days => p_days) returning 1)
  select count(*)::int from d;
$$;

revoke execute on function public.meta_summary, public.tier_list, public.position_benchmark,
  public.champion_detail, public.purge_old_matches from public, anon, authenticated;
