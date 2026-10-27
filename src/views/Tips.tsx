// legacy/flask/templates_back/Tip_list.html

export type Tip = {
  id: number;
  lane: string;
  youtube_id: string | null;
  title: string;
  body: string;
  author_name: string;
  created_at: string;
};

export const TIP_LANES = ['탑', '정글', '미드', '원딜', '서포터'] as const;

export function Tips({ tips, loggedIn }: { tips: Tip[]; loggedIn: boolean }) {
  return (
    <>
      <main class="mt-5 pt-5">
        <div class="container">
          <h2 class="h3 my-4 font-weight-bold">나만의 팁</h2>
          <table class="table table-hover">
            <thead>
              <tr>
                <th scope="col">번호</th>
                <th scope="col">라인</th>
                <th scope="col">제목</th>
                <th scope="col">작성자</th>
              </tr>
            </thead>
            <tbody>
              {tips.length === 0 && (
                <tr>
                  <td colspan={4} class="text-center text-muted">
                    아직 등록된 팁이 없어요. 첫 번째 팁을 남겨 주세요!
                  </td>
                </tr>
              )}
              {tips.map((t, i) => (
                <tr data-toggle="modal" data-target={`#tip_${t.id}`} style="cursor:pointer">
                  <th scope="row">{tips.length - i}</th>
                  <td>{t.lane} 팁</td>
                  <td>{t.title}</td>
                  <td>{t.author_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div class="text-right">
            {loggedIn ? (
              <button class="btn btn-default" data-toggle="modal" data-target="#writing_modal">
                글쓰기
              </button>
            ) : (
              <button class="btn btn-default" data-toggle="modal" data-target="#modalLoginForm">
                로그인하고 글쓰기
              </button>
            )}
          </div>
        </div>
      </main>

      {loggedIn && (
        <div class="modal fade right" id="writing_modal" tabindex={-1} role="dialog" aria-hidden="true">
          <div class="modal-dialog modal-full-height modal-right modal-notify modal-info" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <p class="heading lead">글쓰기</p>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true" class="white-text">
                    ×
                  </span>
                </button>
              </div>
              <form method="post" action="/tips">
                <div class="modal-body">
                  <div class="text-center">
                    <i class="far fa-file-alt fa-4x mb-3 animated rotateIn"></i>
                    <p>
                      <strong>나만의 팁</strong>
                    </p>
                    <p>게임 플레이에 관한 팁이 있나요?</p>
                    <strong>나만의 팁을 작성해주세요!</strong>
                  </div>
                  <hr />
                  <select class="browser-default custom-select" name="lane" required>
                    <option value="">이 팁을 추천하고싶은 라이너</option>
                    {TIP_LANES.map((l) => (
                      <option value={l}>{l}</option>
                    ))}
                  </select>
                  <hr />
                  <label for="tip-url">유튜브 영상 첨부 (선택)</label>
                  <div class="input-group mb-3">
                    <input
                      type="text"
                      class="form-control"
                      name="youtube"
                      id="tip-url"
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </div>
                  <div class="input-group mb-3">
                    <div class="input-group-prepend">
                      <span class="input-group-text">제목</span>
                    </div>
                    <input type="text" class="form-control" name="title" maxlength={100} required />
                  </div>
                  <div class="input-group">
                    <div class="input-group-prepend">
                      <span class="input-group-text">내용</span>
                    </div>
                    <textarea class="form-control" name="body" rows={6} maxlength={5000} required></textarea>
                  </div>
                  <div class="text-right">
                    <button class="btn btn-default" type="submit">
                      글쓰기
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {tips.map((t) => (
        <div class="modal fade" id={`tip_${t.id}`} tabindex={-1} role="dialog" aria-hidden="true">
          <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <h4 class="modal-title w-100">{t.title}</h4>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div class="modal-body">
                <p>
                  <strong>{t.lane}에게 추천하는 팁 입니다.</strong>
                </p>
                {t.youtube_id && (
                  <>
                    <hr />
                    <p>
                      <strong>유튜브 영상</strong>
                    </p>
                    <iframe
                      width="100%"
                      height="315"
                      src={`https://www.youtube.com/embed/${t.youtube_id}`}
                      frameborder="0"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                      allowfullscreen
                    ></iframe>
                  </>
                )}
                <hr />
                <p>
                  <strong>내용</strong>
                </p>
                <p style="white-space: pre-wrap">{t.body}</p>
                <div class="text-right">작성자 : {t.author_name}</div>
              </div>
              <div class="modal-footer justify-content-center">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// "https://www.youtube.com/watch?v=xxxx", "https://youtu.be/xxxx", "xxxx" 모두 허용
export function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : (u.searchParams.get('v') ?? u.pathname.split('/').pop());
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
