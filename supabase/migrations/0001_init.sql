-- WGM.GG 초기 스키마 (MongoDB 컬렉션 → Postgres 테이블)
--   user_Info           → Supabase Auth (auth.users) 가 대신함
--   tip_List            → public.tips
--   matching_user_info  → public.duo_profiles
--   (신규) 매치 캐시    → public.match_cache, public.match_participants

-- 1. 나만의 팁 ---------------------------------------------------------------
create table public.tips (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null,
  lane        text not null check (lane in ('탑', '정글', '미드', '원딜', '서포터')),
  youtube_id  text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title       text not null check (char_length(title) between 1 and 100),
  body        text not null check (char_length(body) between 1 and 5000),
  created_at  timestamptz not null default now()
);

alter table public.tips enable row level security;

create policy "누구나 팁을 볼 수 있음" on public.tips
  for select using (true);

create policy "로그인한 사용자는 자기 이름으로 팁 작성" on public.tips
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "작성자만 삭제" on public.tips
  for delete to authenticated using (user_id = (select auth.uid()));

-- 2. 듀오 매칭 ---------------------------------------------------------------
create table public.duo_profiles (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null,
  riot_id     text not null check (char_length(riot_id) between 3 and 40),
  lane        text not null check (lane in ('탑', '정글', '미드', '원딜', '서포터', '올라이너')),
  champion    text not null check (char_length(champion) between 1 and 30),
  -- 등록할 때 Riot API 로 확인한 솔로랭크 정보 (원본에서 비어 있던 "승률" 칸)
  tier        text,
  wins        int,
  losses      int,
  updated_at  timestamptz not null default now()
);

alter table public.duo_profiles enable row level security;

create policy "로그인한 사용자만 매칭 목록 조회" on public.duo_profiles
  for select to authenticated using (true);

create policy "내 매칭 정보 등록" on public.duo_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "내 매칭 정보 수정" on public.duo_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 3. 매치 캐시 ---------------------------------------------------------------
-- 끝난 경기는 바뀌지 않으므로 한 번 받은 match-v5 응답을 저장해 두고 재사용한다.
-- 서버(secret key)만 읽고 쓴다. 정책이 없으므로 anon/authenticated 는 접근 불가.
create table public.match_cache (
  match_id      text primary key,
  data          jsonb not null,
  game_creation timestamptz not null,
  created_at    timestamptz not null default now()
);

alter table public.match_cache enable row level security;

-- 4. 라인별 챔피언 통계 (op.gg 크롤링 대체) -----------------------------------
-- 우리 사이트에서 검색된 경기에 등장한 모든 참가자를 쌓아서 라인별 승률을 낸다.
create table public.match_participants (
  match_id      text not null references public.match_cache (match_id) on delete cascade,
  puuid         text not null,
  champion_id   int  not null,
  team_position text not null,
  win           boolean not null,
  primary key (match_id, puuid)
);

create index match_participants_lane_idx on public.match_participants (team_position, champion_id);

alter table public.match_participants enable row level security;

create policy "누구나 통계용 참가자 데이터 조회" on public.match_participants
  for select using (true);

create view public.lane_champion_stats
with (security_invoker = true) as
select
  team_position,
  champion_id,
  count(*)::int                                   as games,
  count(*) filter (where win)::int                as wins,
  round(100.0 * count(*) filter (where win) / count(*), 1) as win_rate
from public.match_participants
where team_position in ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY')
group by team_position, champion_id
having count(*) >= 5;

grant select on public.lane_champion_stats to anon, authenticated;
