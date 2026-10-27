import { ROLE_KO } from '../analysis';
import type { ChampionFull, DDragon } from '../ddragon';
import { pct, POSITION_KO, POSITIONS, TIER_GROUPS, type TierGroupKey } from '../meta';

export type ChampionDetailData = {
  position: string | null;
  positions: { position: string; games: number; wins: number }[];
  games: number;
  wins: number;
  kda: number | null;
  matchups: { champion_id: number; games: number; wins: number }[];
  items: { id: number; games: number; wins: number }[];
  keystones: { id: number; sub: number; games: number; wins: number }[];
  spells: { ids: number[]; games: number; wins: number }[];
  durations: { bucket: number; games: number; wins: number }[];
};

const strip = (html: string) => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const wr = (x: { games: number; wins: number }) => (x.games ? x.wins / x.games : 0);

type Point = { text: string; source: 'data' | 'riot' };

// 장점/약점: Riot 공식 능력치(0~10) + 우리 데이터(게임 시간대별 승률, 상대 전적)
export function championPoints(full: ChampionFull, d: ChampionDetailData | null, dd: DDragon) {
  const strengths: Point[] = [];
  const weaknesses: Point[] = [];
  const { attack, defense, magic, difficulty } = full.info;
  if (attack >= 8) strengths.push({ text: '물리 공격력이 매우 높아요.', source: 'riot' });
  if (magic >= 8) strengths.push({ text: '마법 피해가 강력해요.', source: 'riot' });
  if (defense >= 7) strengths.push({ text: '몸이 단단해서 앞라인을 맡기 좋아요.', source: 'riot' });
  if (difficulty <= 3) strengths.push({ text: '조작이 쉬워서 처음 하는 사람도 성과를 내기 좋아요.', source: 'riot' });
  if (defense <= 3) weaknesses.push({ text: '몸이 약해서 진입 각을 내주면 쉽게 잡혀요.', source: 'riot' });
  if (difficulty >= 8) weaknesses.push({ text: '숙련도가 많이 필요해요. 연습 없이 랭크에서 꺼내기 어려워요.', source: 'riot' });
  if (attack <= 3 && magic <= 3) weaknesses.push({ text: '혼자서 넣는 피해량은 낮은 편이에요.', source: 'riot' });

  if (d) {
    const early = d.durations.filter((x) => x.bucket < 25);
    const late = d.durations.filter((x) => x.bucket >= 30);
    const sum = (xs: typeof early) => xs.reduce((a, x) => ({ games: a.games + x.games, wins: a.wins + x.wins }), { games: 0, wins: 0 });
    const e = sum(early);
    const l = sum(late);
    if (e.games >= 10 && l.games >= 10) {
      const diff = wr(l) - wr(e);
      if (diff >= 0.06) strengths.push({ text: `후반에 강해요. 30분 이후 승률 ${pct(wr(l))} (25분 이전 ${pct(wr(e))}).`, source: 'data' });
      if (diff <= -0.06) {
        strengths.push({ text: `초반에 강해요. 25분 이전 승률 ${pct(wr(e))}.`, source: 'data' });
        weaknesses.push({ text: `게임이 길어지면 약해져요. 30분 이후 승률 ${pct(wr(l))}.`, source: 'data' });
      }
    }
    const mu = d.matchups.filter((m) => m.games >= 5).sort((a, b) => wr(a) - wr(b));
    const hard = mu[0];
    const easy = mu[mu.length - 1];
    if (easy && wr(easy) >= 0.55) strengths.push({ text: `${dd.championName(easy.champion_id)} 상대로 강해요 (승률 ${pct(wr(easy))}).`, source: 'data' });
    if (hard && wr(hard) <= 0.45) weaknesses.push({ text: `${dd.championName(hard.champion_id)} 상대로 고전해요 (승률 ${pct(wr(hard))}).`, source: 'data' });
  }
  return { strengths, weaknesses };
}

