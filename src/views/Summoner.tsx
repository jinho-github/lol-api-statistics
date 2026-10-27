import { METRICS, ROLE_KO, type Insight, type SummonerAnalysis } from '../analysis';
import { emblemImg, type DDragon } from '../ddragon';
import { POSITION_KO, pct, TIER_KO } from '../meta';
import type { StoredMatch } from '../store';

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 60 / 24)}일 전`;
};
const rate = (w: number, g: number) => (g ? w / g : 0);

export function Summoner({ a, dd }: { a: SummonerAnalysis; dd: DDragon }) {
  const mainLabel = a.mainPosition ? POSITION_KO[a.mainPosition] : null;
  const benchLabel = a.benchmark ? `${a.benchmark.label} ${mainLabel ?? ''} 평균`.trim() : null;
  const byKey = new Map(a.insights.all.map((i) => [i.def.key, i]));

  return (
    <>
      <section class="band tight" style="border-bottom:1px solid var(--hairline-soft)">
        <div class="container" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
          <img class="icon xl" src={dd.profileIcon(a.profileIconId)} alt="" />
          <div style="flex:1;min-width:220px">
            <h1 class="display-sm">
              {a.gameName} <span class="muted">#{a.tagLine}</span>
            </h1>
            <p class="muted" style="margin-top:6px">
              Lv. <span class="num">{a.summonerLevel}</span>
              {mainLabel && <> · 주 라인 {mainLabel}</>} · 최근 솔로랭크 <span class="num">{a.mine.length}</span>게임
            </p>
          </div>
          <div style="min-width:220px">
            <p class="small muted">최근 {a.mine.length}게임 (왼쪽이 오래된 경기)</p>
            <div class="streak" style="margin-top:8px">
              {[...a.mine].reverse().map((r) => (
                <span class={r.win ? 'w' : 'l'} title={`${dd.championName(r.champion_id)} ${r.win ? '승' : '패'}`}></span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section class="band tight">
        <div class="container split">
          {/* 왼쪽: 랭크, 라인, 챔피언 풀 */}
          <div class="stack">
            <div class="card dark">
              {a.solo ? (
                <div style="display:flex;gap:20px;align-items:center">
                  <img src={emblemImg(a.solo.tier)} alt="" width="88" height="88" style="object-fit:contain" />
                  <div>
                    <p class="eyebrow" style="color:var(--on-dark-soft)">솔로랭크</p>
                    <p class="title-lg" style="color:var(--on-dark);margin-top:4px">
                      {TIER_KO[a.solo.tier] ?? a.solo.tier} {['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(a.solo.tier) ? '' : a.solo.rank}
                    </p>
                    <p class="num" style="margin-top:6px;color:var(--on-dark)">
                      {a.solo.leaguePoints.toLocaleString()} LP
                    </p>
                    <p class="small" style="margin-top:2px">
                      {a.solo.wins}승 {a.solo.losses}패 · 승률 {pct(rate(a.solo.wins, a.solo.wins + a.solo.losses), 0)}
                    </p>
                  </div>
                </div>
              ) : (
                <p>솔로랭크 기록이 없어요.</p>
              )}
              {a.flex && (
                <p class="small" style="margin-top:20px;padding-top:16px;border-top:1px solid #23262c">
                  자유랭크 {TIER_KO[a.flex.tier] ?? a.flex.tier} {a.flex.rank} · <span class="num">{a.flex.leaguePoints} LP</span> ·{' '}
                  {a.flex.wins}승 {a.flex.losses}패
                </p>
              )}
            </div>

            <div class="card pad-sm">
              <p class="title-sm">라인 분포</p>
              <div style="margin-top:12px">
                {a.positionCounts.map((p) => (
                  <div style="margin-top:10px">
                    <div class="kv" style="border:0;padding:0 0 6px">
                      <span class="ink">{POSITION_KO[p.position] ?? p.position}</span>
                      <span class="num">{p.games}게임</span>
                    </div>
                    <div class="bar">
                      <span style={`width:${(p.games / Math.max(1, a.mine.length)) * 100}%`}></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div class="card pad-sm">
              <p class="title-sm">챔피언 풀</p>
              <table class="rows" style="margin-top:12px">
                <thead>
                  <tr>
                    <th>챔피언</th>
                    <th class="r">게임</th>
                    <th class="r">승률</th>
                    <th class="r">KDA</th>
                  </tr>
                </thead>
                <tbody>
                  {a.pool.slice(0, 8).map((p) => (
                    <tr>
                      <td>
                        <a class="who" href={`/champions/${dd.championSlug(p.championId)}`} style="min-width:0">
                          <img class="icon" src={dd.championImg(p.championId)} alt="" />
                          <span class="title-sm" style="font-weight:500">
                            {dd.championName(p.championId)}
                          </span>
                        </a>
                      </td>
                      <td class="r num">{p.games}</td>
                      <td class={`r num ${p.wins / p.games >= 0.5 ? 'up' : 'down'}`}>{pct(p.wins / p.games, 0)}</td>
                      <td class="r num">{p.kda.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 오른쪽: 지표, 장단점, 추천, 최근 경기 */}
          <div class="stack" style="--gap:24px">
            <div class="card">
              <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:baseline">
                <h2 class="title-lg">플레이 지표</h2>
                <p class="small muted">
                  {mainLabel ? `주 라인(${mainLabel}) 경기 기준` : '전체 경기 기준'}
                  {benchLabel ? ` · 비교: ${benchLabel} (${a.benchmark!.metrics.games.toLocaleString()}명 기록)` : ''}
                </p>
              </div>
              <div class="grid g4" style="margin-top:28px;row-gap:32px">
                <div class="stat">
                  <p class="label">승률</p>
                  <p class="value">{pct(a.metrics.win_rate, 0)}</p>
                  <p class="delta muted">
                    {a.metrics.games}게임 {Math.round(a.metrics.win_rate * a.metrics.games)}승
                  </p>
                </div>
                {METRICS.filter((d) => byKey.has(d.key) || !a.benchmark)
                  .filter((d) => d.key !== 'cs10' && d.key !== 'dmg_share')
                  .map((d) => {
                    const i = byKey.get(d.key);
                    const mine = i?.mine ?? (a.metrics[d.key] as number | null);
                    return (
                      <div class="stat">
                        <p class="label">{d.label}</p>
                        <p class="value">{mine == null ? '–' : d.fmt(mine)}</p>
                        {i ? (
                          <p class={`delta ${i.diff >= 0 ? 'up' : 'down'}`}>
                            {i.diff >= 0 ? '▲' : '▼'} {Math.abs(Math.round(i.diff * 100))}% · 평균 {d.fmt(i.bench)}
                          </p>
                        ) : (
                          <p class="delta muted">비교 데이터 수집 중</p>
                        )}
                      </div>
                    );
                  })}
              </div>
              {!a.benchmark && (
                <p class="notice" style="margin-top:28px">
                  같은 티어·라인의 비교 데이터가 아직 충분하지 않아요. 자동 수집이 쌓이면 장점과 약점이 표시돼요.
                </p>
              )}
            </div>

            {a.benchmark && (
              <div class="grid g2">
                <InsightCard title="장점" tone="up" items={a.insights.strengths} empty="평균보다 10% 이상 앞서는 지표가 아직 없어요." />
                <InsightCard title="약점" tone="down" items={a.insights.weaknesses} empty="평균보다 10% 이상 뒤처지는 지표가 없어요. 좋아요!" />
              </div>
            )}

            {a.recommendations.length > 0 && (
              <div class="card">
                <h2 class="title-lg">추천 챔피언</h2>
                <div class="grid g3" style="margin-top:24px">
                  {a.recommendations.map((r) => {
                    const c = dd.champion(r.championId);
                    return (
                      <a class="card soft pad-sm" href={`/champions/${dd.championSlug(r.championId)}${a.mainPosition ? `?position=${a.mainPosition}` : ''}`}>
                        <span class="badge">{r.title}</span>
                        <div style="display:flex;gap:12px;align-items:center;margin-top:16px">
                          <img class="icon lg" src={dd.championImg(r.championId)} alt="" />
                          <div>
                            <p class="title-md">{dd.championName(r.championId)}</p>
                            <p class="small muted">{c?.tags.map((t) => ROLE_KO[t] ?? t).join(' · ')}</p>
                          </div>
                        </div>
                        <p class="small" style="margin-top:12px">{r.reason}</p>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            <div class="card">
              <h2 class="title-lg">게임 길이별 승률</h2>
              <div class="grid g2" style="margin-top:24px">
                <DurationStat label="25분 이전에 끝난 게임" v={a.durationSplit.short} />
                <DurationStat label="30분 이후까지 간 게임" v={a.durationSplit.long} />
              </div>
              <p class="small muted" style="margin-top:16px">{durationComment(a)}</p>
            </div>

            <div class="card">
              <h2 class="title-lg">최근 경기</h2>
              <div style="margin-top:16px">
                {a.matches.map((m) => (
                  <MatchRow m={m} puuid={a.mine.find((r) => r.match_id === m.match_id)?.puuid ?? ''} dd={dd} />
                ))}
                {a.matches.length === 0 && <p class="muted">최근 솔로랭크 경기가 없어요.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function InsightCard({ title, tone, items, empty }: { title: string; tone: 'up' | 'down'; items: Insight[]; empty: string }) {
  return (
    <div class="card">
      <h2 class="title-lg">{title}</h2>
      <div style="margin-top:16px">
        {items.length === 0 && <p class="muted">{empty}</p>}
        {items.map((i) => (
          <div class="insight">
            <span class={`mark ${tone}`}>{tone === 'up' ? '▲' : '▼'}</span>
            <div>
              <p class="title-sm">
                {i.def.label}{' '}
                <span class={`num ${tone}`} style="font-size:14px">
                  {i.def.fmt(i.mine)} vs {i.def.fmt(i.bench)}
                </span>
              </p>
              <p style="margin-top:4px;font-size:14px">{tone === 'up' ? i.def.strong : i.def.weak}</p>
              {tone === 'down' && <p class="tip">💡 {i.def.tip}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DurationStat({ label, v }: { label: string; v: { games: number; wins: number } }) {
  return (
    <div class="stat">
      <p class="label">{label}</p>
      <p class="value">{v.games ? pct(v.wins / v.games, 0) : '–'}</p>
      <p class="delta muted">
        {v.games}게임 {v.wins}승
      </p>
    </div>
  );
}

function durationComment(a: SummonerAnalysis) {
  const { short, long } = a.durationSplit;
  if (short.games < 3 || long.games < 3) return '게임 수가 적어서 아직 경향을 판단하기 어려워요.';
  const s = short.wins / short.games;
  const l = long.wins / long.games;
  if (s - l >= 0.15) return '빨리 끝나는 게임에서 더 강해요. 초반 주도권을 살려 오브젝트로 게임을 일찍 끝내는 운영이 잘 맞아요.';
  if (l - s >= 0.15) return '긴 게임에서 더 강해요. 초반에 무리하지 말고 성장 후 한타에서 승부를 보는 운영이 잘 맞아요.';
  return '게임 길이에 따른 승률 차이가 크지 않아요.';
}

function MatchRow({ m, puuid, dd }: { m: StoredMatch; puuid: string; dd: DDragon }) {
  const me = m.participants.find((p) => p.puuid === puuid);
  if (!me) return null;
  const min = Math.floor(m.duration_s / 60);
  const sec = String(m.duration_s % 60).padStart(2, '0');
  const team = (id: number) => m.participants.filter((p) => p.team_id === id);
  const items = me.items.slice(0, 6);
  return (
    <div class={`match${me.win ? ' win' : ''}`}>
      <span class="side"></span>
      <a href={`/champions/${dd.championSlug(me.champion_id)}`} title={dd.championName(me.champion_id)}>
        <img class="icon lg sq" src={dd.championImg(me.champion_id)} alt={dd.championName(me.champion_id)} />
      </a>
      <div>
        <p class="title-sm">
          <span class={me.win ? '' : 'muted'} style={me.win ? 'color:var(--primary)' : ''}>
            {me.win ? '승리' : '패배'}
          </span>{' '}
          <span class="num">
            {me.kills} / <span class="down">{me.deaths}</span> / {me.assists}
          </span>
          <span class="small muted" style="font-weight:400">
            {' '}
            · KDA {((me.kills + me.assists) / Math.max(1, me.deaths)).toFixed(2)}
          </span>
        </p>
        <p class="small muted" style="margin-top:2px">
          {POSITION_KO[me.team_position] ?? '–'} · CS <span class="num">{me.cs}</span> ({(me.cs / (m.duration_s / 60)).toFixed(1)}) · 킬관여{' '}
          <span class="num">{pct(me.kill_part, 0)}</span> · 시야 <span class="num">{me.vision}</span>
        </p>
        <div class="items" style="margin-top:8px">
          {me.keystone && <img src={dd.runeImg(me.keystone)} alt="" title={dd.rune(me.keystone)?.name} style="background:var(--ink)" />}
          {me.spells.map((s) => (
            <img src={dd.spellImg(s)} alt="" title={dd.spell(s)?.name} />
          ))}
          <i style="width:8px;background:none"></i>
          {items.map((id) => (id ? <img src={dd.itemImg(id)} alt="" title={dd.item(id)?.name} /> : <i></i>))}
        </div>
      </div>
      <div class="right r small muted" style="text-align:right">
        <p>
          {min}:{sec}
        </p>
        <p>{ago(m.game_creation)}</p>
      </div>
      <details>
        <summary>팀 구성 보기</summary>
        <div class="teams">
          {[100, 200].map((t) => (
            <div>
              <p class="small muted" style="margin-bottom:4px">
                {t === 100 ? '블루' : '레드'} · {m.teams.find((x) => x.teamId === t)?.win ? '승리' : '패배'} · 포탑{' '}
                {m.teams.find((x) => x.teamId === t)?.objectives.tower ?? 0} · 드래곤 {m.teams.find((x) => x.teamId === t)?.objectives.dragon ?? 0} ·
                바론 {m.teams.find((x) => x.teamId === t)?.objectives.baron ?? 0}
              </p>
              {team(t).map((p) => (
                <div class={`p${p.puuid === puuid ? ' me' : ''}`}>
                  <img class="icon xs" src={dd.championImg(p.champion_id)} alt="" />
                  <a href={`/summoner/${encodeURIComponent(p.riot_name)}/${encodeURIComponent(p.riot_tag)}`} style="color:inherit;flex:1">
                    {p.riot_name}
                  </a>
                  <span class="num muted">
                    {p.kills}/{p.deaths}/{p.assists}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
