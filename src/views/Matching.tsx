// legacy/flask/templates_back/matching.html

export type DuoProfile = {
  user_id: string;
  author_name: string;
  riot_id: string;
  lane: string;
  champion: string;
  tier: string | null;
  wins: number | null;
  losses: number | null;
};

export const DUO_LANES = ['탑', '정글', '미드', '원딜', '서포터', '올라이너'] as const;

function DuoCard({ p }: { p: DuoProfile }) {
  const games = (p.wins ?? 0) + (p.losses ?? 0);
  return (
    <div class="media-body text-center text-md-left ml-md-3 ml-0">
      <h5 class="mt-0 font-weight-bold">
        <a href={`/search?q=${encodeURIComponent(p.riot_id)}`}>{p.riot_id}</a>
      </h5>
      <strong>주 라인 : {p.lane}</strong>
      <br />
      <strong>주 챔피언 : {p.champion}</strong>
      <br />
      <strong>솔로랭크 : </strong>
      {p.tier ? (
        <>
          {p.tier} · {p.wins}승 {p.losses}패 ({Math.round((100 * (p.wins ?? 0)) / Math.max(1, games))}%)
        </>
      ) : (
        '기록 없음'
      )}
    </div>
  );
}

export function Matching({ loggedIn, mine, others }: { loggedIn: boolean; mine: DuoProfile | null; others: DuoProfile[] }) {
  if (!loggedIn) {
    return (
      <main class="mt-5 pt-5">
        <div class="container text-center my-5">
          <h3 class="my-4">유저매칭은 로그인 후 이용할 수 있어요.</h3>
          <button class="btn btn-info" data-toggle="modal" data-target="#modalLoginForm">
            로그인
          </button>
        </div>
      </main>
    );
  }
  return (
    <main class="mt-5 pt-5">
      <div class="container">
        <section class="mt-4">
          <div class="row">
            <div class="col-md-8 mb-4">
              <div class="card mb-4">
                <div class="card-header font-weight-bold">
                  <span>내 정보</span>
                </div>
                <div class="card-body">
                  <div class="media d-block d-md-flex mt-3">
                    {mine ? (
                      <DuoCard p={mine} />
                    ) : (
                      <div class="media-body">
                        내 정보가 등록되지 않았습니다. <br />
                        매칭 정보를 등록해주세요.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div class="card mb-4">
                <div class="card-header font-weight-bold">
                  <span>매칭된 유저</span>
                </div>
                {!mine ? (
                  <div class="card-body text-muted">내 정보를 등록하면 다른 유저를 볼 수 있어요.</div>
                ) : others.length === 0 ? (
                  <div class="card-body text-muted">아직 다른 유저가 없어요.</div>
                ) : (
                  others.map((p) => (
                    <div class="card-body border-bottom">
                      <div class="media d-block d-md-flex mt-3">
                        <DuoCard p={p} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div class="col-md-4 mb-4">
              <div class="card mb-4 text-center">
                <div class="card-header">유저매칭을 위해 입력해주세요!</div>
                <div class="card-body">
                  <form method="post" action="/matching">
                    <label for="duo-riot-id" class="grey-text">
                      LOL 아이디 (Riot ID)
                    </label>
                    <input
                      type="text"
                      name="riot_id"
                      id="duo-riot-id"
                      class="form-control"
                      placeholder="Hide on bush#KR1"
                      value={mine?.riot_id}
                      required
                    />
                    <br />
                    <select class="browser-default custom-select" name="lane" required>
                      <option value="">주로 하는 라인</option>
                      {DUO_LANES.map((l) => (
                        <option value={l} selected={mine?.lane === l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <hr />
                    <label for="duo-champ" class="grey-text">
                      주로 하는 챔피언
                    </label>
                    <input type="text" name="champion" id="duo-champ" class="form-control" value={mine?.champion} required />
                    <div class="text-center mt-4">
                      <button class="btn btn-info btn-md" type="submit">
                        {mine ? '수정' : '등록'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
