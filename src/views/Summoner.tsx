import { emblemImg, runeStyleImg, type DDragon } from '../ddragon';
import type { SummonerView } from '../summoner';

// legacy/flask/templates_back/application.html + game_list.html

const QUEUE_LABEL: Record<string, string> = { RANKED_SOLO_5x5: '솔로랭크', RANKED_FLEX_SR: '자유랭크' };

export function Summoner({ v, dd }: { v: SummonerView; dd: DDragon }) {
  const solo = v.leagues.find((l) => l.queueType === 'RANKED_SOLO_5x5') ?? v.leagues[0];
  return (
    <main class="mt-5 pt-5">
      <div class="container-fluid px-lg-5">
        <section class="team-section my-5">
          <div class="row text-left">
            <div class="col-lg-6 col-md-12 mb-4">
              <div class="card">
                <div class="view overlay text-center pt-4">
                  {solo ? (
                    <img src={emblemImg(solo.tier)} style="width:40%" class="rounded mx-auto d-block" alt={solo.tier} />
                  ) : (
                    <img src={dd.profileIcon(v.profileIconId)} style="width:25%" class="rounded-circle mx-auto d-block" alt="" />
                  )}
                </div>
                <div class="card-body text-center">
                  <h4 class="mb-0">
                    <img src={dd.profileIcon(v.profileIconId)} width="36" class="rounded-circle mr-2" alt="" />
                    <strong>{v.gameName}</strong> <span class="text-muted">#{v.tagLine}</span>
                  </h4>
                  <span class="text-muted small">Lv. {v.summonerLevel}</span>
                </div>
                <div class="rounded-bottom mdb-color lighten-3 text-center pt-3">
                  <ul class="list-unstyled list-inline font-small">
                    {v.leagues.length ? (
                      v.leagues.map((l) => (
                        <li class="d-block pb-2 white-text">
                          <span class="pr-2">
                            <strong>{QUEUE_LABEL[l.queueType] ?? l.queueType}</strong>
                          </span>
                          <span class="pr-2">
                            <i class="fas fa-trophy"></i> {l.tier} {l.rank}
                          </span>
                          <span class="pr-2">
                            <i class="fas fa-fire"></i> {l.leaguePoints} P
                          </span>
                          <span class="pr-2">
                            <i class="fas fa-level-up-alt"></i> {l.wins} 승
                          </span>
                          <span>
                            <i class="fas fa-level-down-alt"></i> {l.losses} 패 (
                            {Math.round((100 * l.wins) / Math.max(1, l.wins + l.losses))}%)
                          </span>
                        </li>
                      ))
                    ) : (
                      <li class="white-text pb-2">아직 리그가 없습니다. 분발하세요!</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div class="col-lg-6 col-md-12">
              {v.most && (
                <div class="row text-left">
                  <div class="col-4">
                    <div class="view overlay rounded z-depth-1-half">
                      <img src={dd.championImg(v.most.championId)} class="img-thumbnail" alt="" />
                    </div>
                  </div>
                  <div class="col-8">
                    <blockquote class="blockquote bq-primary">
                      <h3 class="h3">MOST ONE</h3>
                      <h6 class="h6-responsive">
                        최근 {v.games.length} 게임 중 {v.most.count}경기 {dd.championName(v.most.championId)}
                      </h6>
                      <h6 class="h6-responsive">
                        {v.most.wins}승 {v.most.count - v.most.wins}패
                      </h6>
                    </blockquote>
                  </div>
                </div>
              )}
              <hr />
              <h3 class="h3">최근 경기 K/D/A</h3>
              <canvas id="lineChart"></canvas>
            </div>
          </div>
        </section>

        {v.games.length === 0 ? (
          <p class="text-center text-muted my-5">최근 솔로랭크 경기가 없습니다.</p>
        ) : (
          <GameList v={v} dd={dd} />
        )}
      </div>
    </main>
  );
}

function GameList({ v, dd }: { v: SummonerView; dd: DDragon }) {
  return (
    <div class="table-responsive">
      <table class="table table-bordered">
        <thead class="black white-text">
          <tr>
            <th scope="col">INFO</th>
            <th scope="col">LV/CS</th>
            <th scope="col">룬</th>
            <th scope="col">게임 정보</th>
            <th scope="col">데미지</th>
            <th scope="col">블루 오브젝트</th>
            <th scope="col">레드 오브젝트</th>
            <th scope="col">블루 팀</th>
            <th scope="col">레드 팀</th>
          </tr>
        </thead>
        <tbody>
          {v.games.map((g) => {
            const s = g.me;
            const primary = s.perks.styles.find((x) => x.description === 'primaryStyle')?.style ?? 0;
            const sub = s.perks.styles.find((x) => x.description === 'subStyle')?.style ?? 0;
            return (
              <tr style={s.win ? 'background:#e3f2fd' : 'background:#ffebee'}>
                <td>
                  <strong class={s.win ? 'text-primary' : 'text-danger'}>{s.win ? '승리' : '패배'}</strong>
                  <br />
                  {g.durationMin}분 게임
                  <br />
                  <img src={dd.championImg(s.championId)} width="50" alt={dd.championName(s.championId)} />
                  <br />
                  {s.kills}/{s.deaths}/{s.assists}
                </td>
                <td>
                  Lv : {s.champLevel}
                  <br />
                  <span class="badge badge-info">cs : {s.totalMinionsKilled + s.neutralMinionsKilled}</span>
                </td>
                <td>
                  <img src={runeStyleImg(primary)} width="40" alt="" />
                  <br />
                  <img src={runeStyleImg(sub)} width="30" alt="" />
                </td>
                <td>
                  <span class="badge badge-info">획득골드 : {s.goldEarned.toLocaleString()}</span>
                  <br />
                  {g.durationMin <= s.visionScore ? (
                    <span class="badge badge-primary">시야점수 좋음</span>
                  ) : (
                    <span class="badge badge-danger">시야점수 나쁨</span>
                  )}
                  <br />
                  {s.largestMultiKill >= 2 && (
                    <>
                      <span class="badge badge-primary">{s.largestMultiKill}연속 킬 달성!</span>
                      <br />
                    </>
                  )}
                  <span class="badge badge-info">시야점수 : {s.visionScore}</span>
                </td>
                <td>
                  <span class="badge badge-info">총 데미지 : {s.totalDamageDealt.toLocaleString()}</span>
                  <br />
                  <span class="badge badge-info">AP 데미지 : {s.magicDamageDealtToChampions.toLocaleString()}</span>
                  <br />
                  <span class="badge badge-info">AD 데미지 : {s.physicalDamageDealtToChampions.toLocaleString()}</span>
                  <br />
                  <span class="badge badge-info">챔피언 : {s.totalDamageDealtToChampions.toLocaleString()}</span>
                  <br />
                  <span class="badge badge-info">받은 피해 : {s.totalDamageTaken.toLocaleString()}</span>
                  <br />
                  <span class="badge badge-info">회복 : {s.totalHeal.toLocaleString()}</span>
                </td>
                <td>
                  <Objectives team={g.blue} color="primary" />
                </td>
                <td>
                  <Objectives team={g.red} color="danger" />
                </td>
                <td>
                  {g.bluePlayers.map((p) => (
                    <>
                      <span class="badge badge-light">{p}</span>
                      <br />
                    </>
                  ))}
                </td>
                <td>
                  {g.redPlayers.map((p) => (
                    <>
                      <span class="badge badge-light">{p}</span>
                      <br />
                    </>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Objectives({ team, color }: { team: SummonerView['games'][number]['blue']; color: string }) {
  const o = team.objectives;
  return (
    <>
      <span class={`badge badge-${color} badge-pill`}>포탑 파괴 : {o.tower.kills}</span>
      <br />
      <span class={`badge badge-${color} badge-pill`}>억제기 파괴 : {o.inhibitor.kills}</span>
      <br />
      <span class={`badge badge-${color} badge-pill`}>바론 처치 : {o.baron.kills}</span>
      <br />
      <span class={`badge badge-${color} badge-pill`}>드래곤 처치 : {o.dragon.kills}</span>
      <br />
      <span class={`badge badge-${color} badge-pill`}>전령 처치 : {o.riftHerald.kills}</span>
    </>
  );
}

// 원본의 Chart.js 선 그래프 (최근 7게임 K+A / D)
export function summonerChartScript(v: SummonerView) {
  const recent = v.games.slice(0, 7).reverse();
  const data = {
    labels: recent.map((_, i) => (i === recent.length - 1 ? '최근 게임' : `${recent.length - i} 게임 전`)),
    ka: recent.map((g) => g.me.kills + g.me.assists),
    d: recent.map((g) => g.me.deaths),
  };
  // </script> 로 끝나는 문자열이 섞여도 안전하도록 < 를 이스케이프
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `
  var d = ${json};
  new Chart(document.getElementById('lineChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'K+A', data: d.ka, backgroundColor: ['rgba(0, 137, 132, .2)'], borderColor: ['rgba(0, 10, 130, .7)'], borderWidth: 2 },
        { label: 'D', data: d.d, backgroundColor: ['rgba(105, 0, 132, .2)'], borderColor: ['rgba(200, 99, 132, .7)'], borderWidth: 2 }
      ]
    },
    options: { responsive: true }
  });`;
}