export function Champion({
  dd,
  full,
  d,
  tier,
}: {
  dd: DDragon;
  full: ChampionFull;
  d: ChampionDetailData | null;
  tier: TierGroupKey;
}) {
  const id = Number(full.key);
  const position = d?.position ?? null;
  const points = championPoints(full, d, dd);
  const matchups = (d?.matchups ?? []).filter((m) => m.games >= 3);
  const easy = [...matchups].sort((a, b) => wr(b) - wr(a) || b.games - a.games).slice(0, 5);
  const hard = [...matchups].sort((a, b) => wr(a) - wr(b) || b.games - a.games).slice(0, 5);
  const core = (d?.items ?? []).filter((i) => dd.isCoreItem(i.id) && !dd.isBoots(i.id)).slice(0, 6);
  const boots = (d?.items ?? []).filter((i) => dd.isCoreItem(i.id) && dd.isBoots(i.id)).slice(0, 2);
  const durationBuckets = [
    { label: '~25분', from: 0, to: 25 },
    { label: '25–30분', from: 25, to: 30 },
    { label: '30–35분', from: 30, to: 35 },
    { label: '35분~', from: 35, to: 999 },
  ].map((b) => {
    const xs = (d?.durations ?? []).filter((x) => x.bucket >= b.from && x.bucket < b.to);
    return { ...b, games: xs.reduce((a, x) => a + x.games, 0), wins: xs.reduce((a, x) => a + x.wins, 0) };
  });
  const q = (extra: Record<string, string>) =>
    '?' + new URLSearchParams({ ...(position ? { position } : {}), tier, ...extra }).toString();
  const abilityKeys = ['Q', 'W', 'E', 'R'];

  return (
    <>
      <section class="band dark tight">
        <div class="container" style="display:flex;gap:28px;align-items:center;flex-wrap:wrap">
          <img class="icon xl" style="width:112px;height:112px" src={dd.championImg(id)} alt="" />
          <div style="flex:1;min-width:240px">
            <p class="eyebrow" style="color:var(--on-dark-soft)">{full.title}</p>
            <h1 class="display-lg" style="margin-top:8px">
              {full.name}
            </h1>
            <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
              {full.tags.map((t) => (
                <span class="badge dark">{ROLE_KO[t] ?? t}</span>
              ))}
              {position && <span class="badge dark">{POSITION_KO[position]}</span>}
            </div>
          </div>
          <div class="grid g4" style="min-width:320px;flex:1;gap:24px">
            <HeroStat label="승률" value={d && d.games ? pct(wr(d)) : '–'} tone={d && d.games ? (wr(d) >= 0.5 ? 'up' : 'down') : ''} />
            <HeroStat label="게임 수" value={d ? d.games.toLocaleString() : '–'} />
            <HeroStat label="KDA" value={d?.kda != null ? d.kda.toFixed(2) : '–'} />
            <HeroStat label="난이도" value={`${full.info.difficulty}/10`} />
          </div>
        </div>
      </section>

      <section class="band tight" style="border-bottom:1px solid var(--hairline-soft)">
        <div class="container">
          <div class="tabs">
            {POSITIONS.filter((p) => d?.positions.some((x) => x.position === p.key && x.games > 0)).map((p) => (
              <a class={p.key === position ? 'on' : ''} href={`/champions/${full.id}${q({ position: p.key })}`}>
                {p.label} <span class="num" style="opacity:.6">{d!.positions.find((x) => x.position === p.key)!.games}</span>
              </a>
            ))}
          </div>
          <div class="tabs" style="margin-top:12px">
            {TIER_GROUPS.map((g) => (
              <a class={g.key === tier ? 'on' : ''} href={`/champions/${full.id}${q({ tier: g.key })}`}>
                {g.label}
              </a>
            ))}
          </div>
          {(!d || d.games === 0) && (
            <p class="notice" style="margin-top:20px">
              이 구간에서는 아직 {full.name} 경기 데이터가 없어요. 다른 티어 구간을 골라 보거나, 자동 수집이 쌓일 때까지 기다려 주세요.
            </p>
          )}
        </div>
      </section>

      <section class="band tight">
        <div class="container stack">
          <div class="grid g2">
            <div class="card">
              <h2 class="title-lg">장점</h2>
              <ul class="clean" style="margin-top:20px">
                {points.strengths.map((p) => (
                  <li>
                    {p.text} {p.source === 'data' && <span class="badge blue">데이터</span>}
                  </li>
                ))}
                {points.strengths.length === 0 && <li class="muted">뚜렷한 장점을 판단할 데이터가 아직 부족해요.</li>}
              </ul>
              {full.allytips.length > 0 && (
                <>
                  <p class="title-sm" style="margin-top:28px">
                    이렇게 플레이하세요 <span class="small muted">(Riot 공식 팁)</span>
                  </p>
                  <ul class="clean" style="margin-top:12px;font-size:14px">
                    {full.allytips.map((t) => (
                      <li>{t}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div class="card">
              <h2 class="title-lg">약점</h2>
              <ul class="clean" style="margin-top:20px">
                {points.weaknesses.map((p) => (
                  <li>
                    {p.text} {p.source === 'data' && <span class="badge blue">데이터</span>}
                  </li>
                ))}
                {points.weaknesses.length === 0 && <li class="muted">뚜렷한 약점을 판단할 데이터가 아직 부족해요.</li>}
              </ul>
              {full.enemytips.length > 0 && (
                <>
                  <p class="title-sm" style="margin-top:28px">
                    상대할 때는 <span class="small muted">(Riot 공식 팁)</span>
                  </p>
                  <ul class="clean" style="margin-top:12px;font-size:14px">
                    {full.enemytips.map((t) => (
                      <li>{t}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <div class="grid g2">
            <MatchupCard title="상대하기 쉬운 챔피언" rows={easy} dd={dd} tone="up" />
            <MatchupCard title="상대하기 어려운 챔피언" rows={hard} dd={dd} tone="down" />
          </div>

          <div class="grid g3">
            <div class="card pad-sm">
              <p class="title-sm">핵심 아이템</p>
              {core.length === 0 && <p class="muted small" style="margin-top:12px">데이터 수집 중</p>}
              {core.map((i) => (
                <div class="kv" style="align-items:center">
                  <span style="display:flex;gap:10px;align-items:center" class="ink">
                    <img class="icon sq" src={dd.itemImg(i.id)} alt="" />
                    {dd.item(i.id)?.name}
                  </span>
                  <span class="num small">
                    {pct(i.games / Math.max(1, d!.games), 0)} · <span class={wr(i) >= 0.5 ? 'up' : 'down'}>{pct(wr(i), 0)}</span>
                  </span>
                </div>
              ))}
              {boots.map((i) => (
                <div class="kv" style="align-items:center">
                  <span style="display:flex;gap:10px;align-items:center" class="ink">
                    <img class="icon sq" src={dd.itemImg(i.id)} alt="" />
                    {dd.item(i.id)?.name}
                  </span>
                  <span class="num small">{pct(i.games / Math.max(1, d!.games), 0)}</span>
                </div>
              ))}
              {core.length > 0 && <p class="small muted" style="margin-top:8px">채용률 · 승률</p>}
            </div>
            <div class="card pad-sm">
              <p class="title-sm">룬</p>
              {(d?.keystones ?? []).length === 0 && <p class="muted small" style="margin-top:12px">데이터 수집 중</p>}
              {(d?.keystones ?? []).slice(0, 4).map((k) => (
                <div class="kv" style="align-items:center">
                  <span style="display:flex;gap:10px;align-items:center" class="ink">
                    <img class="icon" style="background:var(--ink)" src={dd.runeImg(k.id)} alt="" />
                    <img class="icon xs" src={dd.runeImg(k.sub)} alt="" />
                    {dd.rune(k.id)?.name}
                  </span>
                  <span class="num small">
                    {pct(k.games / Math.max(1, d!.games), 0)} · <span class={wr(k) >= 0.5 ? 'up' : 'down'}>{pct(wr(k), 0)}</span>
                  </span>
                </div>
              ))}
              <p class="title-sm" style="margin-top:24px">소환사 주문</p>
              {(d?.spells ?? []).slice(0, 2).map((s) => (
                <div class="kv" style="align-items:center">
                  <span style="display:flex;gap:6px;align-items:center" class="ink">
                    {s.ids.map((x) => (
                      <img class="icon sq" src={dd.spellImg(x)} alt={dd.spell(x)?.name} title={dd.spell(x)?.name} />
                    ))}
                    <span style="margin-left:6px">{s.ids.map((x) => dd.spell(x)?.name).join(' + ')}</span>
                  </span>
                  <span class="num small">{pct(s.games / Math.max(1, d!.games), 0)}</span>
                </div>
              ))}
            </div>
            <div class="card pad-sm">
              <p class="title-sm">게임 시간대별 승률</p>
              {durationBuckets.map((b) => (
                <div style="margin-top:14px">
                  <div class="kv" style="border:0;padding:0 0 6px">
                    <span class="ink">{b.label}</span>
                    <span class="num small">
                      {b.games ? <span class={wr(b) >= 0.5 ? 'up' : 'down'}>{pct(wr(b))}</span> : '–'} <span class="muted">({b.games})</span>
                    </span>
                  </div>
                  <div class="bar">
                    <span style={`width:${b.games ? wr(b) * 100 : 0}%`}></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class="card">
            <h2 class="title-lg">스킬</h2>
            <div style="margin-top:16px">
              <div class="ability">
                <img class="icon md sq" src={dd.passiveImg(full.passive.image.full)} alt="" />
                <div>
                  <p class="key">패시브</p>
                  <p class="title-sm" style="margin-top:4px">{full.passive.name}</p>
                  <p>{strip(full.passive.description)}</p>
                </div>
              </div>
              {full.spells.map((s, i) => (
                <div class="ability">
                  <img class="icon md sq" src={dd.abilityImg(s.image.full)} alt="" />
                  <div>
                    <p class="key">{abilityKeys[i]}</p>
                    <p class="title-sm" style="margin-top:4px">{s.name}</p>
                    <p>{strip(s.description)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function HeroStat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div class="stat">
      <p class="label" style="color:var(--on-dark-soft)">
        {label}
      </p>
      <p class={`value ${tone}`} style={tone ? '' : 'color:var(--on-dark)'}>
        {value}
      </p>
    </div>
  );
}

function MatchupCard({
  title,
  rows,
  dd,
  tone,
}: {
  title: string;
  rows: { champion_id: number; games: number; wins: number }[];
  dd: DDragon;
  tone: 'up' | 'down';
}) {
  return (
    <div class="card pad-sm">
      <p class="title-sm">{title}</p>
      {rows.length === 0 && <p class="muted small" style="margin-top:12px">같은 라인 상대 전적이 아직 부족해요 (3게임 이상).</p>}
      <table class="rows" style="margin-top:8px">
        <tbody>
          {rows.map((m) => (
            <tr>
              <td>
                <a class="who" href={`/champions/${dd.championSlug(m.champion_id)}`}>
                  <img class="icon" src={dd.championImg(m.champion_id)} alt="" />
                  <span class="title-sm" style="font-weight:500">
                    {dd.championName(m.champion_id)}
                  </span>
                </a>
              </td>
              <td class={`r num ${tone}`}>{pct(wr(m))}</td>
              <td class="r num muted">{m.games}게임</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
