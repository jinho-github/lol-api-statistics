import { ROLE_KO, type TierListRow } from '../analysis';
import type { DDragon } from '../ddragon';
import { adjustedWinRate, grade, MIN_GRADE_GAMES, pct, POSITIONS, TIER_GROUPS, type Position, type TierGroupKey } from '../meta';

// 표본이 많아질수록 최소 게임 수를 올려 순위가 우연에 흔들리지 않게 한다
export const minGamesFor = (totalMatches: number) => (totalMatches >= 3000 ? 40 : totalMatches >= 800 ? 15 : totalMatches >= 200 ? 5 : 2);

const query = (position: string, tier: string) => `?position=${position}&tier=${tier}`;

export function TierList({
  dd,
  rows,
  position,
  tier,
}: {
  dd: DDragon;
  rows: TierListRow[];
  position: Position;
  tier: TierGroupKey;
}) {
  const total = rows[0]?.total_matches ?? 0;
  const min = minGamesFor(total);
  const list = rows
    .filter((r) => r.team_position === position && r.games >= min)
    .map((r) => ({ ...r, adj: adjustedWinRate(r.wins, r.games) }))
    .sort((a, b) => b.adj - a.adj);

  return (
    <>
      <section class="band tight" style="border-bottom:1px solid var(--hairline-soft)">
        <div class="container">
          <p class="eyebrow">챔피언 티어</p>
          <h1 class="display-sm" style="margin-top:12px">
            {POSITIONS.find((p) => p.key === position)!.label} 챔피언 순위
          </h1>
          <p style="margin-top:12px">
            최근 14일 솔로랭크 <span class="num ink">{total.toLocaleString()}</span>경기 · {min}게임 이상 챔피언 · 등급은 표본 수를 보정한 승률 기준이고, {MIN_GRADE_GAMES}게임 미만은 등급을 매기지 않아요.
          </p>
          <div class="tabs" style="margin-top:24px">
            {POSITIONS.map((p) => (
              <a class={p.key === position ? 'on' : ''} href={`/champions${query(p.key, tier)}`}>
                {p.label}
              </a>
            ))}
          </div>
          <div class="tabs" style="margin-top:12px">
            {TIER_GROUPS.map((g) => (
              <a class={g.key === tier ? 'on' : ''} href={`/champions${query(position, g.key)}`}>
                {g.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section class="band tight">
        <div class="container">
          <input class="input filter-input" placeholder="챔피언 이름으로 찾기" data-filter="#tier-table" aria-label="챔피언 이름 필터" />
          {list.length === 0 ? (
            <p class="notice" style="margin-top:24px">
              이 구간은 아직 데이터가 부족해요. 자동 수집이 5분마다 경기를 모으고 있어요.
            </p>
          ) : (
            <div class="table-wrap" style="margin-top:24px">
              <table class="rows" id="tier-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>챔피언</th>
                    <th>등급</th>
                    <th class="r">승률</th>
                    <th class="r">픽률</th>
                    <th class="r hide-sm">밴률</th>
                    <th class="r hide-sm">게임</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r, i) => {
                    const c = dd.champion(r.champion_id);
                    const wr = r.wins / r.games;
                    return (
                      <tr data-name={`${c?.name ?? ''} ${c?.id ?? ''}`.toLowerCase()}>
                        <td class="num muted">{i + 1}</td>
                        <td>
                          <a class="who" href={`/champions/${dd.championSlug(r.champion_id)}${query(position, tier)}`}>
                            <img class="icon md" src={dd.championImg(r.champion_id)} alt="" />
                            <span>
                              <span class="title-sm">{dd.championName(r.champion_id)}</span>
                              <br />
                              <span class="small muted">{c?.tags.map((t) => ROLE_KO[t] ?? t).join(' · ')}</span>
                            </span>
                          </a>
                        </td>
                        <td>
                          {r.games >= MIN_GRADE_GAMES ? (
                            <span class={`grade ${grade(r.adj)}`}>{grade(r.adj)}</span>
                          ) : (
                            <span class="grade" title={`${MIN_GRADE_GAMES}게임 미만은 등급을 매기지 않아요`}>
                              –
                            </span>
                          )}
                        </td>
                        <td class={`r num ${wr >= 0.5 ? 'up' : 'down'}`}>{pct(wr)}</td>
                        <td class="r num">{pct(r.games / Math.max(1, r.total_matches))}</td>
                        <td class="r num hide-sm">{pct(r.bans / Math.max(1, r.total_matches))}</td>
                        <td class="r num hide-sm">{r.games.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function ChampionIndex({ dd }: { dd: DDragon }) {
  const list = [...dd.champions].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return (
    <>
      <section class="band tight" style="border-bottom:1px solid var(--hairline-soft)">
        <div class="container">
          <p class="eyebrow">챔피언 정보</p>
          <h1 class="display-sm" style="margin-top:12px">
            챔피언 <span class="num">{list.length}</span>명
          </h1>
          <p style="margin-top:12px">챔피언을 고르면 장점·약점, 상대하기 쉬운·어려운 챔피언, 핵심 아이템과 룬을 볼 수 있어요.</p>
          <input class="input filter-input" style="margin-top:24px" placeholder="챔피언 이름으로 찾기" data-filter="#champ-grid" aria-label="챔피언 이름 필터" autofocus />
        </div>
      </section>
      <section class="band tight">
        <div class="container">
          <div id="champ-grid" class="grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:16px">
            {list.map((c) => (
              <a href={`/champions/${c.id}`} data-name={`${c.name} ${c.id}`.toLowerCase()} class="card pad-sm" style="padding:16px;text-align:center">
                <img class="icon lg" src={dd.championImg(Number(c.key))} alt="" />
                <p class="title-sm" style="margin-top:8px;font-weight:500">
                  {c.name}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// 이름 필터 (테이블 행 / 카드 공통)
export const filterScript = `
document.querySelectorAll('[data-filter]').forEach(function (input) {
  var target = document.querySelector(input.getAttribute('data-filter'));
  if (!target) return;
  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    target.querySelectorAll('[data-name]').forEach(function (el) {
      el.style.display = !q || el.getAttribute('data-name').indexOf(q) !== -1 ? '' : 'none';
    });
  });
});`;
