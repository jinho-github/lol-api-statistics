import type { DDragon } from '../ddragon';
import type { Tip } from './Tips';

// legacy/flask/templates_back/index.html
export type LaneStat = { team_position: string; champion_id: number; games: number; win_rate: number };

export const LANES = [
  { key: 'TOP', label: '탑' },
  { key: 'MIDDLE', label: '미드' },
  { key: 'JUNGLE', label: '정글' },
  { key: 'BOTTOM', label: '원딜' },
  { key: 'UTILITY', label: '서포터' },
] as const;

export const homeCss = `
body { padding-top: 2rem; }
@media (min-width: 576px) {
  .card-group.card-group-scroll { overflow-x: auto; flex-wrap: nowrap; }
  .card-group.card-group-scroll > .card { flex-basis: 35%; flex-shrink: 0; }
}`;

export function Home({ stats, tips, dd }: { stats: LaneStat[]; tips: Tip[]; dd: DDragon }) {
  const videos = tips.filter((t) => t.youtube_id).slice(0, 10);
  return (
    <>
      <main class="mt-5 pt-5">
        <div class="container">
          <section class="card" style="background: linear-gradient(135deg, #6a11cb, #2575fc);">
            <div class="card-body text-white text-center py-5 px-5 my-5">
              <h1 class="mb-4">
                <strong>소환사 정보 검색</strong>
              </h1>
              <p>
                <strong>소환사 정보를 검색해보세요!</strong>
              </p>
              <p class="mb-4">
                <strong>우정머는 전적 분석을 통해 소환사님의 실력 향상에 도움을 드립니다.</strong>
              </p>
              <form action="/search" class="form-inline justify-content-center">
                <input
                  type="text"
                  name="q"
                  class="form-control form-control-lg mr-2"
                  placeholder="Hide on bush#KR1"
                  aria-label="Riot ID"
                  required
                  style="min-width: 260px"
                />
                <input class="btn btn-outline-white btn-lg" type="submit" value="검색" />
              </form>
              <p class="mt-3 mb-0 small">Riot ID(게임 이름#태그)로 검색합니다. 태그를 생략하면 #KR1 로 찾아요.</p>
            </div>
          </section>

          <hr class="my-5" />

          <section>
            <h2 class="h3 text-center my-5 font-weight-bold">라인 별 챔피언 추천</h2>
            <div class="text-center my-5">
              {LANES.map((l) => (
                <button data-toggle="modal" data-target={`#lane_${l.key}`} type="button" class="btn btn-outline-primary waves-effect">
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          <hr />

          <section>
            <h2 class="h3 text-center my-5 font-weight-bold">추천 영상</h2>
            {videos.length === 0 ? (
              <p class="text-center text-muted">
                아직 등록된 영상이 없어요. <a href="/tips">나만의 팁</a>에 유튜브 영상을 올려 주세요!
              </p>
            ) : (
              <div class="card-group card-group-scroll">
                {videos.map((t) => (
                  <div class="card">
                    <iframe
                      width="100%"
                      height="250"
                      src={`https://www.youtube.com/embed/${t.youtube_id}`}
                      frameborder="0"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                      allowfullscreen
                    ></iframe>
                    <div class="card-body">
                      <h5 class="card-title">
                        {t.lane}에게 추천 <div class="text-right small">{t.author_name}</div>
                      </h5>
                      <p class="card-text">{t.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {LANES.map((l) => {
        const rows = stats
          .filter((s) => s.team_position === l.key)
          .sort((a, b) => b.win_rate - a.win_rate || b.games - a.games)
          .slice(0, 10);
        return (
          <div class="modal fade" id={`lane_${l.key}`} tabindex={-1} role="dialog" aria-hidden="true">
            <div class="modal-dialog modal-lg" role="document">
              <div class="modal-content">
                <div class="modal-header">
                  <h4 class="modal-title w-100">{l.label} 챔피언 추천</h4>
                  <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
                <div class="modal-body">
                  {rows.length === 0 ? (
                    <p class="text-muted text-center my-4">
                      아직 데이터가 모이는 중이에요. 소환사를 검색할수록 WGM.GG 사용자들의 경기로 승률이 쌓여요.
                    </p>
                  ) : (
                    <div class="row text-left">
                      {[rows.slice(0, 5), rows.slice(5, 10)].map((col, ci) => (
                        <div class="col-lg-6 col-md-12">
                          <hr />
                          {col.map((s, i) => (
                            <>
                              <div class="row align-items-center">
                                <div class="col-2">
                                  <h5 class={ci === 0 ? 'text-primary' : 'text-danger'}>
                                    <strong>{ci * 5 + i + 1}</strong>
                                  </h5>
                                </div>
                                <div class="col-3">
                                  <img src={dd.championImg(s.champion_id)} class="img-fluid rounded z-depth-1" alt="" />
                                </div>
                                <div class="col-7">
                                  <p class="dark-grey-text mb-0">
                                    <strong>{dd.championName(s.champion_id)}</strong>
                                  </p>
                                  <strong class="text-muted">
                                    승률 {s.win_rate}% ({s.games}게임)
                                  </strong>
                                </div>
                              </div>
                              <hr />
                            </>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <p class="small text-muted mb-0">WGM.GG에서 검색된 솔로랭크 경기 기준 · 5게임 이상 챔피언</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
