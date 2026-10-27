import type { TierListRow } from '../analysis';
import type { DDragon } from '../ddragon';
import { adjustedWinRate, POSITIONS, pct } from '../meta';

export type MetaSummary = { matches: number; latest_patch: string | null; last_collected: string | null; by_tier: Record<string, number> };

export function Home({ dd, rows, summary }: { dd: DDragon; rows: TierListRow[]; summary: MetaSummary | null }) {
  // 라인별 1위 (표본 20게임 이상, 표본 보정 승률 기준)
  const tops = POSITIONS.map((p) => {
    const best = rows
      .filter((r) => r.team_position === p.key && r.games >= 20)
      .sort((a, b) => adjustedWinRate(b.wins, b.games) - adjustedWinRate(a.wins, a.games))[0];
    return { position: p, best };
  });
  const matches = summary?.matches ?? 0;

  return (
    <>
      <section class="band dark">
        <div class="container hero">
          <div>
            <p class="eyebrow">League of Legends · 솔로랭크 분석</p>
            <h1 class="display" style="margin-top:20px">
              내 플레이를
              <br />
              숫자로 진단하다
            </h1>
            <p style="margin-top:24px;font-size:18px;max-width:520px">
              Riot ID만 입력하면 최근 20게임을 같은 티어·같은 라인 평균과 비교해서 장점과 약점, 추천 챔피언을 알려드려요. 로그인은 필요 없어요.
            </p>
            <form class="hero-search" action="/search">
              <input class="input" name="q" placeholder="Hide on bush#KR1" aria-label="Riot ID" required autofocus />
              <button class="btn lg" type="submit">
                분석하기
              </button>
            </form>
            <p class="small" style="margin-top:12px">
              태그를 생략하면 #KR1 로 찾아요. 예시: <a href="/summoner/Hide%20on%20bush/KR1">Hide on bush#KR1</a>
            </p>
          </div>

          <div class="mock-stack">
            <div class="mock">
              <p class="eyebrow" style="color:var(--on-dark-soft)">이번 2주 라인별 승률 1위</p>
              <div style="margin-top:12px">
                {tops.map(({ position, best }) => (
                  <div class="row">
                    <span class="badge dark" style="min-width:56px;justify-content:center">
                      {position.label}
                    </span>
                    {best ? (
                      <>
                        <img class="icon" src={dd.championImg(best.champion_id)} alt="" />
                        <a href={`/champions/${dd.championSlug(best.champion_id)}?position=${position.key}`} style="color:var(--on-dark);flex:1">
                          {dd.championName(best.champion_id)}
                        </a>
                        <span class="num up">{pct(best.wins / best.games)}</span>
                      </>
                    ) : (
                      <span style="flex:1;color:var(--on-dark-soft)">데이터 수집 중</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div class="mock">
              <p class="eyebrow" style="color:var(--on-dark-soft)">분석 데이터</p>
              <p class="num" style="font-size:32px;color:var(--on-dark);margin-top:8px">{matches.toLocaleString()}</p>
              <p class="small">최근 14일 솔로랭크 경기 · 패치 {summary?.latest_patch ?? dd.patch}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="band">
        <div class="container">
          <h2 class="display-sm">로그인 없이, 분석에만 집중했어요</h2>
          <div class="grid g3" style="margin-top:48px">
            <a class="card" href="/summoner/Hide%20on%20bush/KR1">
              <span class="badge blue">소환사 분석</span>
              <p class="title-md" style="margin-top:20px">장점과 약점을 숫자로</p>
              <p style="margin-top:8px">KDA, 킬 관여율, 분당 CS·골드·피해량, 시야, 데스를 내 티어 같은 라인 평균과 비교해요.</p>
            </a>
            <a class="card" href="/champions">
              <span class="badge blue">챔피언 티어</span>
              <p class="title-md" style="margin-top:20px">내 티어에서 강한 챔피언</p>
              <p style="margin-top:8px">아이언–실버, 골드–플래티넘처럼 티어 구간별로 승률·픽률·밴률을 따로 집계해요.</p>
            </a>
            <a class="card" href="/champions/all">
              <span class="badge blue">챔피언 정보</span>
              <p class="title-md" style="margin-top:20px">챔피언별 장단점과 카운터</p>
              <p style="margin-top:8px">상대하기 쉬운·어려운 챔피언, 핵심 아이템과 룬, 게임 시간대별 승률을 보여줘요.</p>
            </a>
          </div>
        </div>
      </section>

      <section class="band soft tight">
        <div class="container">
          <p class="small muted">
            WGM.GG는 Riot API로 티어별 솔로랭크 경기를 5분마다 수집하고, 검색된 경기도 함께 집계해요. 최근 14일 경기만 통계에 쓰고 30일이 지난 경기는 지워요.
          </p>
        </div>
      </section>
    </>
  );
}
