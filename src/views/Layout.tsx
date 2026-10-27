import type { Child } from 'hono/jsx';
import { raw } from 'hono/html';

// legacy/flask/templates_back/base.html 을 옮긴 공통 레이아웃
type Props = {
  title?: string;
  user: { name: string } | null;
  flash?: string | null;
  children: Child;
  css?: string;
  script?: string;
};

export const RIOT_DISCLAIMER =
  "WGM.GG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

export function Layout({ title, user, flash, children, css, script }: Props) {
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>{title ? `${title} - WGM.GG` : 'WGM - 우리 정글 뭐함?'}</title>
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.8.2/css/all.css" />
        <link href="/static/css/bootstrap.min.css" rel="stylesheet" />
        <link href="/static/css/mdb.min.css" rel="stylesheet" />
        <link href="/static/css/style.min.css" rel="stylesheet" />
        {css && <style>{raw(css)}</style>}
      </head>
      <body>
        <header>
          <nav class="navbar fixed-top navbar-expand-lg navbar-light white scrolling-navbar">
            <div class="container">
              <a class="navbar-brand waves-effect" href="/">
                <img src="/static/img/WGMimgresize.png" alt="" />
                <strong class="blue-text">WGM.GG</strong>
              </a>
              <button
                class="navbar-toggler"
                type="button"
                data-toggle="collapse"
                data-target="#navbarSupportedContent"
                aria-controls="navbarSupportedContent"
                aria-expanded="false"
                aria-label="Toggle navigation"
              >
                <span class="navbar-toggler-icon"></span>
              </button>
              <div class="collapse navbar-collapse" id="navbarSupportedContent">
                <ul class="navbar-nav mr-auto">
                  <li class="nav-item">
                    <a class="nav-link waves-effect" href="/tips">
                      나만의 팁
                    </a>
                  </li>
                  <li class="nav-item">
                    <a class="nav-link waves-effect" href="/matching">
                      유저매칭
                    </a>
                  </li>
                </ul>
                <ul class="navbar-nav nav-flex-icons align-items-center">
                  {flash && (
                    <li class="nav-item">
                      <div class="alert alert-warning alert-dismissible fade show mb-0 py-2" role="alert">
                        <i class="fas fa-info-circle"></i> {flash}
                        <button type="button" class="close py-2" data-dismiss="alert" aria-label="Close">
                          <span aria-hidden="true">&times;</span>
                        </button>
                      </div>
                    </li>
                  )}
                  {user ? (
                    <>
                      <li class="nav-item">
                        <span class="nav-link">
                          <strong>{user.name}</strong> 님
                        </span>
                      </li>
                      <li class="nav-item">
                        <form method="post" action="/auth/logout" class="m-0">
                          <button type="submit" class="btn btn-info btn-sm">
                            로그아웃
                          </button>
                        </form>
                      </li>
                    </>
                  ) : (
                    <>
                      <li class="nav-item">
                        <button type="button" class="btn btn-info btn-sm" data-toggle="modal" data-target="#modalLoginForm">
                          로그인
                        </button>
                      </li>
                      <li class="nav-item">
                        <button type="button" class="btn btn-info btn-sm" data-toggle="modal" data-target="#modalRegisterForm">
                          회원가입
                        </button>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </nav>
        </header>

        {children}

        <footer class="page-footer text-center font-small mdb-color darken-2 mt-4">
          <div class="container py-3 small" style="opacity: 0.8">
            {RIOT_DISCLAIMER}
          </div>
          <div class="footer-copyright py-3">
            © 2019–2026 <a href="https://github.com/jinho-github">JinhoLee</a>
          </div>
        </footer>

        {!user && <AuthModals />}

        <script src="/static/js/jquery-3.4.1.min.js"></script>
        <script src="/static/js/popper.min.js"></script>
        <script src="/static/js/bootstrap.min.js"></script>
        <script src="/static/js/mdb.min.js"></script>
        {script && <script>{raw(script)}</script>}
      </body>
    </html>
  );
}

function AuthModals() {
  return (
    <>
      <div class="modal fade" id="modalLoginForm" tabindex={-1} role="dialog" aria-hidden="true">
        <div class="modal-dialog" role="document">
          <form method="post" action="/auth/login">
            <div class="modal-content">
              <div class="modal-header text-center">
                <h4 class="modal-title w-100 font-weight-bold">로그인</h4>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div class="modal-body mx-3">
                <div class="md-form mb-5">
                  <i class="fas fa-envelope prefix grey-text"></i>
                  <input type="email" id="login-email" name="email" class="form-control" required />
                  <label for="login-email">이메일</label>
                </div>
                <div class="md-form mb-4">
                  <i class="fas fa-lock prefix grey-text"></i>
                  <input type="password" id="login-pw" name="password" class="form-control" required />
                  <label for="login-pw">비밀번호</label>
                </div>
              </div>
              <div class="modal-footer d-flex justify-content-center">
                <button class="btn btn-default">Login</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div class="modal fade" id="modalRegisterForm" tabindex={-1} role="dialog" aria-hidden="true">
        <div class="modal-dialog" role="document">
          <form method="post" action="/auth/register">
            <div class="modal-content">
              <div class="modal-header text-center">
                <h4 class="modal-title w-100 font-weight-bold">회원가입</h4>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div class="modal-body mx-3">
                <div class="md-form mb-5">
                  <i class="fas fa-envelope prefix grey-text"></i>
                  <input type="email" id="reg-email" name="email" class="form-control" required />
                  <label for="reg-email">이메일</label>
                </div>
                <div class="md-form mb-4">
                  <i class="fas fa-lock prefix grey-text"></i>
                  <input type="password" id="reg-pw1" name="password" class="form-control" minlength={6} required />
                  <label for="reg-pw1">비밀번호 (6자 이상)</label>
                </div>
                <div class="md-form mb-4">
                  <i class="fas fa-lock prefix grey-text"></i>
                  <input type="password" id="reg-pw2" name="password2" class="form-control" minlength={6} required />
                  <label for="reg-pw2">비밀번호 재입력</label>
                </div>
              </div>
              <div class="modal-footer d-flex justify-content-center">
                <button class="btn btn-deep-orange">회원가입</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// no_user.html / no_game.html / 404.html / 500.html 을 하나로 합친 안내 화면
export function MessageCard({ title, message }: { title: string; message: string }) {
  return (
    <main class="mt-5 pt-5">
      <div class="container">
        <section class="card" style="background: linear-gradient(135deg, #3f51b5, #2196f3);">
          <div class="card-body text-white text-center py-5 px-5 my-5">
            <h1 class="mb-4">
              <strong>{title}</strong>
            </h1>
            <p>
              <strong>{message}</strong>
            </p>
            <a href="/" class="btn btn-outline-white">
              홈으로
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
